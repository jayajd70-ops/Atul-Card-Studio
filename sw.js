/* =========================================================================
   Atul Card Studio — Service Worker
   Owns application-shell caching and offline readiness only. It never
   becomes a storage mechanism for private user media: photos and audio
   live exclusively in IndexedDB (see js/app.js AssetRepository) and are
   never fetched through this worker's cache.
   ========================================================================= */
"use strict";

// Kept in step with APP_VERSION in js/app.js: bumping either one must
// bump the other, since the cache name is what forces clients onto a
// freshly released shell.
const SW_VERSION = "v1.19.0";
const SHELL_CACHE = "atul-shell-" + SW_VERSION;

// Everything needed to open and use the editor while offline. User photos
// remain private in IndexedDB; these bundled photographic centrepieces are
// public application assets and are safe to precache.
const SHELL_ASSETS = [
  "./",
  "./index.html",
  "./css/styles.css",
  "./css/fonts.css",
  "./js/app.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-192-maskable.png",
  "./icons/icon-512-maskable.png",
  "./icons/apple-touch-icon.png",
  "./icons/favicon-32.png",
  "./icons/favicon-16.png",
  "./assets/centerpieces/belgian-gold-cake.png",
  "./assets/centerpieces/velvet-roses.png",
  "./assets/centerpieces/silk-gift-box.png",
  "./assets/centerpieces/baby-teddy.png",
  "./assets/centerpieces/newborn-hand-feet.png",
  "./assets/centerpieces/birthday-floral-cake.png",
  "./assets/centerpieces/anniversary-floral-cake.png",
  "./assets/centerpieces/congratulations-laurel.png",
  "./assets/centerpieces/new-home-welcome.png",
  "./assets/centerpieces/graduation-diploma.png",
  "./assets/centerpieces/retirement-compass.png",
  "./assets/centerpieces/get-well-comfort.png",
  "./assets/centerpieces/thanks-note.png",
  "./assets/centerpieces/diwali-diyas.png",
  "./assets/centerpieces/champagne-gala.png",
  "./assets/centerpieces/white-lilies.png",
  "./assets/decorations/white-lilies-corner.png",
  "./assets/decorations/sage-foliage-corner.png",
  "./assets/decorations/slate-botanical-corner.png",
  "./assets/decorations/navy-botanical-accent.png",

  // Self-hosted web fonts. These are precached rather than runtime-cached so
  // the very first load works with no network at all: the canvas renderer
  // measures text against these exact faces, and falling back to system fonts
  // would change every fitted font size and line break.
  "./fonts/cinzel-500-latin-ext.woff2",
  "./fonts/cinzel-500-latin.woff2",
  "./fonts/cormorant-garamond-500-latin-ext.woff2",
  "./fonts/cormorant-garamond-500-latin.woff2",
  "./fonts/dm-serif-display-400-latin-ext.woff2",
  "./fonts/dm-serif-display-400-latin.woff2",
  "./fonts/inter-400-latin-ext.woff2",
  "./fonts/inter-400-latin.woff2",
  "./fonts/libre-baskerville-400-latin-ext.woff2",
  "./fonts/libre-baskerville-400-latin.woff2",
  "./fonts/manrope-400-latin-ext.woff2",
  "./fonts/manrope-400-latin.woff2",
  "./fonts/montserrat-500-latin-ext.woff2",
  "./fonts/montserrat-500-latin.woff2",
  "./fonts/playfair-display-500-latin-ext.woff2",
  "./fonts/playfair-display-500-latin.woff2",
  "./fonts/source-sans-3-400-latin-ext.woff2",
  "./fonts/source-sans-3-400-latin.woff2",
  "./fonts/work-sans-400-latin-ext.woff2",
  "./fonts/work-sans-400-latin.woff2",
];

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
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key !== SHELL_CACHE)
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

// Festival artwork is intentionally omitted from SHELL_ASSETS. The existing
// same-origin strategy below caches an artwork after its first online use,
// keeping it available offline without making every installation download the
// complete festival collection.

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
          .then(async (response) => {
            if (response && response.ok) await cache.put(request, response.clone());
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

  // Nothing else is fetched cross-origin: the type library is self-hosted and
  // user media never travels through fetch(). Anything unexpected falls
  // through to the network untouched.
});
