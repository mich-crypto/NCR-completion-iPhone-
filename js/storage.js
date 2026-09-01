// All storage is local to this device/browser -- nothing here talks to a
// server. Three kinds of data, same split as the desktop tool this is
// modeled on:
//   - NCR list (number/title/location/description), uploaded from a
//     CSV/Excel file -- can be a few thousand rows, so IndexedDB rather
//     than localStorage.
//   - Projects (name + LSM/LSC/Quality/Warehouse recipient lists) and
//     saved Status templates -- small, so plain localStorage.

const LS_KEYS = {
  projects: "ncr.projects",
  activeProject: "ncr.activeProject",
  statusTemplates: "ncr.statusTemplates",
};

// ---------- NCR list (IndexedDB) ----------

const NCR_DB_NAME = "ncr_number_list_db";
const NCR_STORE_NAME = "ncrlist";
const NCR_ROWS_KEY = "rows";
const NCR_META_KEY = "meta";

function openNcrListDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(NCR_DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(NCR_STORE_NAME)) {
        req.result.createObjectStore(NCR_STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getStoredNcrList() {
  try {
    const db = await openNcrListDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(NCR_STORE_NAME, "readonly");
      const req = tx.objectStore(NCR_STORE_NAME).get(NCR_ROWS_KEY);
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

async function getNcrListMeta() {
  try {
    const db = await openNcrListDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(NCR_STORE_NAME, "readonly");
      const req = tx.objectStore(NCR_STORE_NAME).get(NCR_META_KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

async function saveNcrListToStorage(rows, meta) {
  const db = await openNcrListDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(NCR_STORE_NAME, "readwrite");
    tx.objectStore(NCR_STORE_NAME).put(rows, NCR_ROWS_KEY);
    if (meta) tx.objectStore(NCR_STORE_NAME).put(meta, NCR_META_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function clearStoredNcrList() {
  const db = await openNcrListDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(NCR_STORE_NAME, "readwrite");
    tx.objectStore(NCR_STORE_NAME).delete(NCR_ROWS_KEY);
    tx.objectStore(NCR_STORE_NAME).delete(NCR_META_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

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
