// UI wiring for the NCR Completion app. Depends on storage.js, xlsx-import.js
// and mailto.js having already loaded (see index.html).

const els = {
  banner: document.getElementById("banner"),
  activeProject: document.getElementById("activeProject"),

  ncrListVersion: document.getElementById("ncrListVersion"),
  ncrListFileInput: document.getElementById("ncrListFileInput"),
  ncrListUploadBtn: document.getElementById("ncrListUploadBtn"),
  ncrListUploadStatus: document.getElementById("ncrListUploadStatus"),
  ncrListClearBtn: document.getElementById("ncrListClearBtn"),
  projectsList: document.getElementById("projectsList"),
  addProjectBtn: document.getElementById("addProjectBtn"),

  turbineLocation: document.getElementById("turbineLocation"),
  ncrNumber: document.getElementById("ncrNumber"),
  titleBox: document.getElementById("titleBox"),
  descriptionBox: document.getElementById("descriptionBox"),
  ncrStatus: document.getElementById("ncrStatus"),
  status: document.getElementById("status"),
  statusTemplateSelect: document.getElementById("statusTemplateSelect"),
  deleteStatusTemplateBtn: document.getElementById("deleteStatusTemplateBtn"),
  saveStatusTemplateBtn: document.getElementById("saveStatusTemplateBtn"),
  partsUsed: document.getElementById("partsUsed"),
  partsTableWrap: document.getElementById("partsTableWrap"),
  partsRows: document.getElementById("partsRows"),
  addPartRowBtn: document.getElementById("addPartRowBtn"),

  emailBtn: document.getElementById("emailBtn"),
  mailFallback: document.getElementById("mailFallback"),
  clearFormBtn: document.getElementById("clearFormBtn"),
  preview: document.getElementById("preview"),

  templateModalOverlay: document.getElementById("templateModalOverlay"),
  templateModalInput: document.getElementById("templateModalInput"),
  templateModalConfirm: document.getElementById("templateModalConfirm"),
  templateModalCancel: document.getElementById("templateModalCancel"),
};

const state = {
  ncrListCache: [],
  ncrListCacheByNumber: new Map(),
  projects: [],
  parts: [],
};

function showBanner(kind, message) {
  els.banner.textContent = message;
  els.banner.className = `banner ${kind}`;
}
function hideBanner() {
  els.banner.className = "banner hidden";
}

// ---------- NCR list ----------

async function refreshNcrListCache() {
  state.ncrListCache = await getStoredNcrList();
  state.ncrListCacheByNumber = new Map(state.ncrListCache.map((r) => [r.number.toLowerCase(), r]));
}

