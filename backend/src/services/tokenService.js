const jwt = require('jsonwebtoken');
const config = require('../config/env');

const TOKEN_EXPIRY = '7d';

function gerarToken(payload) {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: TOKEN_EXPIRY });
}

function verificarToken(token) {
  return jwt.verify(token, config.jwtSecret);
}

module.exports = { gerarToken, verificarToken };
