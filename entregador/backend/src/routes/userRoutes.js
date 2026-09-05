const { Router } = require('express');
const userService = require('../services/userService');
const { authenticate, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

const router = Router();
router.use(authenticate, authorize('superadmin'));

function ctxFrom(req) {
  return {
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
  };
}

router.get('/', asyncHandler(async (req, res) => {
  const usuarios = await userService.listar();
  res.json(usuarios);
}));

router.post('/', asyncHandler(async (req, res) => {
  const { username, password, lojaNome, role, empresaId } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'username e password obrigatórios' });
  const user = await userService.criar({ username, password, lojaNome, role, empresaId: empresaId || req.ctx?.empresaId || null }, ctxFrom(req));
  res.status(201).json(user);
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  res.json(await userService.deletar(req.params.id, ctxFrom(req)));
}));

router.put('/:id/password', asyncHandler(async (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'password obrigatório' });
  res.json(await userService.resetarSenha(req.params.id, password, ctxFrom(req)));
}));

router.get('/logs', asyncHandler(async (req, res) => {
  const logs = await userService.listarLogins();
  res.json(logs);
}));

module.exports = router;
