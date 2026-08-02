// Service Worker for PWA
const CACHE = 'vibelink-v1';

self.addEventListener('install', (e) => {
  (e as any).waitUntil(
    caches.open(CACHE).then((cache) => {
      return cache.addAll(['/', '/chat', '/history', '/settings']);
    })
  );
});

self.addEventListener('fetch', (e: any) => {
  e.respondWith(
    caches.match(e.request).then((cached) => {
      return cached || fetch(e.request);
    })
  );
});
