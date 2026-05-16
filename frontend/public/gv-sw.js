/**
 * Global Vibez DSG — Offline asset cache service worker.
 *
 * Caches the app shell + critical static assets so a flaky connection
 * doesn't blank the page on navigation. Separate from the FCM SW
 * (`firebase-messaging-sw.js`) which handles push notifications.
 *
 * Strategy:
 *  - Cache-first for static assets (images, fonts, the tour video).
 *  - Network-first for HTML + API calls (falls back to cache only if the
 *    network is fully down).
 *  - Skip /api requests entirely — they're not cacheable safely.
 *
 * Versioned cache: bumping CACHE_VERSION evicts old caches on activate.
 */
const CACHE_VERSION = "gv-v2-20260516-nova";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

// Bumping the CACHE_VERSION above will evict every prior cache the
// moment this SW activates. Returning users will refetch the new Nova
// narration MP3 from the network on the next page load, no matter what
// stale Onyx-voice copy they had in IndexedDB / Cache Storage.
const PRECACHE_URLS = [
  "/",
  "/index.html",
  "/global-vibez-logo.png",
  "/landing-tour-narration-en.mp3?v=nova-2026-05-16",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .catch(() => null) // best-effort; first-load failures shouldn't block install
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => !k.startsWith(CACHE_VERSION))
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only handle GET — never cache POST/PUT/DELETE.
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Don't touch API traffic. Backend handles its own caching headers.
  if (url.pathname.startsWith("/api/")) return;

  // Don't intercept cross-origin (Stripe, Firebase, Jitsi, etc.).
  if (url.origin !== self.location.origin) return;

  // Network-first for HTML navigation so users always get the latest shell.
  if (request.mode === "navigate" || request.destination === "document") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(RUNTIME_CACHE).then((c) => c.put(request, copy)).catch(() => null);
          return res;
        })
        .catch(() => caches.match(request).then((r) => r || caches.match("/index.html")))
    );
    return;
  }

  // Cache-first for static assets.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((res) => {
          if (!res || res.status !== 200 || res.type === "opaque") return res;
          const copy = res.clone();
          caches.open(RUNTIME_CACHE).then((c) => c.put(request, copy)).catch(() => null);
          return res;
        })
        .catch(() => cached);
    })
  );
});
