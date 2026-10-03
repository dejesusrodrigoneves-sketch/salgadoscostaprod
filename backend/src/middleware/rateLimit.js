// backend/src/middleware/rateLimit.js
// Distributed rate limiting: Redis store when available, MemoryStore fallback

const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');
const logger = require('../config/logger');

// Lazy store factory: creates Redis store on first request if Redis is up
function createStore() {
  try {
    const { isRedisAvailable, getRedis } = require('../config/redis');
    if (isRedisAvailable()) {
      const { RedisStore } = require('rate-limit-redis');
      return new RedisStore({
        sendCommand: (...args) => getRedis().call(...args),
        prefix: 'rl:',
      });
    }
  } catch (err) {
    logger.warn('[rateLimit] Redis store unavailable, using MemoryStore:', err.message);
  }
  // MemoryStore fallback (default behavior of express-rate-limit)
  return undefined;
}

const authLimiter = rateLimit({
  store: createStore(),
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true,
  message: { error: 'Muitas tentativas. Tente novamente em 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  store: createStore(),
  windowMs: 60 * 1000,
  max: 60,
  message: { error: 'Muitas requisições. Tente novamente em 1 minuto.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const registerLimiter = rateLimit({
  store: createStore(),
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: 'Muitas contas criadas. Tente novamente em 1 hora.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const orderLimiter = rateLimit({
  store: createStore(),
  windowMs: 60 * 1000,
  max: Number(process.env.ORDER_RATE_MAX) || 3,
  message: { error: 'Muitos pedidos. Aguarde 1 minuto antes de fazer outro pedido.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const proxyLimiter = rateLimit({
  store: createStore(),
  windowMs: 60 * 1000,
  max: 20,
  message: { error: 'Muitas requisições ao proxy. Aguarde 1 minuto.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const refreshLimiter = rateLimit({
  store: createStore(),
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Muitas requisições. Tente novamente em 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Webhook limiter — prevents webhook flood/abuse
const webhookLimiter = rateLimit({
  store: createStore(),
  windowMs: 60 * 1000,
  max: 100,
  message: { error: 'Muitos webhooks. Aguarde 1 minuto.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Per-user API limiter — applied AFTER authenticate sets req.user
// Keys by user ID (stable across shared IPs), falls back to IP
const userApiLimiter = rateLimit({
  store: createStore(),
  windowMs: 60 * 1000,
  max: 120,
  keyGenerator: (req) => {
    if (req.user?.id) return `user:${req.user.id}`;
    return ipKeyGenerator(req);
  },
  message: { error: 'Muitas requisições. Tente novamente em 1 minuto.' },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { authLimiter, apiLimiter, registerLimiter, orderLimiter, proxyLimiter, refreshLimiter, userApiLimiter, webhookLimiter };
