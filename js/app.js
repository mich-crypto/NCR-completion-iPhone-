// UI wiring for the NCR completion email app. Depends on config.js and
// mailto.js having already loaded (see index.html).

const els = {
  banner: document.getElementById("banner"),

  ncrNumber: document.getElementById("ncrNumber"),
  ncrTitle: document.getElementById("ncrTitle"),
  status: document.getElementById("status"),
  workPerformed: document.getElementById("workPerformed"),
  subject: document.getElementById("subject"),

  photoInput: document.getElementById("photoInput"),
  photoGrid: document.getElementById("photoGrid"),

  chipInput: document.getElementById("chipInput"),
  recipientEntry: document.getElementById("recipientEntry"),
  rememberRecipients: document.getElementById("rememberRecipients"),

  previewBtn: document.getElementById("previewBtn"),
  newBtn: document.getElementById("newBtn"),
  openOutlookBtn: document.getElementById("openOutlookBtn"),
  openMailFallback: document.getElementById("openMailFallback"),
  previewSection: document.getElementById("previewSection"),
  previewTo: document.getElementById("previewTo"),
  previewSubject: document.getElementById("previewSubject"),
  previewBody: document.getElementById("previewBody"),
};

const state = {
  photos: [], // { name, objectUrl }
  recipients: [],
  subjectAuto: true, // true until the user types into the Subject field themselves
};

// ---------- small helpers ----------

function showBanner(kind, message) {
  els.banner.textContent = message;
  els.banner.className = `banner ${kind}`;
}

function hideBanner() {
  els.banner.className = "banner hidden";
}

function looksLikeEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function autoSubject() {
  const parts = [];
  if (els.ncrNumber.value.trim()) parts.push(`NCR ${els.ncrNumber.value.trim()}`);
  if (els.ncrTitle.value.trim()) parts.push(els.ncrTitle.value.trim());
  if (els.status.value) parts.push(`[${els.status.value}]`);
  return parts.join(" - ") || "NCR Completion";
}

function refreshAutoSubject() {
  if (state.subjectAuto) els.subject.value = autoSubject();
}

// ---------- recipients (chip) input ----------

function renderRecipients() {
  els.chipInput.querySelectorAll(".chip").forEach((chip) => chip.remove());
  state.recipients.forEach((email, idx) => {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.textContent = email;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "×";
    remove.setAttribute("aria-label", `Remove ${email}`);
    remove.addEventListener("click", () => {
      state.recipients.splice(idx, 1);
      renderRecipients();
    });
    chip.appendChild(remove);
    els.chipInput.insertBefore(chip, els.recipientEntry);
  });
}

function addRecipientFromEntry() {
  const value = els.recipientEntry.value.trim().replace(/,$/, "");
  if (!value) return;
  if (!looksLikeEmail(value)) {
    showBanner("err", `"${value}" doesn't look like a valid email address.`);
    return;
  }
  if (!state.recipients.includes(value)) {
    state.recipients.push(value);
    renderRecipients();
  }
  els.recipientEntry.value = "";
}

els.recipientEntry.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === "," || e.key === "Tab") {
    if (els.recipientEntry.value.trim()) {
      e.preventDefault();
      addRecipientFromEntry();
    }
  }
});
els.recipientEntry.addEventListener("blur", () => {
  if (els.recipientEntry.value.trim()) addRecipientFromEntry();
});

// ---------- photos (preview/reminder only -- not attached automatically) ----------

function renderPhotos() {
  els.photoGrid.innerHTML = "";
  state.photos.forEach((photo, idx) => {
    const cell = document.createElement("div");
    cell.className = "photo-thumb";
    const img = document.createElement("img");
    img.src = photo.objectUrl;
    img.alt = photo.name;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "×";
    remove.setAttribute("aria-label", `Remove ${photo.name}`);
    remove.addEventListener("click", () => {
      URL.revokeObjectURL(photo.objectUrl);
      state.photos.splice(idx, 1);
      renderPhotos();
    });
    cell.appendChild(img);
    cell.appendChild(remove);
    els.photoGrid.appendChild(cell);
  });
}

els.photoInput.addEventListener("change", () => {
  const files = Array.from(els.photoInput.files || []);
  els.photoInput.value = ""; // allow re-selecting the same file later
  if (!files.length) return;
  files.forEach((file) => {
    state.photos.push({ name: file.name, objectUrl: URL.createObjectURL(file) });
  });
  renderPhotos();
});

// ---------- preview & open in Outlook ----------

function currentFormValues() {
  return {
    ncrNumber: els.ncrNumber.value.trim(),
    ncrTitle: els.ncrTitle.value.trim(),
    status: els.status.value,
    workPerformed: els.workPerformed.value.trim(),
    subject: els.subject.value.trim() || autoSubject(),
  };
}

function currentDraft() {
  const values = currentFormValues();
  const body = buildPlainTextBody({ ...values, photoNames: state.photos.map((p) => p.name) });
  return { to: state.recipients, subject: values.subject, body };
}

function renderPreview() {
  const draft = currentDraft();
  els.previewTo.innerHTML = `<strong>To:</strong> ${draft.to.join(", ") || "(no recipients added yet)"}`;
  els.previewSubject.innerHTML = `<strong>Subject:</strong> ${draft.subject}`;
  els.previewBody.textContent = draft.body;
  els.previewSection.classList.remove("hidden");
  els.previewSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

els.previewBtn.addEventListener("click", renderPreview);

function validateBeforeOpening() {
  const values = currentFormValues();
  if (!values.ncrNumber || !values.ncrTitle || !values.workPerformed) {
    showBanner("err", "NCR Number, NCR Title and Work Performed are required.");
    return false;
  }
  if (!state.recipients.length) {
    showBanner("err", "Add at least one recipient.");
    return false;
  }
  return true;
}

function afterHandoff() {
  hideBanner();
  if (els.rememberRecipients.checked) NcrRecipients.saveDefault(state.recipients);
  const msg = state.photos.length
    ? `Now in Outlook: attach ${state.photos.length} photo(s) and tap Send.`
    : "Now in Outlook: review and tap Send.";
  showBanner("ok", msg);
}

els.openOutlookBtn.addEventListener("click", () => {
  if (!validateBeforeOpening()) return;
  const draft = currentDraft();
  els.openMailFallback.href = buildMailtoUrl(draft);
  window.location.href = buildOutlookUrl(draft);
  afterHandoff();
});

els.openMailFallback.addEventListener("click", (e) => {
  if (!validateBeforeOpening()) {
    e.preventDefault();
    return;
  }
  els.openMailFallback.href = buildMailtoUrl(currentDraft());
  afterHandoff();
});

els.newBtn.addEventListener("click", () => {
  els.ncrNumber.value = "";
  els.ncrTitle.value = "";
  els.status.value = "Completed";
  els.workPerformed.value = "";
  els.subject.value = "";
  state.subjectAuto = true;
  state.photos.forEach((p) => URL.revokeObjectURL(p.objectUrl));
  state.photos = [];
  renderPhotos();
  els.previewSection.classList.add("hidden");
  hideBanner();
  // Recipients intentionally left as-is.
});

// Keep the subject auto-generated until the user edits it directly.
[els.ncrNumber, els.ncrTitle, els.status].forEach((el) =>
  el.addEventListener("input", refreshAutoSubject)
);
els.subject.addEventListener("input", () => {
  state.subjectAuto = false;
});

// ---------- boot ----------

function init() {
  state.recipients = NcrRecipients.getDefault();
  renderRecipients();
  refreshAutoSubject();

  if (navigator.serviceWorker) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
}

init();
