// Parts tab: search an uploaded parts catalogue (Component / Component
// description / Rds code) by part number, description, or RDS-PP code, plus
// a VMS report shortcut. Depends on storage.js, xlsx-import.js and
// mailto.js (for escapeHtmlAttr / copyPlainText) already being loaded.
//
// The desktop tool's Parts tab also has a "PDF reference library" that
// connects to local folders via the File System Access API
// (showDirectoryPicker) and lists whatever PDFs are in them. That API isn't
// supported in Safari/iOS at all, so there's no way to port it to this app
// as-is -- it's left out here rather than shipped broken.

const partsEls = {
  partsVersion: document.getElementById("partsVersion"),
  partsFileInput: document.getElementById("partsFileInput"),
  partsUploadBtn: document.getElementById("partsUploadBtn"),
  partsUploadStatus: document.getElementById("partsUploadStatus"),
  partsClearBtn: document.getElementById("partsClearBtn"),
  partSearchInput: document.getElementById("partSearchInput"),
  partSearchResults: document.getElementById("partSearchResults"),
};

// Hardcoded VMS (Vestas Management System / Power BI) report link -- this
// specific report has no filter parameter, so every lookup opens the same
// generic report; the part number is copied to the clipboard first so it
// can be pasted into VMS's own search once it's open.
const VMS_URL = "https://app.powerbi.com/groups/me/apps/f79f5000-0a89-4389-9827-112d780a8071/reports/03ed9df4-28b9-4002-9f5a-aafe9e834125/ReportSection93ea4b46a57819cc350c?ctid=c0701940-7b3f-4116-a59f-159078bc3c63&chromeless=1&experience=power-bi";

async function copyPartAndOpenVms(partNumber) {
  const copied = await copyPlainText(partNumber);
  window.open(VMS_URL, "_blank");
  showBanner(copied ? "ok" : "err", copied ? `Copied "${partNumber}" — opening VMS. Paste it into VMS's own search.` : "Opening VMS, but copying failed — copy the part number manually.");
}

async function renderPartsVersion() {
  const rows = await getStoredParts();
  const meta = await getPartsMeta();
  if (rows.length && meta) {
    const when = meta.uploadedAt ? new Date(meta.uploadedAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "unknown date";
    partsEls.partsVersion.textContent = `Loaded: ${meta.filename || "uploaded file"} · ${rows.length} parts · uploaded ${when}`;
    partsEls.partsClearBtn.style.display = "";
  } else {
    partsEls.partsVersion.textContent = "No parts list uploaded yet.";
    partsEls.partsClearBtn.style.display = "none";
  }
}

// RDS-PP codes are conventionally written with a leading "=" (e.g.
// "=BPA02-FC002"), but uploaded lists don't always store it that way --
// stripping it from both sides means a search works regardless of whether
// either one happens to include it.
function normalizeRdsCode(text) {
  return (text || "").toLowerCase().replace(/=/g, "");
}

async function renderPartSearchResults(query) {
  const q = query.trim().toLowerCase();
  const qForRds = normalizeRdsCode(q);

  if (!q) {
    partsEls.partSearchResults.innerHTML = "";
    return;
  }

  const catalogue = await getStoredParts();
  if (!catalogue.length) {
    partsEls.partSearchResults.innerHTML = '<p class="no-results">No parts loaded yet — upload a list above.</p>';
    return;
  }

  let matches = catalogue.filter((row) =>
    (row.part || "").toLowerCase().includes(q) ||
    (row.desc || "").toLowerCase().includes(q) ||
    normalizeRdsCode(row.rds).includes(qForRds)
  );

  // De-duplicate rows that are identical across every visible field.
  const seen = new Set();
  matches = matches.filter((row) => {
    const key = `${row.part}|${row.desc}|${row.rds}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if (!matches.length) {
    partsEls.partSearchResults.innerHTML = `<p class="no-results">No parts match "${escapeHtmlAttr(query.trim())}". Try a part number, a keyword from the description, or an RDS-PP code.</p>`;
    return;
  }

  const countLine = matches.length > 50
    ? `<p class="result-count">Showing first 50 of ${matches.length} matches — refine your search to narrow it down.</p>`
    : `<p class="result-count">${matches.length} match${matches.length === 1 ? "" : "es"}</p>`;

  partsEls.partSearchResults.innerHTML = countLine + matches.slice(0, 50).map((row) => `
    <div class="part-result">
      <div class="part-number">
        ${escapeHtmlAttr(row.part)}
        <button type="button" class="vms-lookup-btn" data-part="${escapeHtmlAttr(row.part)}">VMS</button>
      </div>
      <div class="part-desc">${escapeHtmlAttr(row.desc)}${row.rds ? ` <span class="part-rds">· RDS-PP: ${escapeHtmlAttr(row.rds)}</span>` : ""}</div>
    </div>
  `).join("");

  partsEls.partSearchResults.querySelectorAll(".vms-lookup-btn").forEach((btn) => {
    btn.addEventListener("click", () => copyPartAndOpenVms(btn.dataset.part));
  });
}

partsEls.partSearchInput.addEventListener("input", (e) => renderPartSearchResults(e.target.value));

partsEls.partsUploadBtn.addEventListener("click", async () => {
  const file = partsEls.partsFileInput.files[0];
  if (!file) {
    partsEls.partsUploadStatus.textContent = "Choose a CSV or Excel file first.";
    return;
  }
  partsEls.partsUploadStatus.textContent = readingFileMessage(file);
  try {
    const rows = await parsePartsXlsxFile(file);
    if (!rows.length) {
      partsEls.partsUploadStatus.textContent = "No rows found in this file.";
      return;
    }
    await savePartsToStorage(rows, { filename: file.name, uploadedAt: new Date().toISOString(), count: rows.length });
    await renderPartsVersion();
    renderPartSearchResults(partsEls.partSearchInput.value);
    partsEls.partsFileInput.value = "";
    partsEls.partsUploadStatus.textContent = `Uploaded ${rows.length} part(s) from ${file.name}.`;
  } catch (err) {
    partsEls.partsUploadStatus.textContent = err.message || "Could not parse this file. Check it is a valid CSV/Excel file with the right columns.";
  }
});

partsEls.partsClearBtn.addEventListener("click", async () => {
  if (!confirm("Clear the uploaded parts list?")) return;
  await clearStoredParts();
  partsEls.partsFileInput.value = "";
  await renderPartsVersion();
  renderPartSearchResults(partsEls.partSearchInput.value);
});

async function initPartsTab() {
  await renderPartsVersion();
}
