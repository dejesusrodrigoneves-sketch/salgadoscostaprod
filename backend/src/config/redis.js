// backend/src/config/redis.js
// Shared Redis client with in-memory fallback (fail-open)

const logger = require('./logger');

let redis = null;
let memFallback = null;
let usingRedis = false;

function getRedisUrl() {
  const raw = process.env.REDIS_URL;
  if (!raw) return null;
  // Add protocol if missing (Railway gives bare host:port)
  const base = raw.startsWith('redis') ? raw : `redis://${raw}`;
  const pass = process.env.REDIS_PASSWORD;
  if (!pass) return base;
  try {
    const u = new URL(base);
    if (!u.password) u.password = pass;
    return u.toString();
  } catch {
    return base;
  }
}

function createMemoryFallback() {
  const store = new Map();
  // TTL cleanup every 60s
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (entry.expiresAt && entry.expiresAt <= now) store.delete(key);
    }
  }, 60000);
  if (timer.unref) timer.unref();
  return store;
}

async function connectRedis() {
  const url = getRedisUrl();
  if (!url) {
    logger.warn('[redis] REDIS_URL não configurado. Usando fallback memória.');
    memFallback = createMemoryFallback();
    return null;
  }

  try {
    const Redis = require('ioredis');
    redis = new Redis(url, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 3) return null; // stop retrying
        return Math.min(times * 200, 2000);
      },
      lazyConnect: true,
      enableOfflineQueue: false,
    });

    redis.on('error', (err) => {
      logger.error('[redis] Connection error:', err.message);
      if (usingRedis) {
        logger.warn('[redis] Falling back to in-memory store');
        usingRedis = false;
        memFallback = memFallback || createMemoryFallback();
      }
    });

    redis.on('connect', () => {
      usingRedis = true;
      logger.info('[redis] Connected');
    });

    await redis.connect();
    usingRedis = true;
    return redis;
  } catch (err) {
    logger.error('[redis] Failed to connect:', err.message, '— using fallback memória');
    memFallback = createMemoryFallback();
    return null;
  }
}

function getRedis() {
  return usingRedis ? redis : null;
}

function isRedisAvailable() {
  return usingRedis;
}

// Shared memory fallback instance for rate limiter / cache
function getMemoryStore() {
  if (!memFallback) memFallback = createMemoryFallback();
  return memFallback;
}

async function disconnectRedis() {
  if (redis) {
    try { await redis.quit(); } catch {}
  }
  if (memFallback) {
    memFallback.clear();
  }
}

module.exports = { connectRedis, getRedis, isRedisAvailable, getMemoryStore, disconnectRedis };
