// Parsers for the file uploads/syncs this app supports (NCR number list,
// Parts catalogue, Status templates). Same forgiving column matching as the
// desktop tool this is modeled on, so the exact same files you already use
// there can be uploaded here unchanged: header row doesn't have to be row
// 1, column names are matched case/whitespace-insensitively.

// NCR number list: { number, title, location, description } rows.
// Description is optional; Number/Title/Location are required.

function normalizeHeader(h) {
  return String(h || "").replace(/\s+/g, " ").trim().toLowerCase();
}

function findColumnIndex(header, candidates) {
  for (const candidate of candidates) {
    const idx = header.findIndex((h) => h === candidate);
    if (idx !== -1) return idx;
  }
  for (const candidate of candidates) {
    const idx = header.findIndex((h) => h.includes(candidate));
    if (idx !== -1) return idx;
  }
  return -1;
}

async function parseNcrListFile(file) {
  const isCsv = /\.csv$/i.test(file.name);
  let workbook;
  if (isCsv) {
    workbook = XLSX.read(await file.text(), { type: "string" });
  } else {
    workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
  }

  let headerRowIdx = -1, numIdx = -1, titleIdx = -1, locIdx = -1, data = null;

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const sheetData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false });
    if (sheetData.length === 0) continue;

    for (let r = 0; r < Math.min(sheetData.length, 10); r++) {
      const header = sheetData[r].map(normalizeHeader);
      const n = findColumnIndex(header, ["number", "ncr number"]);
      const t = findColumnIndex(header, ["title"]);
      const l = findColumnIndex(header, ["location"]);
      if (n !== -1 && t !== -1 && l !== -1) {
        headerRowIdx = r; numIdx = n; titleIdx = t; locIdx = l;
        data = sheetData;
        break;
      }
    }
    if (data) break;
  }

  if (!data) {
    const firstSheetData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1, defval: "", raw: false });
    const seenHeaders = (firstSheetData[0] || []).map((h) => String(h || "").trim()).filter(Boolean);
    throw new Error(`Could not find columns named Number, Title, and Location. First row has: ${seenHeaders.length ? seenHeaders.join(", ") : "(empty)"}`);
  }

  const descIdx = findColumnIndex(data[headerRowIdx].map(normalizeHeader), ["description"]);

  return data.slice(headerRowIdx + 1)
    .map((row) => ({
      number: String(row[numIdx] || "").trim(),
      title: String(row[titleIdx] || "").trim(),
      location: String(row[locIdx] || "").trim(),
      description: descIdx !== -1 ? String(row[descIdx] || "").trim() : "",
    }))
    .filter((r) => r.number);
}

// Parses an uploaded parts catalogue (CSV or Excel) into { part, desc, rds }
// rows. Columns: Component, Component description, Rds code -- header row
// doesn't have to be row 1 or on the first sheet. "Description" is matched
// (and blanked out) before "Component" so "component" doesn't also match
// inside "component description" via the fallback substring check.
async function parsePartsXlsxFile(file) {
  const isCsv = /\.csv$/i.test(file.name);
  const workbook = isCsv
    ? XLSX.read(await file.text(), { type: "string" })
    : XLSX.read(await file.arrayBuffer(), { type: "array" });

  let headerRowIdx = -1, partIdx = -1, descIdx = -1, rdsIdx = -1, data = null;

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const sheetData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false });
    if (sheetData.length === 0) continue;

    for (let r = 0; r < Math.min(sheetData.length, 10); r++) {
      const header = sheetData[r].map(normalizeHeader);
      const d = findColumnIndex(header, ["component description", "description"]);
      const headerForPart = d === -1 ? header : header.map((h, i) => (i === d ? "" : h));
      const p = findColumnIndex(headerForPart, ["component"]);
      const rd = findColumnIndex(header, ["rds code", "rds-pp code", "rds-pp", "rdspp", "rds"]);
      if (p !== -1 && d !== -1 && rd !== -1) {
        headerRowIdx = r; partIdx = p; descIdx = d; rdsIdx = rd;
        data = sheetData;
        break;
      }
    }
    if (data) break;
  }

  if (!data) {
    const firstSheetData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1, defval: "", raw: false });
    const seenHeaders = (firstSheetData[0] || []).map((h) => String(h || "").trim()).filter(Boolean);
    const sheetNote = workbook.SheetNames.length > 1 ? ` Checked all ${workbook.SheetNames.length} sheets (${workbook.SheetNames.join(", ")}).` : "";
    throw new Error(`Could not find columns named Component, Component description, and Rds code.${sheetNote} First row of "${workbook.SheetNames[0]}" has: ${seenHeaders.length ? seenHeaders.join(", ") : "(empty)"}`);
  }

  return data.slice(headerRowIdx + 1)
    .map((row) => ({
      part: String(row[partIdx] || "").trim(),
      desc: String(row[descIdx] || "").trim(),
      rds: String(row[rdsIdx] || "").trim(),
    }))
    .filter((r) => r.part || r.desc);
}

// Parses an uploaded/synced Status-templates file (CSV or Excel) into
// { name, text } rows -- same shape as what "Save as template" on the
// Completion tab writes. Columns: Name, Text.
async function parseStatusTemplatesFile(file) {
  const isCsv = /\.csv$/i.test(file.name);
  const workbook = isCsv
    ? XLSX.read(await file.text(), { type: "string" })
    : XLSX.read(await file.arrayBuffer(), { type: "array" });

  let headerRowIdx = -1, nameIdx = -1, textIdx = -1, data = null;

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const sheetData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false });
    if (sheetData.length === 0) continue;

    for (let r = 0; r < Math.min(sheetData.length, 10); r++) {
      const header = sheetData[r].map(normalizeHeader);
      const n = findColumnIndex(header, ["name"]);
      const t = findColumnIndex(header, ["text"]);
      if (n !== -1 && t !== -1) {
        headerRowIdx = r; nameIdx = n; textIdx = t;
        data = sheetData;
        break;
      }
    }
    if (data) break;
  }

  if (!data) {
    const firstSheetData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1, defval: "", raw: false });
    const seenHeaders = (firstSheetData[0] || []).map((h) => String(h || "").trim()).filter(Boolean);
    throw new Error(`Could not find columns named Name and Text. First row has: ${seenHeaders.length ? seenHeaders.join(", ") : "(empty)"}`);
  }

  return data.slice(headerRowIdx + 1)
    .map((row) => ({
      name: String(row[nameIdx] || "").trim(),
      text: String(row[textIdx] || "").trim(),
    }))
    .filter((r) => r.name);
}
