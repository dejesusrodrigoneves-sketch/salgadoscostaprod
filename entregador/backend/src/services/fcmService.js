/**
 * Firebase Cloud Messaging Service
 * Sends push notifications to delivery drivers
 *
 * SETUP REQUIRED:
 * 1. Create Firebase project at https://console.firebase.google.com
 * 2. Download service account key → backend/firebase-service-account.json
 * 3. Get VAPID key → Project Settings → Cloud Messaging → Web push certificates
 * 4. Add to backend/.env:
 *    FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json
 *    FCM_VAPID_KEY=your-vapid-key
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

let firebaseInitialized = false;

function initFirebase() {
  if (firebaseInitialized) return true;

  // Method 1: Individual env vars (recommended for Vercel/cloud)
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

  if (projectId && privateKey && clientEmail) {
    try {
      // Reconstruct proper PEM format: strip all newlines, re-wrap at 64 chars
      const keyBody = privateKey
        .replace(/-----BEGIN PRIVATE KEY-----/g, '')
        .replace(/-----END PRIVATE KEY-----/g, '')
        .replace(/\n/g, '')
        .replace(/\r/g, '')
        .replace(/\s/g, '');
      const formattedKey = `-----BEGIN PRIVATE KEY-----\n${keyBody.match(/.{1,64}/g).join('\n')}\n-----END PRIVATE KEY-----`;

      const serviceAccount = {
        type: 'service_account',
        project_id: projectId,
        private_key_id: '',
        private_key: formattedKey,
        client_email: clientEmail,
        client_id: '',
        auth_uri: 'https://accounts.google.com/o/oauth2/auth',
        token_uri: 'https://oauth2.googleapis.com/token',
        auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
        client_x509_cert_url: '',
        universe_domain: 'googleapis.com',
      };

      admin.initializeApp({
        credential: admin.cert(serviceAccount),
      });
      firebaseInitialized = true;
      console.log('[FCM] Firebase initialized from environment variables');
      return true;
    } catch (err) {
      console.error('[FCM] Failed to initialize from env vars:', err.message);
      return false;
    }
  }

  // Method 2: JSON file (legacy/local fallback)
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (!serviceAccountPath) {
    console.warn('[FCM] Firebase credentials not configured — push notifications disabled');
    console.warn('[FCM] Set FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL in .env');
    return false;
  }

  const fullPath = path.resolve(__dirname, '..', '..', serviceAccountPath);
  if (!fs.existsSync(fullPath)) {
    console.warn(`[FCM] Service account file not found: ${fullPath} — push notifications disabled`);
    return false;
  }

  try {
    const serviceAccount = require(fullPath);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    firebaseInitialized = true;
    console.log('[FCM] Firebase initialized from service account file');
    return true;
  } catch (err) {
    console.error('[FCM] Failed to initialize from file:', err.message);
    return false;
  }
}

/**
 * Send push notification to a single entregador
 */
async function sendToEntregador(entregadorId, title, body, data = {}) {
  if (!initFirebase()) return null;

  const prisma = require('../config/prisma');
  const entregador = await prisma.entregador.findUnique({
    where: { id: Number(entregadorId) },
    select: { fcmToken: true, nome: true },
  });

  if (!entregador?.fcmToken) {
    console.warn(`[FCM] No FCM token for entregador ${entregadorId}`);
    return null;
  }

  try {
    const result = await admin.messaging().send({
      token: entregador.fcmToken,
      notification: { title, body },
      data,
      webpush: {
        fcmOptions: { tidal: process.env.FCM_VAPID_KEY },
        notification: {
          icon: '/entregador/manifest-icon.png',
          badge: '/entregador/manifest-icon.png',
          vibrate: [200, 100, 200],
        },
      },
    });
    console.log(`[FCM] Sent to entregador ${entregadorId}: ${result}`);
    return result;
  } catch (err) {
    console.error(`[FCM] Failed to send to entregador ${entregadorId}:`, err.message);
    // If token is invalid, remove it
    if (err.code === 'messaging/registration-token-not-registered' || err.code === 'messaging/invalid-registration-token') {
      await prisma.entregador.update({
        where: { id: Number(entregadorId) },
        data: { fcmToken: null },
      });
      console.log(`[FCM] Removed invalid token for entregador ${entregadorId}`);
    }
    return null;
  }
}

/**
 * Send push notification to all entregadores in an empresa
 */
async function sendToEntregadores(empresaId, title, body, data = {}) {
  if (!initFirebase()) return null;

  const prisma = require('../config/prisma');
  const entregadores = await prisma.entregador.findMany({
    where: { empresaId, ativo: true, fcmToken: { not: null } },
    select: { id: true, fcmToken: true },
  });

  if (entregadores.length === 0) return null;

  const tokens = entregadores.map(e => e.fcmToken).filter(Boolean);
  if (tokens.length === 0) return null;

  try {
    const result = await admin.messaging().sendEachForMulticast({
      tokens,
      notification: { title, body },
      data,
      webpush: {
        fcmOptions: { tidal: process.env.FCM_VAPID_KEY },
        notification: {
          icon: '/entregador/manifest-icon.png',
          badge: '/entregador/manifest-icon.png',
          vibrate: [200, 100, 200],
        },
      },
    });
    console.log(`[FCM] Sent to ${tokens.length} entregadores in empresa ${empresaId}`);
    return result;
  } catch (err) {
    console.error(`[FCM] Failed to send to empresa ${entregadorId}:`, err.message);
    return null;
  }
}

/**
 * Notify entregador of new order assignment
 */
async function notifyNewOrder(entregadorId, pedidoId, clienteNome, taxaEntrega) {
  return sendToEntregador(
    entregadorId,
    'Novo pedido atribuído',
    `Pedido #${pedidoId.substring(0, 6)} — ${clienteNome} — Taxa: R$ ${Number(taxaEntrega || 0).toFixed(2)}`,
    { type: 'new_order', pedidoId }
  );
}

/**
 * Notify entregador of order cancellation
 */
async function notifyOrderCancelled(entregadorId, pedidoId) {
  return sendToEntregador(
    entregadorId,
    'Pedido cancelado',
    `Pedido #${pedidoId.substring(0, 6)} foi cancelado`,
    { type: 'order_cancelled', pedidoId }
  );
}

module.exports = {
  initFirebase,
  sendToEntregador,
  sendToEntregadores,
  notifyNewOrder,
  notifyOrderCancelled,
};
