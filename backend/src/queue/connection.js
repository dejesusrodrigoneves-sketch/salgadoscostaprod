// backend/src/queue/connection.js
// BullMQ connection options (plain object — Queue/Worker build their own clients)

const logger = require('../config/logger');

function getRedisUrl() {
  const raw = process.env.REDIS_URL;
  if (!raw) return null;
  // Railway: bare host:port → redis://host:port
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

function createBullConnection() {
  const url = getRedisUrl();
  if (!url) {
    logger.warn('[queue] REDIS_URL não configurado. Filas desabilitadas.');
    return null;
  }
  try {
    // Return plain opts — NOT a RedisConnection instance.
    // isRedisInstance(RedisConnection) === false → BullMQ Object.assign drops
    // host/port → falls back to 127.0.0.1:6379 (ECONNREFUSED / crash).
    const u = new URL(url);
    return {
      host: u.hostname,
      port: Number(u.port || 6379),
      password: u.password || undefined,
      username: u.username || undefined,
      db: u.pathname && u.pathname !== '/' ? Number(u.pathname.slice(1)) : 0,
      maxRetriesPerRequest: null,
    };
  } catch (err) {
    logger.error('[queue] BullMQ connection failed:', err.message);
    return null;
  }
}

module.exports = { createBullConnection, getRedisUrl };
