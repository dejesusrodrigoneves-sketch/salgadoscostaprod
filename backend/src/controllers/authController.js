const authService = require('../services/authService');
const { asyncHandler } = require('../middleware/errorHandler');

exports.login = asyncHandler(async (req, res) => {
  const { username, password, empresaId } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'username e password obrigatórios' });
  const result = await authService.login(username, password, empresaId || 1);
  res.json(result);
});

exports.criarUsuario = asyncHandler(async (req, res) => {
  const usuario = await authService.criarUsuario(req.body);
  res.status(201).json(usuario);
});

exports.criarConta = asyncHandler(async (req, res) => {
  const { username, password, lojaNome } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'username e password obrigatórios' });
  if (password.length < 6) return res.status(400).json({ error: 'Senha deve ter no mínimo 6 caracteres' });
  const result = await authService.criarConta({ username, password, lojaNome: lojaNome || username });
  res.status(201).json(result);
});

exports.alterarSenha = asyncHandler(async (req, res) => {
  await authService.alterarSenha(req.user.id, req.body.senhaAtual, req.body.novaSenha);
  res.json({ success: true });
});
