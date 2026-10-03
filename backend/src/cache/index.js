// backend/src/cache/index.js
// Cache abstraction: Redis when available, in-memory fallback (fail-open)

const { getRedis, isRedisAvailable, getMemoryStore } = require('../config/redis');
const logger = require('../config/logger');

// Tenant-scoped key prefix
function scopedKey(key) {
  return key.startsWith('cache:') ? key : `cache:${key}`;
}

async function get(key) {
  if (isRedisAvailable()) {
    try {
      const val = await getRedis().get(scopedKey(key));
      return val ? JSON.parse(val) : null;
    } catch (err) {
      logger.warn('[cache] Redis get failed, fallback:', err.message);
    }
  }
  // Memory fallback
  const store = getMemoryStore();
  const entry = store.get(scopedKey(key));
  if (!entry) return null;
  if (entry.expiresAt && entry.expiresAt <= Date.now()) {
    store.delete(scopedKey(key));
    return null;
  }
  return entry.value;
}

async function set(key, value, ttlSeconds = 300) {
  const fullKey = scopedKey(key);
  if (isRedisAvailable()) {
    try {
      await getRedis().set(fullKey, JSON.stringify(value), 'EX', ttlSeconds);
      return;
    } catch (err) {
      logger.warn('[cache] Redis set failed, fallback:', err.message);
    }
  }
  // Memory fallback
  const store = getMemoryStore();
  store.set(fullKey, { value, expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null });
}

async function del(key) {
  const fullKey = scopedKey(key);
  if (isRedisAvailable()) {
    try {
      await getRedis().del(fullKey);
      return;
    } catch (err) {
      logger.warn('[cache] Redis del failed:', err.message);
    }
  }
  const store = getMemoryStore();
  store.delete(fullKey);
}

async function delPrefix(prefix) {
  const fullPrefix = scopedKey(prefix);
  if (isRedisAvailable()) {
    try {
      const keys = await getRedis().keys(`${fullPrefix}*`);
      if (keys.length > 0) await getRedis().del(...keys);
      return;
    } catch (err) {
      logger.warn('[cache] Redis delPrefix failed:', err.message);
    }
  }
  const store = getMemoryStore();
  for (const k of store.keys()) {
    if (k.startsWith(fullPrefix)) store.delete(k);
  }
}

module.exports = { get, set, del, delPrefix };
