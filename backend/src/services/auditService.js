const auditQueue = require('./auditQueue');

const SENSITIVE_KEYS = /password|passwd|secret|apikey|api_key|token|qr|pairing|hash/i;
const PHONE_RE = /^\+?\d{10,14}$/;
const EMAIL_RE = /^\S+@\S+\.\S+$/;

function maskValue(v) {
  if (typeof v !== 'string') return v;
  if (PHONE_RE.test(v.replace(/[\s-]/g, ''))) {
    const digits = v.replace(/[\s-]/g, '');
    return v.slice(0, 2) + '****' + v.slice(-2);
  }
  if (EMAIL_RE.test(v)) {
    const [user, domain] = v.split('@');
    return user[0] + '***@' + domain;
  }
  return v;
}

function maskDeep(obj) {
  if (Array.isArray(obj)) return obj.map(maskDeep);
  if (obj && typeof obj === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      if (SENSITIVE_KEYS.test(k)) out[k] = '[REDACTED]';
      else out[k] = maskDeep(v);
    }
    return out;
  }
  return maskValue(obj);
}

function buildEntry(input) {
  return {
    requestId: input.requestId || 'no-request',
    sessionId: input.sessionId || null,
    empresaId: input.empresaId || 1,
    actorType: input.actorType || 'anon',
    actorId: input.actorId ?? null,
    actorUsername: input.actorUsername || null,
    actorRole: input.actorRole || null,
    action: input.action,
    module: input.module || 'geral',
    targetType: input.targetType || null,
    targetId: input.targetId != null ? String(input.targetId) : null,
    before: input.before ? maskDeep(input.before) : null,
    after: input.after ? maskDeep(input.after) : null,
    changedFields: input.changedFields ? input.changedFields : null,
    severity: input.severity || 'info',
    reason: input.reason || null,
    ip: input.ip || null,
    userAgent: input.userAgent || null,
    metadata: input.metadata ? maskDeep(input.metadata) : null,
  };
}

function audit(input) {
  const entry = buildEntry(input);
  if (entry.severity === 'critical') {
    return auditQueueFlushSync([entry]);
  }
  auditQueue.enqueueAudit(entry);
  return Promise.resolve();
}

function appLog({ level = 'info', message, module, stack, meta, requestId, empresaId }) {
  auditQueue.enqueueAppLog({
    requestId: requestId || 'no-request',
    level,
    message,
    module: module || null,
    stack: stack || null,
    meta: meta ? maskDeep(meta) : null,
    empresaId: empresaId || 1,
  });
  return Promise.resolve();
}

async function auditQueueFlushSync(entries) {
  const { createManyAudit } = require('../repositories/auditRepository');
  try {
    await createManyAudit(entries);
    return true;
  } catch (err) {
    console.error('[auditService] critical log failed:', err.message);
    return false;
  }
}

module.exports = { audit, appLog, maskDeep };
