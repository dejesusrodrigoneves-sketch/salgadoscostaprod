const authService = require('../services/authService');
const { asyncHandler } = require('../middleware/errorHandler');

exports.login = asyncHandler(async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'username e password obrigatórios' });
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const userAgent = req.headers['user-agent'];
  const result = await authService.login(username, password, ip, userAgent, {
    requestId: req.context?.requestId,
    ip: req.context?.ip,
    userAgent: req.context?.userAgent,
    path: req.context?.path,
  });
  res.json(result);
});

exports.criarUsuario = asyncHandler(async (req, res) => {
  const usuario = await authService.criarUsuario(req.body, {
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
  const result = await authService.criarConta({ username, password, lojaNome: lojaNome || username }, {
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
