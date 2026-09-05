const { Router } = require('express');
const authService = require('../services/authService');
const { authenticate, authorize } = require('../middleware/auth');
const { authLimiter, refreshLimiter } = require('../middleware/rateLimit');
const { asyncHandler } = require('../middleware/errorHandler');

const router = Router();

// Login for entregador (username + password)
router.post('/login', authLimiter, asyncHandler(async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'username e password obrigatórios' });
  }
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const userAgent = req.headers['user-agent'];
  const result = await authService.loginEntregador(username, password, req.ctx?.empresaId, ip, userAgent, {
    requestId: req.context?.requestId,
    ip: req.context?.ip,
    userAgent: req.context?.userAgent,
    path: req.context?.path,
  });
  res.json(result);
}));

// Change password (first login or voluntary)
router.post('/change-password', authenticate, authorize('entregador'), asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'currentPassword e newPassword obrigatórios' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'Nova senha deve ter no mínimo 6 caracteres' });
  }
  if (!/[A-Z]/.test(newPassword)) {
    return res.status(400).json({ error: 'Nova senha deve conter pelo menos uma letra maiúscula' });
  }
  if (!/[a-z]/.test(newPassword)) {
    return res.status(400).json({ error: 'Nova senha deve conter pelo menos uma letra minúscula' });
  }
  if (!/[0-9]/.test(newPassword)) {
    return res.status(400).json({ error: 'Nova senha deve conter pelo menos um número' });
  }
  await authService.changePasswordEntregador(req.user.id, currentPassword, newPassword, {
    requestId: req.context?.requestId,
    ip: req.context?.ip,
    userAgent: req.context?.userAgent,
    path: req.context?.path,
  });
  res.json({ success: true });
}));

// Refresh token
router.post('/refresh', refreshLimiter, asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ error: 'refreshToken obrigatório' });
  const tokenService = require('../services/tokenService');
  const decoded = tokenService.verificarRefreshToken(refreshToken);
  if (decoded.role !== 'entregador') {
    return res.status(403).json({ error: 'Token inválido para entregador' });
  }
  const payload = {
    id: decoded.id,
    username: decoded.username,
    role: decoded.role,
    empresaId: decoded.empresaId,
    lojaNome: decoded.lojaNome,
  };
  const newToken = tokenService.gerarToken(payload);
  const newRefreshToken = tokenService.gerarRefreshToken(payload);
  res.json({ token: newToken, refreshToken: newRefreshToken });
}));

module.exports = router;
