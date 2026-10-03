const authService = require('../services/authService');
const tokenService = require('../services/tokenService');
const { asyncHandler } = require('../middleware/errorHandler');

exports.login = asyncHandler(async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'username e password obrigatórios' });
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const userAgent = req.headers['user-agent'];
  const result = await authService.login(username, password, req.ctx?.empresaId, ip, userAgent, {
    requestId: req.context?.requestId,
    ip: req.context?.ip,
    userAgent: req.context?.userAgent,
    path: req.context?.path,
  });
  res.json(result);
});

exports.criarUsuario = asyncHandler(async (req, res) => {
  const usuario = await authService.criarUsuario({
    ...req.body,
    empresaId: req.ctx?.empresaId || req.body.empresaId,
  }, {
    requestId: req.context?.requestId,
    ip: req.context?.ip,
    userAgent: req.context?.userAgent,
    path: req.context?.path,
    actor: {
      actorType: 'admin',
      actorId: Number(req.user.id),
      actorUsername: req.user.username,
      actorRole: req.user.role,
    },
  });
  res.status(201).json(usuario);
});

exports.criarConta = asyncHandler(async (req, res) => {
  const { username, password, lojaNome } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'username e password obrigatórios' });
  if (password.length < 6) return res.status(400).json({ error: 'Senha deve ter no mínimo 6 caracteres' });
  if (!/[A-Z]/.test(password)) return res.status(400).json({ error: 'Senha deve conter pelo menos uma letra maiúscula' });
  if (!/[a-z]/.test(password)) return res.status(400).json({ error: 'Senha deve conter pelo menos uma letra minúscula' });
  if (!/[0-9]/.test(password)) return res.status(400).json({ error: 'Senha deve conter pelo menos um número' });
  const result = await authService.criarConta({
    username, password, lojaNome: lojaNome || username,
    empresaId: req.ctx?.empresaId,
  }, {
    requestId: req.context?.requestId,
    ip: req.context?.ip,
    userAgent: req.context?.userAgent,
    path: req.context?.path,
  });
  res.status(201).json(result);
});

exports.alterarSenha = asyncHandler(async (req, res) => {
  await authService.alterarSenha(req.user.id, req.body.senhaAtual, req.body.novaSenha, {
    requestId: req.context?.requestId,
    ip: req.context?.ip,
    userAgent: req.context?.userAgent,
    path: req.context?.path,
  });
  res.json({ success: true });
});

exports.refreshToken = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ error: 'refreshToken obrigatório' });
  const tokenService = require('../services/tokenService');
  const decoded = await tokenService.verificarRefreshToken(refreshToken);
  const payload = {
    id: decoded.id,
    username: decoded.username,
    role: decoded.role,
    empresaId: decoded.empresaId,
    lojaNome: decoded.lojaNome,
    mcp: !!decoded.mcp,
  };
  const newToken = tokenService.gerarToken(payload, decoded.mcp ? '15m' : undefined);
  const newRefreshToken = await tokenService.gerarRefreshToken(payload);
  res.json({ token: newToken, refreshToken: newRefreshToken });
});

exports.logout = asyncHandler(async (req, res) => {
  const authHeader = req.headers.authorization;
  const { refreshToken } = req.body;

  // Revoke access token
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    await tokenService.revogarToken(token);
  }

  // Revoke refresh token
  if (refreshToken) {
    await tokenService.revogarRefreshToken(refreshToken);
  }

  res.json({ success: true });
});

// Limpa TODOS os cookies httpOnly clientToken_* definidos pelo servidor.
// Complementa wipeBrowserStorage() do frontend: document.cookie não alcança httpOnly.
// Sem autenticação de propósito — precisa funcionar após expirar a sessão.
exports.wipeCookies = asyncHandler(async (req, res) => {
  const raw = req.headers.cookie || '';
  const names = raw
    .split(';')
    .map((c) => (c.split('=')[0] || '').trim())
    .filter((n) => n && n.startsWith('clientToken_'));

  const secure = process.env.NODE_ENV === 'production';
  names.forEach((name) => {
    res.clearCookie(name, { httpOnly: true, secure, sameSite: 'strict', path: '/' });
  });

  res.json({ success: true, cleared: names.length });
});
