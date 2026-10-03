// backend/src/workers/index.js
// BullMQ workers: process jobs from queues

const { Worker } = require('bullmq');
const logger = require('../config/logger');
const { createBullConnection } = require('../queue/connection');
const auditRepository = require('../repositories/auditRepository');

const connection = createBullConnection();
const workers = [];

function startAuditWorker() {
  if (!connection) return null;
  const worker = new Worker('audit', async (job) => {
    const { type, entries } = job.data;
    if (type === 'audit') {
      await auditRepository.createManyAudit(entries);
    } else if (type === 'appLog') {
      await auditRepository.createManyAppLog(entries);
    }
  }, { connection, concurrency: 1 });
  worker.on('failed', (job, err) => {
    logger.error(`[worker:audit] Job ${job?.id} failed:`, err.message);
  });
  worker.on('error', (err) => {
    logger.error('[worker:audit] Redis error (fail-open):', err.message);
  });
  workers.push(worker);
  return worker;
}

function startAllWorkers() {
  startAuditWorker();
  logger.info('[workers] BullMQ workers iniciados');
}

async function stopAllWorkers() {
  for (const w of workers) {
    try { await w.close(); } catch {}
  }
}

module.exports = { startAllWorkers, stopAllWorkers };
