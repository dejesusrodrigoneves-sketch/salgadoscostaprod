const CACHE = 'salgadoscosta-v1';

const PRECACHE = [
  '/',
  '/index.html',
  '/login.html',
  '/dashboard.html',
  '/css/style.css',
  '/css/cart.css',
  '/js/firebase-init.js',
  '/js/utils.js',
  '/js/core/api.js',
  '/js/core/auth.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.pathname.startsWith('/@') || url.pathname.startsWith('/api')) return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetched = fetch(event.request).then((response) => {
        if (response.ok && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, clone).catch(() => {}));
        }
        return response;
      }).catch(() => cached);
      return cached || fetched || new Response('', { status: 204 });
    })
  );
});
