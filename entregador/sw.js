const CACHE_NAME = 'sic-entregador-v2';
const STATIC_ASSETS = [
  '/entregador-login.html',
  '/entregador-app.html',
  '/login.html',
  '/css/entregador.css',
  '/js/api.js',
  '/js/auth.js',
  '/js/orders.js',
  '/js/confirm.js',
  '/js/history.js',
  '/js/profile.js',
  '/js/app.js',
  '/js/offline.js',
  '/js/push.js',
  '/manifest.json',
];

// Install: cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: network-first for API, cache-first for static
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // API calls: network-first
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  // Never cache non-GET
  if (event.request.method !== 'GET') return;

  // Static assets: cache-first
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});

// Push notification handler
self.addEventListener('push', (event) => {
  const data = event.data?.json() || { title: 'Novo pedido', body: 'Você tem um novo pedido atribuído' };
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icons/manifest-icon.png',
      badge: '/icons/manifest-icon.png',
      data: data,
    })
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      const existing = clients.find((c) => c.url.includes('entregador-app'));
      if (existing) return existing.focus();
      return self.clients.openWindow('/entregador-app.html');
    })
  );
});