async function renderNcrListVersion() {
  const rows = state.ncrListCache;
  const meta = await getNcrListMeta();
  if (rows.length && meta) {
    const when = meta.uploadedAt ? new Date(meta.uploadedAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "unknown date";
    els.ncrListVersion.textContent = `Loaded: ${meta.filename || "uploaded file"} · ${rows.length} entries · uploaded ${when}`;
    els.ncrListClearBtn.style.display = "";
  } else {
    els.ncrListVersion.textContent = "No NCR number list uploaded yet.";
    els.ncrListClearBtn.style.display = "none";
  }
}

els.ncrListUploadBtn.addEventListener("click", async () => {
  const file = els.ncrListFileInput.files[0];
  if (!file) {
    els.ncrListUploadStatus.textContent = "Choose a CSV or Excel file first.";
    return;
  }
  els.ncrListUploadStatus.textContent = "Reading file...";
  try {
    const rows = await parseNcrListFile(file);
    if (!rows.length) {
      els.ncrListUploadStatus.textContent = "No rows found in this file.";
      return;
    }
    await saveNcrListToStorage(rows, { filename: file.name, uploadedAt: new Date().toISOString(), count: rows.length });
    await refreshNcrListCache();
    await renderNcrListVersion();
    els.ncrListFileInput.value = "";
    els.ncrListUploadStatus.textContent = `Uploaded ${rows.length} entr${rows.length === 1 ? "y" : "ies"} from ${file.name}.`;
    lookupNcrNumber(); // re-check the currently typed number against the new list
  } catch (err) {
    els.ncrListUploadStatus.textContent = err.message || "Could not parse this file.";
  }
});

els.ncrListClearBtn.addEventListener("click", async () => {
  if (!confirm("Clear the uploaded NCR number list?")) return;
  await clearStoredNcrList();
  await refreshNcrListCache();
  els.ncrListFileInput.value = "";
  await renderNcrListVersion();
  lookupNcrNumber();
});

// ---------- Projects & recipients ----------

function renderProjectsPanel() {
  els.projectsList.innerHTML = "";
  state.projects.forEach((proj, idx) => {
    const row = document.createElement("div");
    row.className = "projects-panel-row";
    row.innerHTML = `
      <div class="proj-name-row">
        <input type="text" class="proj-field" data-idx="${idx}" data-field="name" value="${escapeHtmlAttr(proj.name)}" placeholder="Project name" />
        <button type="button" class="btn btn-danger-outline remove-project-btn" data-idx="${idx}">Remove</button>
      </div>
      <label>LSM emails <input type="text" class="proj-field" data-idx="${idx}" data-field="lsm" value="${escapeHtmlAttr(proj.lsm)}" placeholder="comma or semicolon separated"></label>
      <label>LSC emails <input type="text" class="proj-field" data-idx="${idx}" data-field="lsc" value="${escapeHtmlAttr(proj.lsc)}" placeholder="comma or semicolon separated"></label>
      <label>Quality emails <input type="text" class="proj-field" data-idx="${idx}" data-field="quality" value="${escapeHtmlAttr(proj.quality)}" placeholder="comma or semicolon separated"></label>
      <label>Warehouse emails <input type="text" class="proj-field" data-idx="${idx}" data-field="warehouse" value="${escapeHtmlAttr(proj.warehouse)}" placeholder="comma or semicolon separated"></label>
    `;
    els.projectsList.appendChild(row);
  });
}

function populateActiveProjectSelect(preserveName) {
  const names = state.projects.map((p) => p.name);
  els.activeProject.innerHTML = names.map((n) => `<option value="${escapeHtmlAttr(n)}">${escapeHtmlAttr(n)}</option>`).join("");
  const want = preserveName && names.includes(preserveName) ? preserveName : (names.includes(getActiveProjectName()) ? getActiveProjectName() : names[0]);
  if (want) {
    els.activeProject.value = want;
    setActiveProjectName(want);
  }
}

function commitProjectsFromPanel() {
  const prevActiveName = els.activeProject.value;
  const rows = els.projectsList.querySelectorAll(".proj-name-row");
  const projects = [];
  rows.forEach((_, idx) => {
    const proj = { name: "", lsm: "", lsc: "", quality: "", warehouse: "" };
    els.projectsList.querySelectorAll(`.proj-field[data-idx="${idx}"]`).forEach((input) => {
      proj[input.dataset.field] = input.value;
    });
    proj.name = proj.name.trim() || `Project ${idx + 1}`;
    projects.push(proj);
  });
  state.projects = projects;
  saveProjects(projects);
  populateActiveProjectSelect(prevActiveName);
}

els.projectsList.addEventListener("input", commitProjectsFromPanel);

els.projectsList.addEventListener("click", (e) => {
  if (!e.target.classList.contains("remove-project-btn")) return;
  const idx = parseInt(e.target.dataset.idx, 10);
  state.projects.splice(idx, 1);
  saveProjects(state.projects);
  renderProjectsPanel();
  populateActiveProjectSelect();
});

els.addProjectBtn.addEventListener("click", () => {
  state.projects.push({ name: `Project ${state.projects.length + 1}`, lsm: "", lsc: "", quality: "", warehouse: "" });
  saveProjects(state.projects);
  renderProjectsPanel();
  populateActiveProjectSelect();
});

els.activeProject.addEventListener("change", (e) => setActiveProjectName(e.target.value));

// ---------- NCR number lookup ----------

function lookupNcrNumber() {
  const typed = els.ncrNumber.value.trim().toLowerCase();
  if (!typed) {
    els.titleBox.textContent = "No matching NCR number found yet.";
    els.descriptionBox.textContent = "No matching NCR number found yet.";
    updatePreview();
    return;
  }
  const match = state.ncrListCacheByNumber.get(typed);
  if (match) {
    els.turbineLocation.value = match.location;
    els.titleBox.textContent = match.title || "(no title in the uploaded list)";
    els.descriptionBox.textContent = match.description || "No description for this NCR in the uploaded list.";
  } else {
    els.titleBox.textContent = `No entry found for "${els.ncrNumber.value.trim()}" in the uploaded NCR list.`;
    els.descriptionBox.textContent = `No entry found for "${els.ncrNumber.value.trim()}" in the uploaded NCR list.`;
  }
  updatePreview();
}
els.ncrNumber.addEventListener("input", lookupNcrNumber);

function getMatchedTitle() {
  const typed = els.ncrNumber.value.trim().toLowerCase();
  if (!typed) return "";
  return state.ncrListCacheByNumber.get(typed)?.title || "";
}

// ---------- Parts ----------

function renderPartsRows() {
  els.partsRows.innerHTML = "";
  state.parts.forEach((row, idx) => {
    const div = document.createElement("div");
    div.className = "part-row";
    div.innerHTML = `
      <input type="text" class="part-input" data-idx="${idx}" data-field="part" value="${escapeHtmlAttr(row.part)}" placeholder="Part number">
      <input type="text" class="part-input" data-idx="${idx}" data-field="qty" value="${escapeHtmlAttr(row.qty)}" placeholder="Qty" style="max-width:80px;">
      <button type="button" class="btn btn-danger-outline remove-part-btn" data-idx="${idx}">✕</button>
    `;
    els.partsRows.appendChild(div);
  });
}

els.partsRows.addEventListener("input", (e) => {
  if (!e.target.classList.contains("part-input")) return;
  const idx = parseInt(e.target.dataset.idx, 10);
  state.parts[idx][e.target.dataset.field] = e.target.value;
  updatePreview();
});

els.partsRows.addEventListener("click", (e) => {
  if (!e.target.classList.contains("remove-part-btn")) return;
  const idx = parseInt(e.target.dataset.idx, 10);
  state.parts.splice(idx, 1);
  renderPartsRows();
  updatePreview();
});

els.addPartRowBtn.addEventListener("click", () => {
  state.parts.push({ part: "", qty: "" });
  renderPartsRows();
});

els.partsUsed.addEventListener("change", () => {
  const isUsed = els.partsUsed.value === "Parts required";
  els.partsTableWrap.classList.toggle("hidden", !isUsed);
  if (isUsed && state.parts.length === 0) {
    state.parts.push({ part: "", qty: "" });
    renderPartsRows();
  }
  updatePreview();
});

// ---------- Status templates ----------

function renderStatusTemplateOptions() {
  const templates = getStatusTemplates();
  const current = els.statusTemplateSelect.value;
  els.statusTemplateSelect.innerHTML = `<option value="">-- Load a saved status --</option>` +
    templates.map((t) => `<option value="${escapeHtmlAttr(t.name)}">${escapeHtmlAttr(t.name)}</option>`).join("");
  if (templates.some((t) => t.name === current)) els.statusTemplateSelect.value = current;
}

els.statusTemplateSelect.addEventListener("change", (e) => {
  if (!e.target.value) {
    els.deleteStatusTemplateBtn.style.display = "none";
    return;
  }
  const match = getStatusTemplates().find((t) => t.name === e.target.value);
  if (match) {
    els.status.value = match.text;
    updatePreview();
    els.deleteStatusTemplateBtn.style.display = "";
  }
});

els.saveStatusTemplateBtn.addEventListener("click", () => {
  if (!els.status.value.trim()) {
    showBanner("err", "Nothing in the Status box to save.");
    return;
  }
  els.templateModalInput.value = "";
  els.templateModalOverlay.classList.remove("hidden");
  els.templateModalInput.focus();
});

function performSaveStatusTemplate() {
  const name = els.templateModalInput.value.trim();
  const text = els.status.value.trim();
  if (!name) {
    showBanner("err", "Give this status a short name first.");
    return;
  }
  const templates = getStatusTemplates();
  const idx = templates.findIndex((t) => t.name === name);
  if (idx !== -1) templates[idx].text = text;
  else templates.push({ name, text });
  saveStatusTemplates(templates);
  renderStatusTemplateOptions();
  els.statusTemplateSelect.value = name;
  els.deleteStatusTemplateBtn.style.display = "";
  els.templateModalOverlay.classList.add("hidden");
  hideBanner();
}

els.templateModalConfirm.addEventListener("click", performSaveStatusTemplate);
els.templateModalCancel.addEventListener("click", () => els.templateModalOverlay.classList.add("hidden"));
els.templateModalInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") { e.preventDefault(); performSaveStatusTemplate(); }
  else if (e.key === "Escape") els.templateModalOverlay.classList.add("hidden");
});
els.templateModalOverlay.addEventListener("click", (e) => {
  if (e.target === els.templateModalOverlay) els.templateModalOverlay.classList.add("hidden");
});

