// Service Worker for PWA — network-first strategy
const CACHE = 'vibelink-v2';

self.addEventListener('install', (e) => {
  self.skipWaiting();
  (e as any).waitUntil(
    caches.open(CACHE).then((cache) => {
      return cache.addAll(['/']);
    })
  );
});

self.addEventListener('activate', (e) => {
  (e as any).waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    })
  );
});

self.addEventListener('fetch', (e: any) => {
  // Skip cross-origin requests
  if (!e.request.url.startsWith(self.location.origin)) return;
  e.respondWith(
    fetch(e.request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE).then((cache) => cache.put(e.request, clone));
        return response;
      })
      .catch(() => caches.match(e.request))
  );
});
