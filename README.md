# NCR Completion

A phone version of the NCR Completion tab from the desktop tool ("ncr-report-generator") — same fields, same recipient logic, same NCR-number lookup, styled for a phone and added to your home screen.

It's a static web app ("PWA"), not an App Store app, and there's no build step, no sign-in, no server — just static files. Data (the uploaded NCR list, project contacts, saved statuses) lives only in your phone's browser storage.

## Why it's "copy the table" instead of a fully automatic send

Apple doesn't let any third-party app silently finish an action inside another app (like hitting Send in Outlook) — a sandboxing rule for every app, not a limitation of this one. So this app does what the desktop tool already does: copies the completion table to your clipboard as **real formatted content** (not plain text — Outlook's compose body is rich text, so pasting renders an actual table), then opens Outlook with the recipients and subject already filled in. You paste (Cmd/Ctrl+V) and tap Send.

## Setup

### 1. Host the app

Any static file host works. For GitHub Pages:

1. Repo → **Settings → Pages**.
2. **Build and deployment → Source**: "Deploy from a branch".
3. Branch: `main`, folder `/ (root)`. Save.
4. GitHub gives you a URL like `https://<user>.github.io/<repo>/`.

### 2. Add to your home screen

Open that URL in **Safari** on your iPhone → **Share → Add to Home Screen**.

### 3. Load your NCR number list

Open the **"NCR list & project contacts"** panel at the top and upload the same CSV/Excel file you already use in the desktop tool — columns named **Number**, **Title**, **Location** (Description is optional; column names are matched loosely, so small naming differences are fine). This powers the auto-fill: type an NCR number and Turbine location + Title + Description fill in from the list.

### 4. Check project contacts

Baltic Power's LSM/LSC/Quality/Warehouse addresses are pre-loaded (carried over from the desktop tool) — double check they're still correct. Add more projects with **+ Add project** if needed. Recipients on send = LSM + LSC + Quality, plus Warehouse whenever "Parts required" is selected.

## Using it

1. Pick the **Project** at the top if you have more than one.
2. Type the **NCR number** — if it matches the uploaded list, Turbine location/Title/Description fill in automatically.
3. Set **NCR status** (Completed/Updated) and write the **Status** (what was done). Save frequently-reused status text as a template with **Save as template**, and reload it later from the dropdown.
4. Set **Parts** — "Parts required" reveals a Part Number/Quantity table and adds the Warehouse address to recipients.
5. **Open Outlook & copy table for email** — copies the formatted table to your clipboard and opens Outlook with recipients + subject filled in. Paste, review, tap Send.
   - If Outlook isn't installed, tap **"Outlook didn't open? Try your default Mail app instead"**.
6. **Clear form** resets everything for the next NCR (project contacts and the NCR list stay loaded).

## Notes

- Nothing here talks to a server — the NCR list, project contacts, and saved statuses live only in this browser's local storage on your phone. Re-upload the NCR list here if you update it on the desktop tool; the two don't sync automatically.
- The subject line is `Turbine - NCR <number> - Status - Title` (title only appears if the NCR number matched something in the uploaded list).
- Description is shown for reference only and is deliberately left out of the email — matches the desktop tool.