els.deleteStatusTemplateBtn.addEventListener("click", () => {
  const name = els.statusTemplateSelect.value;
  if (!name || !confirm(`Delete the saved status "${name}"?`)) return;
  saveStatusTemplates(getStatusTemplates().filter((t) => t.name !== name));
  renderStatusTemplateOptions();
  els.deleteStatusTemplateBtn.style.display = "none";
});

// ---------- Preview, send & clear ----------

function currentFields() {
  return {
    turbineLocation: els.turbineLocation.value.trim(),
    ncrNumber: els.ncrNumber.value.trim(),
    ncrTitle: getMatchedTitle(),
    ncrStatus: els.ncrStatus.value,
    status: els.status.value.trim(),
    partsUsed: els.partsUsed.value,
    parts: state.parts.filter((p) => p.part || p.qty),
  };
}

function updatePreview() {
  els.preview.innerHTML = buildTableHtml(currentFields());
}

[els.turbineLocation, els.ncrStatus, els.status].forEach((el) => el.addEventListener("input", updatePreview));

function recipientsForCurrentProject() {
  const activeName = els.activeProject.value;
  const proj = state.projects.find((p) => p.name === activeName) || { lsm: "", lsc: "", quality: "", warehouse: "" };
  let list = [...parseEmailList(proj.lsm), ...parseEmailList(proj.lsc), ...parseEmailList(proj.quality)];
  if (els.partsUsed.value === "Parts required") list = list.concat(parseEmailList(proj.warehouse));
  // De-dupe while preserving order.
  return [...new Set(list)];
}

