// backend/src/services/tokenService.js
// JWT token management: Redis-backed for multi-instance, memory fallback

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const config = require('../config/env');
const logger = require('../config/logger');

const ACCESS_TOKEN_EXPIRY = '30m';
const REFRESH_TOKEN_EXPIRY = '7d';
const REFRESH_TTL_SECONDS = 7 * 24 * 3600; // 7 days
const REVOKED_TTL_SECONDS = 30 * 24 * 3600; // 30 days

// Memory fallback (when Redis unavailable)
const memRefreshTokens = new Set();
const memRevokedTokens = new Set();

function redis() {
  try {
    const { isRedisAvailable, getRedis } = require('../config/redis');
    return isRedisAvailable() ? getRedis() : null;
  } catch { return null; }
}

function gerarToken(payload, expiry = ACCESS_TOKEN_EXPIRY) {
  const jti = crypto.randomUUID();
  return jwt.sign({ ...payload, jti }, config.jwtSecret, { expiresIn: expiry });
}

async function gerarRefreshToken(payload) {
  const jti = crypto.randomUUID();
  const token = jwt.sign({ ...payload, type: 'refresh', jti }, config.jwtSecret, { expiresIn: REFRESH_TOKEN_EXPIRY });
  const r = redis();
  if (r) {
    try { await r.set(`refresh:${jti}`, token, 'EX', REFRESH_TTL_SECONDS); }
    catch (err) { logger.warn('[token] Redis set refresh failed:', err.message); memRefreshTokens.add(token); }
  } else {
    memRefreshTokens.add(token);
  }
  return token;
}

async function verificarToken(token) {
  const decoded = jwt.verify(token, config.jwtSecret);
  if (decoded.jti) {
    const r = redis();
    let revoked = false;
    if (r) {
      try { revoked = await r.exists(`revoked:${decoded.jti}`); }
      catch { revoked = memRevokedTokens.has(decoded.jti); }
    } else {
      revoked = memRevokedTokens.has(decoded.jti);
    }
    if (revoked) throw new Error('Token revogado');
  }
  return decoded;
}

async function verificarRefreshToken(token) {
  const decoded = jwt.verify(token, config.jwtSecret);
  if (decoded.type !== 'refresh') throw new Error('Token não é refresh token');

  const r = redis();
  let valid = false;
  if (r) {
    try {
      const stored = await r.get(`refresh:${decoded.jti}`);
      valid = stored === token;
      if (valid) await r.del(`refresh:${decoded.jti}`); // Rotate: single use
    } catch {
      valid = memRefreshTokens.has(token);
      memRefreshTokens.delete(token);
    }
  } else {
    valid = memRefreshTokens.has(token);
    memRefreshTokens.delete(token); // Rotate: single use
  }

  if (!valid) throw new Error('Refresh token inválido');

  // Check revocation
  let revoked = false;
  if (r) {
    try { revoked = await r.exists(`revoked:${decoded.jti}`); }
    catch { revoked = memRevokedTokens.has(decoded.jti); }
  } else {
    revoked = memRevokedTokens.has(decoded.jti);
  }
  if (revoked) throw new Error('Refresh token revogado');

  return decoded;
}

async function revogarRefreshToken(token) {
  const r = redis();
  if (r) {
    try {
      const decoded = jwt.verify(token, config.jwtSecret);
      if (decoded.jti) await r.del(`refresh:${decoded.jti}`);
    } catch {}
  }
  memRefreshTokens.delete(token);
}

async function revogarToken(token) {
  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    if (decoded.jti) {
      const r = redis();
      if (r) {
        try { await r.set(`revoked:${decoded.jti}`, '1', 'EX', REVOKED_TTL_SECONDS); }
        catch { memRevokedTokens.add(decoded.jti); }
      } else {
        memRevokedTokens.add(decoded.jti);
      }
    }
  } catch { /* already expired — no need to revoke */ }
}

module.exports = { gerarToken, gerarRefreshToken, verificarToken, verificarRefreshToken, revogarRefreshToken, revogarToken };
