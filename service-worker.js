const CACHE_NAME = 'nissi-app-v1';
const APP_SHELL = [
  './',
  './index.html',
  './style.css',
  './assets/logo.webp',
  './assets/app-icon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => Promise.all(
        cacheNames
          .filter((cacheName) => cacheName.startsWith('nissi-app-') && cacheName !== CACHE_NAME)
          .map((cacheName) => caches.delete(cacheName))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);
  if (event.request.method !== 'GET' || requestUrl.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (!response.ok) return response;

        return caches.open(CACHE_NAME)
          .then((cache) => cache.put(event.request, response.clone()))
          .then(() => response)
          .catch((error) => {
            console.error('Service worker cache update failed:', error);
            return response;
          });
      })
      .catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        return (await cache.match(event.request))
          || (event.request.mode === 'navigate' ? cache.match('./index.html') : undefined)
          || Response.error();
      })
  );
});