els.emailBtn.addEventListener("click", async () => {
  const fields = currentFields();
  if (!fields.ncrNumber) {
    showBanner("err", "NCR number is required.");
    return;
  }
  const to = recipientsForCurrentProject();
  if (!to.length) {
    showBanner("err", `No recipient emails set for "${els.activeProject.value || "the active project"}" — add them above.`);
    return;
  }

  const html = buildTableHtml(fields);
  const plainText = buildTablePlainText(fields);
  const subject = buildSubjectText(fields);

  const ok = await copyRichTable(html, plainText);
  els.mailFallback.href = buildMailtoUrl({ to, subject });

  await new Promise((resolve) => setTimeout(resolve, 400));
  window.location.href = buildOutlookUrl({ to, subject });

  showBanner(ok ? "ok" : "err", ok ? "Copied! Opening Outlook — paste (Cmd/Ctrl+V) into the email body." : "Opening Outlook, but copying failed — copy the preview table manually.");
});

els.mailFallback.addEventListener("click", async (e) => {
  const fields = currentFields();
  if (!fields.ncrNumber) {
    e.preventDefault();
    showBanner("err", "NCR number is required.");
    return;
  }
  const to = recipientsForCurrentProject();
  if (!to.length) {
    e.preventDefault();
    showBanner("err", `No recipient emails set for "${els.activeProject.value || "the active project"}" — add them above.`);
    return;
  }
  await copyRichTable(buildTableHtml(fields), buildTablePlainText(fields));
  e.target.href = buildMailtoUrl({ to, subject: buildSubjectText(fields) });
  showBanner("ok", "Copied! Opening Mail — paste (Cmd/Ctrl+V) into the email body.");
});

els.clearFormBtn.addEventListener("click", () => {
  if (!confirm("Clear all fields on the Completion form? This cannot be undone.")) return;
  els.turbineLocation.value = "";
  els.ncrNumber.value = "";
  els.titleBox.textContent = "No matching NCR number found yet.";
  els.descriptionBox.textContent = "No matching NCR number found yet.";
  els.ncrStatus.selectedIndex = 0;
  els.status.value = "";
  els.statusTemplateSelect.value = "";
  els.deleteStatusTemplateBtn.style.display = "none";
  els.partsUsed.value = "No parts required";
  els.partsTableWrap.classList.add("hidden");
  state.parts = [];
  renderPartsRows();
  hideBanner();
  updatePreview();
});

// ---------- boot ----------

async function init() {
  state.projects = getStoredProjects();
  renderProjectsPanel();
  populateActiveProjectSelect();

  renderStatusTemplateOptions();

  await refreshNcrListCache();
  await renderNcrListVersion();

  updatePreview();

  if (navigator.serviceWorker) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
}

init();
