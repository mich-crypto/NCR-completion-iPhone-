// All storage is local to this device/browser -- nothing here talks to a
// server. Three kinds of data, same split as the desktop tool this is
// modeled on:
//   - NCR list (number/title/location/description) and Parts catalogue
//     (component/description/RDS code), uploaded or synced from a
//     CSV/Excel file -- can run to hundreds of thousands of rows for a
//     full parts catalog, so IndexedDB rather than localStorage.
//   - Projects (name + LSM/LSC/Quality/Warehouse recipient lists) and
//     saved Status templates -- small, so plain localStorage.

const LS_KEYS = {
  projects: "ncr.projects",
  activeProject: "ncr.activeProject",
  statusTemplates: "ncr.statusTemplates",
};

// ---------- Generic chunked-rows IndexedDB store ----------
//
// A big catalog stored as a single IndexedDB value (one `put()` of a
// 400,000-element array) means the browser has to structured-clone the
// entire array in one go to write it, and the whole thing again to read
// it back -- a large, sustained memory spike either way. Splitting into
// chunks (rows:0, rows:1, ...) keeps every individual read/write small,
// so there's no single moment where the whole dataset has to exist twice
// in memory at once.
const ROWS_CHUNK_SIZE = 3000;
const LEGACY_ROWS_KEY = "rows"; // pre-chunking format: one big array under this key
const META_KEY = "meta";

function makeChunkedRowStore(dbName, storeName) {
  function openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(dbName, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(storeName)) {
          req.result.createObjectStore(storeName);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function getMeta() {
    try {
      const db = await openDB();
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, "readonly");
        const req = tx.objectStore(storeName).get(META_KEY);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    } catch {
      return null;
    }
  }

  async function getRows() {
    try {
      const db = await openDB();
      const meta = await getMeta();

      return await new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, "readonly");
        const store = tx.objectStore(storeName);

        if (meta && typeof meta.chunkCount === "number") {
          const rows = [];
          let pending = meta.chunkCount;
          if (pending === 0) { resolve(rows); return; }
          for (let i = 0; i < meta.chunkCount; i++) {
            const req = store.get(`rows:${i}`);
            req.onsuccess = () => {
              if (req.result) rows.push(...req.result);
              if (--pending === 0) resolve(rows);
            };
            req.onerror = () => reject(req.error);
          }
        } else {
          // Backward compat: data saved before chunking existed.
          const req = store.get(LEGACY_ROWS_KEY);
          req.onsuccess = () => resolve(req.result || []);
          req.onerror = () => reject(req.error);
        }
      });
    } catch {
      return [];
    }
  }

  async function saveRows(rows, meta) {
    const db = await openDB();
    const prevMeta = await getMeta();
    const chunkCount = Math.max(1, Math.ceil(rows.length / ROWS_CHUNK_SIZE));

    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);

      for (let i = 0; i < chunkCount; i++) {
        store.put(rows.slice(i * ROWS_CHUNK_SIZE, (i + 1) * ROWS_CHUNK_SIZE), `rows:${i}`);
      }
      // Drop any leftover chunks from a previous, larger save.
      const oldCount = prevMeta && typeof prevMeta.chunkCount === "number" ? prevMeta.chunkCount : 0;
      for (let i = chunkCount; i < oldCount; i++) store.delete(`rows:${i}`);
      store.delete(LEGACY_ROWS_KEY);

      store.put({ ...(meta || {}), chunkCount }, META_KEY);

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async function clear() {
    const db = await openDB();
    const prevMeta = await getMeta();
    const oldCount = prevMeta && typeof prevMeta.chunkCount === "number" ? prevMeta.chunkCount : 0;

    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      for (let i = 0; i < oldCount; i++) store.delete(`rows:${i}`);
      store.delete(LEGACY_ROWS_KEY);
      store.delete(META_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  return { getRows, getMeta, saveRows, clear };
}

// ---------- NCR list ----------

const ncrListStore = makeChunkedRowStore("ncr_number_list_db", "ncrlist");
const getStoredNcrList = ncrListStore.getRows;
const getNcrListMeta = ncrListStore.getMeta;
const saveNcrListToStorage = ncrListStore.saveRows;
const clearStoredNcrList = ncrListStore.clear;

// ---------- Parts catalogue ----------

const partsStore = makeChunkedRowStore("ncr_parts_db", "parts");
const getStoredParts = partsStore.getRows;
const getPartsMeta = partsStore.getMeta;
const savePartsToStorage = partsStore.saveRows;
const clearStoredParts = partsStore.clear;

// ---------- Projects (localStorage) ----------

// Carried over from the existing desktop tool's defaults -- verify/correct
// these addresses in the "Projects & recipients" panel if anything's changed.
const DEFAULT_PROJECTS = [
  { name: "Baltic Power", lsm: "Blp_lsm@vestas.com", lsc: "blp_lsc@vestas.com", quality: "blp_qi_comm@vestas.com", warehouse: "blp_warehouse_comm@vestas.com" },
];

function getStoredProjects() {
  try {
    const saved = localStorage.getItem(LS_KEYS.projects);
    if (saved) return JSON.parse(saved);
  } catch {
    /* fall through to defaults */
  }
  return DEFAULT_PROJECTS;
}

function saveProjects(projects) {
  localStorage.setItem(LS_KEYS.projects, JSON.stringify(projects));
}

function getActiveProjectName() {
  return localStorage.getItem(LS_KEYS.activeProject) || (getStoredProjects()[0] || {}).name || "";
}

function setActiveProjectName(name) {
  localStorage.setItem(LS_KEYS.activeProject, name);
}

// Splits a "comma/semicolon separated" recipients field into clean addresses.
function parseEmailList(str) {
  return (str || "").split(/[,;]/).map((s) => s.trim()).filter(Boolean);
}

// ---------- Status templates (localStorage) ----------

function getStatusTemplates() {
  try {
    const saved = localStorage.getItem(LS_KEYS.statusTemplates);
    if (saved) return JSON.parse(saved);
  } catch {
    /* ignore */
  }
  return [];
}

function saveStatusTemplates(list) {
  localStorage.setItem(LS_KEYS.statusTemplates, JSON.stringify(list));
}
