// Builds the email table (HTML + plain text), copies it to the clipboard
// as rich content, and hands off to Outlook/Mail with recipients and
// subject pre-filled. Outlook's link-based compose can't be pre-filled
// with a formatted table or attachments -- that's the platform limit --
// so instead: copy a real HTML table to the clipboard (Outlook's compose
// body is rich-text, so a paste renders as an actual table, not plain
// text), then open a draft with To/Subject already set. You paste once
// (Cmd/Ctrl+V) and tap Send.

function escapeHtmlAttr(str) {
  return String(str ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Same as escapeHtmlAttr but turns newlines into <br> -- otherwise a
// textarea's line breaks collapse into one run-on line in a table cell.
// <br> survives pasting into Outlook far more reliably than CSS white-space.
function textToHtmlCell(str) {
  return escapeHtmlAttr(str).replace(/\n/g, "<br>");
}

function buildPartsRowsHtml(parts) {
  if (!parts.length) return "";
  const rows = parts.map((p) =>
    `<tr><td style="border:1px solid #ccc;padding:4px 8px;">${escapeHtmlAttr(p.part)}</td><td style="border:1px solid #ccc;padding:4px 8px;">${escapeHtmlAttr(p.qty)}</td></tr>`
  ).join("");
  return `
    <tr><td colspan="2" style="padding-top:10px;">
      <table border="1" cellpadding="4" cellspacing="0" style="border-collapse:collapse;width:100%;table-layout:fixed;word-break:break-word;overflow-wrap:anywhere;font-family:Arial,sans-serif;">
        <tr><th style="background-color:#d9e1f2;border:1px solid #ccc;padding:4px 8px;text-align:left;">Part Number</th><th style="background-color:#d9e1f2;border:1px solid #ccc;padding:4px 8px;text-align:left;">Quantity</th></tr>
        ${rows}
      </table>
    </td></tr>`;
}

function buildTableHtml({ turbineLocation, ncrNumber, ncrTitle, ncrStatus, status, partsUsed, parts }) {
  return `
    <div style="font-family:Arial,sans-serif;font-size:14px;color:#000;">
      <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%;max-width:800px;table-layout:fixed;word-break:break-word;overflow-wrap:anywhere;border:1px solid #ccc;font-family:Arial,sans-serif;">
        <tr><td style="background-color:#f2f2f2;font-weight:bold;width:40%;">Turbine location:</td><td>${textToHtmlCell(turbineLocation)}</td></tr>
        <tr><td style="background-color:#f2f2f2;font-weight:bold;">NCR number:</td><td>${textToHtmlCell(ncrNumber)}</td></tr>
        ${ncrTitle ? `<tr><td style="background-color:#f2f2f2;font-weight:bold;">NCR title:</td><td>${escapeHtmlAttr(ncrTitle)}</td></tr>` : ""}
        <tr><td style="background-color:#f2f2f2;font-weight:bold;">NCR status:</td><td>${textToHtmlCell(ncrStatus)}</td></tr>
        <tr><td style="background-color:#f2f2f2;font-weight:bold;">Status:</td><td>${textToHtmlCell(status)}</td></tr>
        <tr><td style="background-color:#f2f2f2;font-weight:bold;">Parts:</td><td>${escapeHtmlAttr(partsUsed)}</td></tr>
        ${buildPartsRowsHtml(parts)}
      </table>
    </div>`;
}

function buildTablePlainText({ turbineLocation, ncrNumber, ncrTitle, ncrStatus, status, partsUsed, parts }) {
  const lines = [
    `Turbine location: ${turbineLocation}`,
    `NCR number: ${ncrNumber}`,
    ...(ncrTitle ? [`NCR title: ${ncrTitle}`] : []),
    `NCR status: ${ncrStatus}`,
    `Status: ${status}`,
    `Parts: ${partsUsed}`,
  ];
  if (parts.length) {
    lines.push("", "Parts required:");
    parts.forEach((p) => lines.push(`  ${p.part} — qty ${p.qty}`));
  }
  return lines.join("\n");
}

function buildSubjectText({ turbineLocation, ncrNumber, ncrStatus, ncrTitle }) {
  return [turbineLocation, `NCR ${ncrNumber}`, ncrStatus, ncrTitle].filter(Boolean).join(" - ");
}

// Copies both a real HTML table (so pasting into Outlook/Mail renders an
// actual table) and a plain-text fallback, in one clipboard write.
async function copyRichTable(html, plainText) {
  if (navigator.clipboard && typeof window.ClipboardItem !== "undefined") {
    try {
      const item = new ClipboardItem({
        "text/html": new Blob([html], { type: "text/html" }),
        "text/plain": new Blob([plainText], { type: "text/plain" }),
      });
      await navigator.clipboard.write([item]);
      return true;
    } catch (err) {
      console.warn("Clipboard write failed:", err);
    }
  }
  return false;
}

function buildOutlookUrl({ to, subject }) {
  const params = new URLSearchParams({ to: to.join(","), subject });
  return `ms-outlook://compose?${params.toString()}`;
}

function buildMailtoUrl({ to, subject }) {
  const params = new URLSearchParams({ subject });
  return `mailto:${to.join(",")}?${params.toString()}`;
}
