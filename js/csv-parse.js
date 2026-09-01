// A minimal, low-memory CSV parser used instead of SheetJS for .csv
// uploads/syncs. SheetJS's CSV path still builds a full spreadsheet "Sheet"
// object -- one heavyweight cell entry per value, addressed by A1-style
// keys -- which is many times larger in memory than the source text (a
// 25MB parts-catalog CSV measured at ~250MB of JS heap and froze the tab
// for several seconds; on an iPhone that's enough to trip Safari's
// out-of-memory/unresponsive-page kill, which is what "the site crashes"
// on a big upload actually was). This walks the text once and returns
// plain arrays of strings -- same shape XLSX.utils.sheet_to_json(sheet,
// {header:1}) produces -- so it drops straight into the existing
// header-detection/column-mapping code unchanged.
//
// Handles RFC 4180 quoting: fields wrapped in "..." may contain commas,
// newlines, and "" as an escaped quote. \r\n, \r, and \n line endings.
function parseCsvText(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  const len = text.length;

  for (let i = 0; i < len; i++) {
    const c = text[i];

    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += c;
      }
      continue;
    }

    if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      row.push(field);
      rows.push(row);
      field = "";
      row = [];
      if (c === "\r" && text[i + 1] === "\n") i++; // consume paired \r\n as one line break
    } else {
      field += c;
    }
  }
  // Last field/row if the file doesn't end with a line break.
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }

  // Drop fully-empty trailing rows (common with a trailing newline).
  while (rows.length && rows[rows.length - 1].every((c) => c === "")) rows.pop();

  return rows;
}
