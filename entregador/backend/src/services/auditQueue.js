const auditRepository = require('../repositories/auditRepository');

const BATCH_SIZE = 50;
const FLUSH_INTERVAL_MS = 1000;
const MAX_QUEUE_SIZE = 2000;

let auditBuffer = [];
let appBuffer = [];
let flushTimer = null;
let flushing = false;

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flush();
  }, FLUSH_INTERVAL_MS);
  if (flushTimer.unref) flushTimer.unref();
}

async function flush() {
  if (flushing) return;
  const auditBatch = auditBuffer.splice(0, BATCH_SIZE);
  const appBatch = appBuffer.splice(0, BATCH_SIZE);
  if (auditBatch.length === 0 && appBatch.length === 0) return;
  flushing = true;
  try {
    if (auditBatch.length > 0) await auditRepository.createManyAudit(auditBatch);
    if (appBatch.length > 0) await auditRepository.createManyAppLog(appBatch);
  } catch (err) {
    console.error('[auditQueue] flush failed:', err.message);
  } finally {
    flushing = false;
    if (auditBuffer.length > 0 || appBuffer.length > 0) scheduleFlush();
  }
}

function enqueueAudit(entry) {
  auditBuffer.push(entry);
  if (auditBuffer.length > MAX_QUEUE_SIZE) auditBuffer.shift();
  scheduleFlush();
}

function enqueueAppLog(entry) {
  appBuffer.push(entry);
  if (appBuffer.length > MAX_QUEUE_SIZE) appBuffer.shift();
  scheduleFlush();
}

async function flushNow() {
  while (auditBuffer.length > 0 || appBuffer.length > 0) {
    await flush();
  }
}

module.exports = { enqueueAudit, enqueueAppLog, flushNow, queueSizes: () => ({ audit: auditBuffer.length, app: appBuffer.length }) };
