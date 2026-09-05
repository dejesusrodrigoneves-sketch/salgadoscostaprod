/**
 * Firebase Messaging Service Worker
 * Handles background push notifications
 */
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');
importScripts('./firebase-config.js');

const firebaseConfig = self.FIREBASE_CONFIG || {};

// Only initialize when real config present
if (firebaseConfig.apiKey && firebaseConfig.apiKey !== 'YOUR_API_KEY') {
  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();

  // Handle background messages
  messaging.onBackgroundMessage((payload) => {
    console.log('[SW] Background message:', payload);

    const { title, body } = payload.notification || {};
    if (!title) return;

    self.registration.showNotification(title, {
      body: body || '',
      icon: '/icons/manifest-icon.png',
      badge: '/icons/manifest-icon.png',
      vibrate: [200, 100, 200],
      data: payload.data,
      actions: [
        { action: 'open', title: 'Ver pedido' },
        { action: 'dismiss', title: 'Dispensar' },
      ],
    });
  });
}

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      // Focus existing window if available
      const existing = clients.find((c) => c.url.includes('entregador-app'));
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
        ? '/entregador-app.html#/pedidos'
        : '/entregador-app.html';
      return self.clients.openWindow(url);
    })
  );
});