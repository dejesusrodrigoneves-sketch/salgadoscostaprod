// backend/src/middleware/idempotency.js
// Distributed idempotency: Redis SET NX EX, memory fallback
// Prevents duplicate processing of POST requests (orders, payments, refunds)

const logger = require('../config/logger');

const IDEMPOTENCY_TTL = 24 * 3600; // 24 hours

// Memory fallback (when Redis unavailable)
const memStore = new Map();

function redis() {
  try {
    const { isRedisAvailable, getRedis } = require('../config/redis');
    return isRedisAvailable() ? getRedis() : null;
  } catch { return null; }
}

function idempotencyMiddleware(req, res, next) {
  const key = req.headers['idempotency-key'];
  if (!key || req.method !== 'POST') return next();

  const fullKey = `idemp:${req.ctx?.empresaId || 'anon'}:${key}`;

  // Check existing response
  const checkExisting = async () => {
    const r = redis();
    if (r) {
      try {
        const existing = await r.get(fullKey);
        if (existing) return JSON.parse(existing);
      } catch (err) {
        logger.warn('[idempotency] Redis get failed:', err.message);
      }
    } else {
      const entry = memStore.get(fullKey);
      if (entry && Date.now() - entry.ts < IDEMPOTENCY_TTL * 1000) {
        return entry.value;
      }
      memStore.delete(fullKey);
    }
    return null;
  };

  // Try to claim the key atomically
  const claimKey = async () => {
    const r = redis();
    if (r) {
      try {
        // SET NX = only if not exists; EX = auto-cleanup
        const claimed = await r.set(fullKey, '', 'NX', 'EX', IDEMPOTENCY_TTL);
        return claimed === 'OK';
      } catch (err) {
        logger.warn('[idempotency] Redis set NX failed:', err.message);
        // Fallback: treat as claimed (fail-open)
        return false;
      }
    } else {
      if (memStore.has(fullKey)) return false;
      memStore.set(fullKey, { value: null, ts: Date.now() });
      return true;
    }
  };

  checkExisting().then((existing) => {
    if (existing) {
      // Replay cached response
      res.status(existing.status || 200).json(existing.body);
      return;
    }

    claimKey().then((claimed) => {
      if (!claimed) {
        // Race condition: another request claimed it — wait briefly then replay
        return checkExisting().then((existing2) => {
          if (existing2) {
            res.status(existing2.status || 200).json(existing2.body);
          } else {
            res.status(409).json({ error: 'Request em processamento' });
          }
        });
      }

      // Intercept res.json to cache response
      const originalJson = res.json.bind(res);
      res.json = (body) => {
        const response = { status: res.statusCode, body };
        const storeResponse = async () => {
          const r = redis();
          if (r) {
            try {
              await r.set(fullKey, JSON.stringify(response), 'EX', IDEMPOTENCY_TTL);
            } catch (err) {
              logger.warn('[idempotency] Redis cache response failed:', err.message);
            }
          } else {
            memStore.set(fullKey, { value: response, ts: Date.now() });
          }
        };
        storeResponse().catch(() => {});
        return originalJson(body);
      };

      next();
    }).catch(() => next());
  }).catch(() => next());
}

module.exports = { idempotencyMiddleware };
