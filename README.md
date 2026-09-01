# NCR Completion Email

A small app that lives on your iPhone home screen. Fill in the NCR fields,
tap **Open in Outlook**, and it opens a new Outlook draft with the recipients,
subject and NCR details already filled in — you attach the photos and tap
Send yourself.

It's a static web app ("PWA"), not an App Store app, and there's no build
step, no sign-in, and nothing to configure — these are the exact files that
get served to your phone.

## Why you still tap Send yourself

Apple doesn't let any third-party app silently finish an action inside
another app (like hitting Send in Outlook) — that's a sandboxing rule for
every app, not a limitation of this one. Handing off a pre-filled draft is as
far as that's allowed to go. For the same reason, the draft's body is plain
text rather than a formatted table, and photos can't be attached
automatically — Outlook's link-based compose only accepts To/Subject/Body
text, not attachments or HTML.

## Setup

1. Get the app hosted somewhere your iPhone can open it (see **Hosting**
   below), or ask whoever set this up for the link.
2. Open that link in **Safari** on your iPhone.
3. Tap the **Share** button → **Add to Home Screen**.
4. That's it — it now behaves like a normal app icon, opens full-screen, and
   works offline (opening Outlook still needs Outlook installed, of course).

### Hosting (for whoever's deploying this)

Any static file host works — it's just the files in this folder, served
as-is. For GitHub Pages:

1. In this repo on GitHub: **Settings → Pages**.
2. **Build and deployment → Source**: "Deploy from a branch".
3. Pick the branch these files are on, folder `/ (root)`. Save.
4. GitHub gives you a URL like `https://<user>.github.io/<repo>/` — that's
   the link to open in Safari and add to the home screen.

## Using it

1. Fill in NCR Number, NCR Title, Status, Work Performed.
2. Add photos with the **Photos** field — this is just a reminder checklist
   of what to attach; it lists the file names in the preview and in the
   Outlook draft's body so you don't forget one.
3. Add one or more recipient emails — tick "Remember this recipient list" to
   make it the default next time (you can still add/remove per NCR).
4. **Preview** to see exactly what text will land in the draft.
5. **Open in Outlook** — Outlook opens with To/Subject/Body already filled
   in. Attach the listed photos and tap **Send**.
   - If Outlook isn't installed (or the link doesn't do anything), tap
     "Outlook didn't open? Try your default Mail app instead" underneath —
     same draft, opened as a regular `mailto:` link.
6. **New NCR** clears the form for the next one (recipients are kept).

## Notes

- Nothing here talks to a server — recipients you choose to remember are
  saved only in the browser's local storage on your phone.
- Photos you pick are only used to build the on-screen reminder checklist;
  they are never uploaded or attached automatically.
