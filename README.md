# NCR Completion

A phone version of the NCR Completion tab from the desktop tool ("ncr-report-generator") — same fields, same recipient logic, same NCR-number lookup, plus a Parts search tab, styled for a phone and added to your home screen.

It's a static web app ("PWA"), not an App Store app, and there's no build step, no sign-in, no server — just static files.

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

### 3. Load the NCR number list, parts list, and project contacts

All three live on the **Settings** tab. Two ways to load them, and you can mix both:

- **Upload a file directly** — CSV/Excel, same columns as the desktop tool: NCR list needs **Number**, **Title**, **Location** (Description optional); Parts list needs **Component**, **Component description**, **Rds code**. Column names are matched loosely, so small naming differences are fine.
- **Sync from GitHub** — edit `data/ncr-list.csv` or `data/parts.csv` in this repo (e.g. on github.com, from any device) and tap the matching **"Sync from GitHub"** button on the Settings tab to pull that version in. This is the way to keep the same list in sync across your phone and laptop without re-uploading a file on each one every time.

Either way is per-device storage under the hood (browser local storage / IndexedDB) — nothing here talks to a server on its own. Uploading a file only affects the device you uploaded it on; syncing from GitHub is what actually makes two devices end up with the same data, since they're both just fetching the same file.

Project contacts (LSM/LSC/Quality/Warehouse addresses) are only ever edited by hand on the Settings tab, per device — Baltic Power's addresses are pre-loaded (carried over from the desktop tool), so double check they're still correct.

## Using it

1. Pick the **Project** at the top if you have more than one (edit/add projects on the Settings tab).
2. On **Completion**: type the **NCR number** — if it matches the loaded list, Turbine location/Title fill in automatically, and Description shows up too (only when the list actually has one for that NCR).
3. Set **NCR status** (Completed/Updated) and write the **Status** (what was done). Save frequently-reused status text as a template with **Save as template**, and reload it later from the dropdown.
4. Set **Parts** — "Parts required" reveals a Part Number/Quantity table and adds the Warehouse address to recipients.
5. **Open Outlook & copy table for email** — copies the formatted table to your clipboard and opens Outlook with recipients + subject filled in. Paste, review, tap Send.
   - If Outlook isn't installed, tap **"Outlook didn't open? Try your default Mail app instead"**.
6. **Clear form** resets everything for the next NCR (project contacts and the loaded lists stay).
7. **Parts** tab: search the loaded parts list by part number, description, or RDS-PP code. Tap **VMS** on a result to copy its part number and open the VMS report.

## Notes

- Nothing here talks to a server on its own — everything on the Settings tab lives in this browser's local storage on this device, whether it got there by upload or by "Sync from GitHub". Syncing from GitHub is the one thing that's actually shared: it's just fetching a plain file over HTTP, so any device that syncs sees the same data.
- The subject line is `Turbine - NCR <number> - Status - Title` (title only appears if the NCR number matched something in the loaded list).
- Description is shown for reference only (and only when there is one) — deliberately left out of the email, matching the desktop tool.
- The desktop tool's PDF reference library (folders connected via the File System Access API) isn't included — Safari on iPhone doesn't support that browser API at all, so there's no way to port it as-is.
