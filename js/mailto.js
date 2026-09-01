// Builds the plain-text NCR summary and the deep-link URLs that open it as a
// draft in Outlook (or the phone's default Mail app) with recipients,
// subject and body pre-filled. Neither URL scheme supports HTML formatting
// or attachments -- that's an iOS/Outlook limitation, not something a URL
// can work around -- so the body is plain text and photos are attached by
// hand once the draft is open.

// Plain-text version of the NCR table, e.g.:
//   NCR Number: NCR-2026-014
//   NCR Title: Loose bracket on conveyor guard
//   Status: Completed
//
//   Work Performed:
//   Replaced bracket, torqued to spec, re-inspected guard alignment.
//
//   Photos to attach (2):
//   - IMG_0001.jpg
//   - IMG_0002.jpg
function buildPlainTextBody({ ncrNumber, ncrTitle, status, workPerformed, photoNames }) {
  const lines = [
    `NCR Number: ${ncrNumber}`,
    `NCR Title: ${ncrTitle}`,
    `Status: ${status}`,
    "",
    "Work Performed:",
    workPerformed,
  ];

  if (photoNames.length) {
    lines.push("", `Photos to attach (${photoNames.length}):`);
    photoNames.forEach((name) => lines.push(`- ${name}`));
  }

  return lines.join("\n");
}

function buildOutlookUrl({ to, subject, body }) {
  const params = new URLSearchParams({ to: to.join(","), subject, body });
  return `ms-outlook://compose?${params.toString()}`;
}

function buildMailtoUrl({ to, subject, body }) {
  // Addresses go straight in the path, unencoded (they're already
  // restricted to plain email characters -- see looksLikeEmail() in app.js).
  const params = new URLSearchParams({ subject, body });
  return `mailto:${to.join(",")}?${params.toString()}`;
}
