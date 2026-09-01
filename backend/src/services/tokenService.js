const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const config = require('../config/env');

const ACCESS_TOKEN_EXPIRY = '30m';
const REFRESH_TOKEN_EXPIRY = '7d';

// In-memory refresh token store (production: use Redis or DB)
const refreshTokens = new Set();

// Revocation set: stores revoked token IDs (jti)
const revokedTokens = new Set();

function gerarToken(payload) {
  const jti = crypto.randomUUID();
  return jwt.sign({ ...payload, jti }, config.jwtSecret, { expiresIn: ACCESS_TOKEN_EXPIRY });
}

function gerarRefreshToken(payload) {
  const jti = crypto.randomUUID();
  const token = jwt.sign({ ...payload, type: 'refresh', jti }, config.jwtSecret, { expiresIn: REFRESH_TOKEN_EXPIRY });
  refreshTokens.add(token);
  return token;
}

function verificarToken(token) {
  const decoded = jwt.verify(token, config.jwtSecret);
  if (decoded.jti && revokedTokens.has(decoded.jti)) {
    throw new Error('Token revogado');
  }
  return decoded;
}

function verificarRefreshToken(token) {
  if (!refreshTokens.has(token)) throw new Error('Refresh token inválido');
  const decoded = jwt.verify(token, config.jwtSecret);
  if (decoded.type !== 'refresh') throw new Error('Token não é refresh token');
  if (decoded.jti && revokedTokens.has(decoded.jti)) throw new Error('Refresh token revogado');
  refreshTokens.delete(token); // Rotate: single use
  return decoded;
}

function revogarRefreshToken(token) {
  refreshTokens.delete(token);
}

function revogarToken(token) {
  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    if (decoded.jti) revokedTokens.add(decoded.jti);
  } catch (e) { /* already expired — no need to revoke */ }
}

// Evict old revoked tokens (prevent memory leak)
setInterval(() => {
  if (revokedTokens.size > 10000) revokedTokens.clear();
}, 3600000); // hourly

module.exports = { gerarToken, gerarRefreshToken, verificarToken, verificarRefreshToken, revogarRefreshToken, revogarToken };
