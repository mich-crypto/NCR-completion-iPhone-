// "Sync from GitHub": pulls data/ncr-list.csv, data/parts.csv, or
// data/status-templates.csv straight from this same site (i.e. whatever's
// currently committed in the repo) and runs it through the exact same
// parse/save pipeline as a manual upload. This is what makes the shared
// lists actually shared across devices without a server: edit the CSV in
// the repo (e.g. via github.com in any browser), then tap the matching
// button on each phone/laptop to pick up the change. cache: "no-store" so
// a stale service-worker/browser cache never masks a just-edited file.
async function fetchRepoFileAsUploadFile(path) {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(`Could not fetch ${path} (HTTP ${res.status}). Does that file exist in the repo?`);
  const text = await res.text();
  return new File([text], path.split("/").pop(), { type: "text/csv" });
}

document.getElementById("ncrListSyncBtn").addEventListener("click", async () => {
  const statusEl = document.getElementById("ncrListUploadStatus");
  statusEl.textContent = "Fetching data/ncr-list.csv from GitHub...";
  try {
    const file = await fetchRepoFileAsUploadFile("data/ncr-list.csv");
    const rows = await parseNcrListFile(file);
    if (!rows.length) {
      statusEl.textContent = "data/ncr-list.csv is empty (just the header row) — add rows to it in the repo first.";
      return;
    }
    await saveNcrListToStorage(rows, { filename: "data/ncr-list.csv (GitHub)", uploadedAt: new Date().toISOString(), count: rows.length });
    await refreshNcrListCache();
    await renderNcrListVersion();
    lookupNcrNumber();
    statusEl.textContent = `Synced ${rows.length} entr${rows.length === 1 ? "y" : "ies"} from GitHub.`;
  } catch (err) {
    statusEl.textContent = err.message || "Could not sync from GitHub.";
  }
});

document.getElementById("partsSyncBtn").addEventListener("click", async () => {
  const statusEl = document.getElementById("partsUploadStatus");
  statusEl.textContent = "Fetching data/parts.csv from GitHub...";
  try {
    const file = await fetchRepoFileAsUploadFile("data/parts.csv");
    const rows = await parsePartsXlsxFile(file);
    if (!rows.length) {
      statusEl.textContent = "data/parts.csv is empty (just the header row) — add rows to it in the repo first.";
      return;
    }
    await savePartsToStorage(rows, { filename: "data/parts.csv (GitHub)", uploadedAt: new Date().toISOString(), count: rows.length });
    await renderPartsVersion();
    renderPartSearchResults(document.getElementById("partSearchInput").value);
    statusEl.textContent = `Synced ${rows.length} part(s) from GitHub.`;
  } catch (err) {
    statusEl.textContent = err.message || "Could not sync from GitHub.";
  }
});

document.getElementById("statusTemplatesSyncBtn").addEventListener("click", async () => {
  const statusEl = document.getElementById("statusTemplatesUploadStatus");
  statusEl.textContent = "Fetching data/status-templates.csv from GitHub...";
  try {
    const file = await fetchRepoFileAsUploadFile("data/status-templates.csv");
    const rows = await parseStatusTemplatesFile(file);
    if (!rows.length) {
      statusEl.textContent = "data/status-templates.csv is empty (just the header row) — add rows to it in the repo first.";
      return;
    }
    saveStatusTemplates(rows);
    renderStatusTemplateOptions();
    statusEl.textContent = `Synced ${rows.length} template(s) from GitHub.`;
  } catch (err) {
    statusEl.textContent = err.message || "Could not sync from GitHub.";
  }
});
