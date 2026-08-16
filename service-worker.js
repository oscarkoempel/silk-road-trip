/* Rian's Silk Road Adventures — service worker
 * Strategy:
 *  - App shell (this HTML file, manifest, icons, fonts, Leaflet, Tailwind):
 *    cache-first, so the app opens instantly and works offline. Each of
 *    these is refreshed in the background on every visit (stale-while-
 *    revalidate) so a newer deploy is picked up without blocking the load.
 *  - Map tiles: cache-first too, but capped in size — every tile you've
 *    ever panned/zoomed over stays available offline, older ones are
 *    trimmed once the cache grows large.
 *  - Everything else (e.g. the live exchange-rate API): network-only.
 *    The app already has a static fallback built in for when that fails.
 *
 * Bump CACHE_VERSION whenever index.html (or anything precached) changes,
 * so clients pick up the new copy instead of a stale cached one.
 */
const CACHE_VERSION = 'v6';
const APP_CACHE = `rian-silk-road-app-${CACHE_VERSION}`;
const TILE_CACHE = `rian-silk-road-tiles-${CACHE_VERSION}`;
const TILE_CACHE_MAX_ENTRIES = 400;

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-180.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png',
  './icons/favicon-32.png',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500&family=Outfit:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap',
];

const TILE_HOST = 'basemaps.cartocdn.com';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(APP_CACHE).then((cache) =>
      // Individual failures (e.g. one font file blocked) shouldn't stop the
      // whole install — the app still works, just re-fetches that one thing.
      Promise.all(
        APP_SHELL.map((url) =>
          cache.add(new Request(url, { mode: url.startsWith('http') ? 'no-cors' : 'same-origin' })).catch(() => {})
        )
      )
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((name) => name !== APP_CACHE && name !== TILE_CACHE)
          .map((name) => caches.delete(name))
      )
    ).then(() => self.clients.claim())
  );
});

function trimTileCache(cache){
  cache.keys().then((keys) => {
    if (keys.length <= TILE_CACHE_MAX_ENTRIES) return;
    const excess = keys.length - TILE_CACHE_MAX_ENTRIES;
    for (let i = 0; i < excess; i++) cache.delete(keys[i]); // oldest-first insertion order
  });
}

// Cache-first, refresh-in-background. Used for the app shell: instant from
// cache, while a network copy quietly updates the cache for next time.
function staleWhileRevalidate(request, cacheName){
  return caches.open(cacheName).then((cache) =>
    cache.match(request).then((cached) => {
      const network = fetch(request).then((response) => {
        if (response && (response.ok || response.type === 'opaque')) {
          cache.put(request, response.clone());
        }
        return response;
      }).catch(() => cached);
      return cached || network;
    })
  );
}

// Pure cache-first for map tiles, with size capping — no need to re-fetch
// a tile that's already on disk just because we're back online.
function cacheFirstTile(request){
  return caches.open(TILE_CACHE).then((cache) =>
    cache.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response && (response.ok || response.type === 'opaque')) {
          cache.put(request, response.clone());
          trimTileCache(cache);
        }
        return response;
      }).catch(() => cached);
    })
  );
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Map tiles — cache-first, capped.
  if (url.hostname === TILE_HOST) {
    event.respondWith(cacheFirstTile(request));
    return;
  }

  // Navigating to the app itself — always try to serve the shell so a
  // deep link or a relaunch from the home screen works offline too.
  if (request.mode === 'navigate') {
    event.respondWith(
      staleWhileRevalidate(request, APP_CACHE).catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Everything the app shell depends on (fonts, Leaflet, Tailwind, icons,
  // manifest) — cache-first with background refresh.
  const isAppShellAsset =
    APP_SHELL.includes(request.url) ||
    url.origin === self.location.origin ||
    url.hostname === 'fonts.googleapis.com' ||
    url.hostname === 'fonts.gstatic.com' ||
    url.hostname === 'unpkg.com' ||
    url.hostname === 'cdn.tailwindcss.com';

  if (isAppShellAsset) {
    event.respondWith(staleWhileRevalidate(request, APP_CACHE));
    return;
  }

  // Anything else (e.g. the exchange-rate API) — let it hit the network
  // as normal; the app already has its own offline fallback for this.
});
