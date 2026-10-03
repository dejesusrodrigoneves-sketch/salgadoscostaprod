// backend/src/queue/index.js
// Queue definitions + helpers for BullMQ

const { Queue } = require('bullmq');
const logger = require('../config/logger');
const { createBullConnection } = require('./connection');

const connection = createBullConnection();

function createQueue(name) {
  if (!connection) return null;
  const queue = new Queue(name, {
    connection,
    defaultJobOptions: {
      removeOnComplete: { age: 7 * 24 * 3600, count: 100 }, // keep 7 days, max 100
      removeOnFail: { age: 30 * 24 * 3600, count: 50 },
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
    },
  });
  queue.on('error', (err) => {
    logger.error(`[queue:${name}] Redis error (fail-open):`, err.message);
  });
  return queue;
}

// Named queues
const auditQueue = createQueue('audit');
const whatsappQueue = createQueue('whatsapp');
const fcmQueue = createQueue('fcm');
const webhookQueue = createQueue('webhook');
const financialSyncQueue = createQueue('financial-sync');

// Helper: add job safely (fail-open if queue unavailable)
async function addJob(queue, name, data, opts = {}) {
  if (!queue) {
    logger.warn(`[queue] Queue ${name} unavailable, processing synchronously`);
    return null;
  }
  try {
    return await queue.add(name, data, opts);
  } catch (err) {
    logger.error(`[queue] Failed to add ${name}:`, err.message);
    return null;
  }
}

// Graceful shutdown (Queue owns its Redis clients; connection is plain opts)
async function closeQueues() {
  const queues = [auditQueue, whatsappQueue, fcmQueue, webhookQueue, financialSyncQueue];
  for (const q of queues) {
    if (q) {
      try { await q.close(); } catch {}
    }
  }
}

module.exports = {
  auditQueue,
  whatsappQueue,
  fcmQueue,
  webhookQueue,
  financialSyncQueue,
  addJob,
  closeQueues,
};
