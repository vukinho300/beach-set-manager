const CACHE_NAME = 'beach-set-manager-v2';
const PRESERVED_RECOVERY_CACHE = 'beach-set-manager-v1';
const APP_SHELL = ['/', '/manifest.webmanifest', '/icons/icon.svg', '/icons/maskable-icon.svg'];

function isSameOriginGet(request) {
  return request.method === 'GET' && new URL(request.url).origin === self.location.origin;
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      // Keep v1 temporarily: an affected device may contain the only cached
      // copy of an incident-era location_state response. The v2 worker never
      // reads it for normal requests; the in-app recovery scanner is read-only.
      .then((keys) => Promise.all(keys
        .filter((key) => key !== CACHE_NAME && key !== PRESERVED_RECOVERY_CACHE)
        .map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  // Never intercept or cache Supabase/Auth/API traffic. A cached location_state
  // response can look like a current authoritative row during a weak connection.
  if (!isSameOriginGet(event.request)) {
    return;
  }

  event.respondWith(
    fetch(event.request, { cache: 'no-store' })
      .then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }

        return response;
      })
      .catch(() => {
        if (event.request.mode === 'navigate') {
          return caches.match('/');
        }

        return caches.match(event.request);
      }),
  );
});
