/* =========================================================================
   Atul Birthday Card Studio — Service Worker
   Owns application-shell caching and offline readiness only. It never
   becomes a storage mechanism for private user media: photos and audio
   live exclusively in IndexedDB (see js/app.js AssetRepository) and are
   never fetched through this worker's cache.
   ========================================================================= */
"use strict";

const SW_VERSION = "v1.0.0";
const SHELL_CACHE = "atul-shell-" + SW_VERSION;
const RUNTIME_CACHE = "atul-runtime-" + SW_VERSION;

// Everything needed to open and use the editor while offline. Decorative
// stamp/foil/texture assets are generated procedurally in js/app.js rather
// than fetched, so there are no binary decorative assets to list here.
const SHELL_ASSETS = [
  "./",
  "./index.html",
  "./css/styles.css",
  "./js/app.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-192-maskable.png",
  "./icons/icon-512-maskable.png",
  "./icons/apple-touch-icon.png",
  "./icons/favicon-32.png",
  "./icons/favicon-16.png",
];

const RUNTIME_CACHE_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      // Cache shell assets individually so one missing file (e.g. during
      // local development) doesn't fail the entire install.
      await Promise.all(
        SHELL_ASSETS.map(async (url) => {
          try {
            await cache.add(url);
          } catch (err) {
            console.warn("[sw] Could not precache", url, err);
          }
        })
      );
      self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key !== SHELL_CACHE && key !== RUNTIME_CACHE)
          .map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

function isShellRequest(url) {
  return url.origin === self.location.origin;
}

function isRuntimeCacheableHost(url) {
  return RUNTIME_CACHE_HOSTS.includes(url.hostname);
}

// Private user media (photo/audio blobs) never travels through fetch() at
// all — it lives in IndexedDB and is read via URL.createObjectURL, which
// this worker never intercepts. This guard is defense-in-depth in case a
// future blob: or data: request reaches here.
function isPrivateMediaRequest(url) {
  return url.protocol === "blob:" || url.protocol === "data:";
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (isPrivateMediaRequest(url)) return;

  if (isShellRequest(url)) {
    // Stale-while-revalidate for the versioned app shell: instant loads
    // from cache, with a background refresh for next time.
    event.respondWith(
      (async () => {
        const cache = await caches.open(SHELL_CACHE);
        const cached = await cache.match(request, { ignoreSearch: true });
        const network = fetch(request)
          .then((response) => {
            if (response && response.ok) cache.put(request, response.clone());
            return response;
          })
          .catch(() => null);
        if (cached) {
          network.catch(() => {});
          return cached;
        }
        const networkResponse = await network;
        if (networkResponse) return networkResponse;
        if (request.mode === "navigate") {
          const fallback = await cache.match("./index.html");
          if (fallback) return fallback;
        }
        return new Response("Offline and this resource was not cached yet.", { status: 503 });
      })()
    );
    return;
  }

  if (isRuntimeCacheableHost(url)) {
    // Cache-first for immutable-ish decorative/runtime assets (Google Fonts
    // CSS + font files): fast after the first successful online load, and
    // available offline afterward.
    event.respondWith(
      (async () => {
        const cache = await caches.open(RUNTIME_CACHE);
        const cached = await cache.match(request);
        if (cached) return cached;
        try {
          const response = await fetch(request);
          if (response && (response.ok || response.type === "opaque")) {
            cache.put(request, response.clone());
          }
          return response;
        } catch (err) {
          return cached || new Response("", { status: 504 });
        }
      })()
    );
  }
});
