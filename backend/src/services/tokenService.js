const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const config = require('../config/env');

const ACCESS_TOKEN_EXPIRY = '24h';
const REFRESH_TOKEN_EXPIRY = '30d';

// In-memory refresh token store (production: use Redis or DB)
const refreshTokens = new Set();

function gerarToken(payload) {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: ACCESS_TOKEN_EXPIRY });
}

function gerarRefreshToken(payload) {
  const token = jwt.sign({ ...payload, type: 'refresh' }, config.jwtSecret, { expiresIn: REFRESH_TOKEN_EXPIRY });
  refreshTokens.add(token);
  return token;
}

function verificarToken(token) {
  return jwt.verify(token, config.jwtSecret);
}

function verificarRefreshToken(token) {
  if (!refreshTokens.has(token)) throw new Error('Refresh token inválido');
  const decoded = jwt.verify(token, config.jwtSecret);
  if (decoded.type !== 'refresh') throw new Error('Token não é refresh token');
  refreshTokens.delete(token); // Rotate: single use
  return decoded;
}

function revogarRefreshToken(token) {
  refreshTokens.delete(token);
}

module.exports = { gerarToken, gerarRefreshToken, verificarToken, verificarRefreshToken, revogarRefreshToken };
