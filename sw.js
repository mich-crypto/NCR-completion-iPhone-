// App-shell cache so the form still opens with no signal. Network-first,
// not cache-first: this app is under active development, and cache-first
// means a phone that already has it installed keeps serving old files
// forever unless CACHE_NAME below happens to get bumped on every single
// change (it didn't, repeatedly -- that's exactly the bug that made
// updates silently not show up). Network-first always prefers a fresh
// fetch when there's signal, and only falls back to the cached copy when
// there genuinely isn't one.
const CACHE_NAME = "ncr-shell-v5";
const SHELL_FILES = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/style.css",
  "./js/storage.js",
  "./js/xlsx-import.js",
  "./js/mailto.js",
  "./js/parts.js",
  "./js/app.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
