// Parses an uploaded CSV/Excel file of NCR numbers into { number, title,
// location, description } rows. Same forgiving column matching as the
// desktop tool this is modeled on, so the exact same file you already use
// there can be uploaded here unchanged: header row doesn't have to be row
// 1, column names just need to contain "number"/"title"/"location" (case
// and extra-whitespace insensitive), Description is optional.

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
