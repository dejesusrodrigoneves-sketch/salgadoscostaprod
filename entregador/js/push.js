/**
 * Push notification module for delivery driver app
 * Handles FCM token registration and foreground messages
 *
 * SETUP REQUIRED:
 * 1. Add Firebase SDK to entregador-app.html:
 *    <script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js"></script>
 *    <script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js"></script>
 * 2. Add Firebase config (from Firebase Console → Project Settings → Your apps)
 */

const EntregadorPush = {
  messaging: null,
  vapidKey: null, // Set from env or hardcoded

  async init() {
    // Check if Firebase is loaded
    if (typeof firebase === 'undefined') {
      console.warn('[Push] Firebase SDK not loaded — push notifications disabled');
      return;
    }

    // Check if already initialized
    if (this.messaging) return;

    try {
      // Firebase config from shared firebase-config.js
      const firebaseConfig = window.FIREBASE_CONFIG || {};
      this.vapidKey = window.FIREBASE_VAPID_KEY || '';

      // Skip if no real config yet
      if (!firebaseConfig.apiKey || firebaseConfig.apiKey === 'YOUR_API_KEY') {
        console.warn('[Push] Firebase não configurado — push desabilitado');
        return;
      }

      // Register the FCM service worker
      const swRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');

      // Initialize Firebase
      if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
      }
      this.messaging = firebase.messaging();

      // Request permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        console.warn('[Push] Notification permission denied');
        return;
      }

      // Get FCM token
      const token = await this.messaging.getToken({
        vapidKey: this.vapidKey,
        serviceWorkerRegistration: swRegistration,
      });

      if (token) {
        console.log('[Push] FCM token obtained:', token.substring(0, 20) + '...');
        // Register with server
        try {
          await EntregadorAPI.registerPush(token);
          console.log('[Push] Token registered with server');
        } catch (err) {
          console.error('[Push] Failed to register token:', err.message);
        }
      }

      // Handle foreground messages
      this.messaging.onMessage((payload) => {
        console.log('[Push] Foreground message:', payload);
        this.showForegroundNotification(payload);
      });

      // Handle token refresh
      this.messaging.onTokenRefresh(async () => {
        try {
          const newToken = await this.messaging.getToken();
          if (newToken) {
            await EntregadorAPI.registerPush(newToken);
            console.log('[Push] Token refreshed and registered');
          }
        } catch (err) {
          console.error('[Push] Token refresh failed:', err.message);
        }
      });

    } catch (err) {
      console.error('[Push] Init failed:', err.message);
    }
  },

  showForegroundNotification(payload) {
    const { title, body } = payload.notification || {};
    if (!title) return;

    // Show in-app notification
    const notif = document.createElement('div');
    notif.className = 'push-notif';
    notif.style.cssText = `
      position: fixed; top: 16px; right: 16px; left: 16px; z-index: 300;
      animation: slideDown 0.3s ease;
    `;
    notif.innerHTML = `
      <div class="app-name">📦 SIC.ia Entregador</div>
      <div class="notif-title">${title}</div>
      <div class="notif-body">${body || ''}</div>
    `;
    document.body.appendChild(notif);

    // Auto-dismiss after 5s
    setTimeout(() => {
      notif.style.animation = 'slideUp 0.3s ease';
      setTimeout(() => notif.remove(), 300);
    }, 5000);

    // Click to dismiss
    notif.addEventListener('click', () => {
      notif.remove();
      // Navigate to orders if new order
      if (payload.data?.type === 'new_order') {
        window.location.hash = '#/pedidos';
      }
    });
  },

  async unregister() {
    try {
      await EntregadorAPI.unregisterPush();
      if (this.messaging) {
        await this.messaging.deleteToken();
      }
      console.log('[Push] Unregistered');
    } catch (err) {
      console.error('[Push] Unregister failed:', err.message);
    }
  },
};

// Add CSS animations
const pushStyle = document.createElement('style');
pushStyle.textContent = `
  @keyframes slideDown { from { transform: translateY(-100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
  @keyframes slideUp { from { transform: translateY(0); opacity: 1; } to { transform: translateY(-100%); opacity: 0; } }
`;
document.head.appendChild(pushStyle);
