/**
 * Firebase Messaging Service Worker
 * Handles background push notifications
 *
 * SETUP: Firebase SDK loaded from CDN
 */
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

// Firebase config — UPDATE THESE VALUES from your Firebase project
const firebaseConfig = {
  apiKey: 'YOUR_API_KEY',
  authDomain: 'YOUR_PROJECT.firebaseapp.com',
  projectId: 'YOUR_PROJECT_ID',
  storageBucket: 'YOUR_PROJECT.appspot.com',
  messagingSenderId: 'YOUR_SENDER_ID',
  appId: 'YOUR_APP_ID',
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[SW] Background message:', payload);

  const { title, body } = payload.notification || {};
  if (!title) return;

  self.registration.showNotification(title, {
    body: body || '',
    icon: '/entregador/manifest-icon.png',
    badge: '/entregador/manifest-icon.png',
    vibrate: [200, 100, 200],
    data: payload.data,
    actions: [
      { action: 'open', title: 'Ver pedido' },
      { action: 'dismiss', title: 'Dispensar' },
    ],
  });
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      // Focus existing window if available
      const existing = clients.find((c) => c.url.includes('entregador'));
      if (existing) {
        existing.focus();
        // Navigate to orders if new order
        if (event.notification.data?.type === 'new_order') {
          existing.postMessage({ type: 'navigate', screen: 'pedidos' });
        }
        return;
      }

      // Open new window
      const url = event.notification.data?.pedidoId
        ? `/entregador/entregador-app.html#/pedidos`
        : `/entregador/entregador-app.html`;
      return self.clients.openWindow(url);
    })
  );
});
