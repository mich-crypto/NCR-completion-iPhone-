// Parsers for the file uploads/syncs this app supports (NCR number list,
// Parts catalogue, Status templates). Same forgiving column matching as the
// desktop tool this is modeled on, so the exact same files you already use
// there can be uploaded here unchanged: header row doesn't have to be row
// 1, column names are matched case/whitespace-insensitively.

function normalizeHeader(h) {
  return String(h || "").replace(/\s+/g, " ").trim().toLowerCase();
}

// A big catalog (tens of MB) genuinely takes a couple of seconds to parse
// even with the lightweight CSV path -- this sets that expectation up
// front instead of the status line just sitting on "Reading file..."
// looking stuck.
function readingFileMessage(file) {
  return file.size > 5 * 1024 * 1024
    ? "Reading large file — this can take a few seconds, hang on..."
    : "Reading file...";
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

// Returns [{ name, rows() }] -- one entry per sheet, `rows()` lazily
// converts that sheet to a plain array-of-arrays of strings and caches the
// result, so a workbook with several sheets never converts more than the
// one that actually matches (converting a big sheet is the expensive part;
// earlier versions of this file called sheet_to_json on every sheet up
// front regardless of which one was needed).
//
// CSV files go through the lightweight parser in csv-parse.js rather than
// SheetJS: SheetJS's CSV path still builds a full spreadsheet "Sheet"
// object (one heavyweight cell entry per value) which measured at roughly
// 10x the source file's size in JS heap for a large catalog export.
//
// Real .xlsx/.xls/.xlsm files still need SheetJS -- there's no avoiding
// that for actual Excel binary formats -- but read with options that skip
// work this app never uses: `dense` stores cells as plain nested arrays
// instead of one JS object per cell address (a documented SheetJS option
// specifically for large files), and `cellHTML`/`cellFormula` (on by
// default) skip generating an HTML rendition and parsing formulas for
// every cell, neither of which anything here reads.
async function getSheets(file) {
  if (/\.csv$/i.test(file.name)) {
    const rows = parseCsvText(await file.text());
    return [{ name: file.name, rows: () => rows }];
  }
  const workbook = XLSX.read(await file.arrayBuffer(), {
    type: "array",
    dense: true,
    cellHTML: false,
    cellFormula: false,
    sheetStubs: false,
  });
  return workbook.SheetNames.map((name) => {
    let cached = null;
    return {
      name,
      rows: () => cached || (cached = XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1, defval: "", raw: false })),
    };
  });
}

// Scans each sheet's first 10 rows for one containing every required
// column (matched via findColumnIndex against normalizeHeader'd cells).
// `requiredColumns` is [{ key, candidates, blankFirst }] -- `blankFirst`
// lets a longer column name (e.g. "component description") get matched
// and excluded before a shorter one (e.g. "component") is searched for,
// so the short name's substring fallback doesn't match inside the long one.
// Returns { rows, headerRowIdx, indexes: { key: colIdx } } or null.
function findHeaderRow(sheets, requiredColumns) {
  for (const sheet of sheets) {
    const rows = sheet.rows();
    for (let r = 0; r < Math.min(rows.length, 10); r++) {
      let header = rows[r].map(normalizeHeader);
      const indexes = {};
      let allFound = true;
      for (const col of requiredColumns) {
        const idx = findColumnIndex(header, col.candidates);
        if (idx === -1) { allFound = false; break; }
        indexes[col.key] = idx;
        if (col.blankFirst) header = header.map((h, i) => (i === idx ? "" : h));
      }
      if (allFound) return { rows, headerRowIdx: r, indexes };
    }
  }
  return null;
}

function firstRowHeadersForError(sheets) {
  const first = (sheets[0] && sheets[0].rows()[0]) || [];
  const seen = first.map((h) => String(h || "").trim()).filter(Boolean);
  const sheetNote = sheets.length > 1 ? ` Checked all ${sheets.length} sheets (${sheets.map((s) => s.name).join(", ")}).` : "";
  return { seenText: seen.length ? seen.join(", ") : "(empty)", sheetNote };
}

// NCR number list: { number, title, location, description } rows.
// Description is optional; Number/Title/Location are required.
async function parseNcrListFile(file) {
  const sheets = await getSheets(file);
  const found = findHeaderRow(sheets, [
    { key: "number", candidates: ["number", "ncr number"] },
    { key: "title", candidates: ["title"] },
    { key: "location", candidates: ["location"] },
  ]);

  if (!found) {
    const { seenText } = firstRowHeadersForError(sheets);
    throw new Error(`Could not find columns named Number, Title, and Location. First row has: ${seenText}`);
  }

  const { rows, headerRowIdx, indexes } = found;
  const descIdx = findColumnIndex(rows[headerRowIdx].map(normalizeHeader), ["description"]);

  return rows.slice(headerRowIdx + 1)
    .map((row) => ({
      number: String(row[indexes.number] || "").trim(),
      title: String(row[indexes.title] || "").trim(),
      location: String(row[indexes.location] || "").trim(),
      description: descIdx !== -1 ? String(row[descIdx] || "").trim() : "",
    }))
    .filter((r) => r.number);
}

// Parses an uploaded parts catalogue (CSV or Excel) into { part, desc, rds }
// rows. Columns: Component, Component description, Rds code -- header row
// doesn't have to be row 1 or on the first sheet.
async function parsePartsXlsxFile(file) {
  const sheets = await getSheets(file);
  const found = findHeaderRow(sheets, [
    { key: "desc", candidates: ["component description", "description"], blankFirst: true },
    { key: "part", candidates: ["component"] },
    { key: "rds", candidates: ["rds code", "rds-pp code", "rds-pp", "rdspp", "rds"] },
  ]);

  if (!found) {
    const { seenText, sheetNote } = firstRowHeadersForError(sheets);
    throw new Error(`Could not find columns named Component, Component description, and Rds code.${sheetNote} First row has: ${seenText}`);
  }

  const { rows, headerRowIdx, indexes } = found;
  return rows.slice(headerRowIdx + 1)
    .map((row) => ({
      part: String(row[indexes.part] || "").trim(),
      desc: String(row[indexes.desc] || "").trim(),
      rds: String(row[indexes.rds] || "").trim(),
    }))
    .filter((r) => r.part || r.desc);
}

// Parses an uploaded/synced Status-templates file (CSV or Excel) into
// { name, text } rows -- same shape as what "Save as template" on the
// Completion tab writes. Columns: Name, Text.
async function parseStatusTemplatesFile(file) {
  const sheets = await getSheets(file);
  const found = findHeaderRow(sheets, [
    { key: "name", candidates: ["name"] },
    { key: "text", candidates: ["text"] },
  ]);

  if (!found) {
    const { seenText } = firstRowHeadersForError(sheets);
    throw new Error(`Could not find columns named Name and Text. First row has: ${seenText}`);
  }

  const { rows, headerRowIdx, indexes } = found;
  return rows.slice(headerRowIdx + 1)
    .map((row) => ({
      name: String(row[indexes.name] || "").trim(),
      text: String(row[indexes.text] || "").trim(),
    }))
    .filter((r) => r.name);
}
