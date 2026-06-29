const { Router } = require('express');
const bcrypt = require('bcryptjs');
const prisma = require('../config/prisma');
const sql = require('../repositories/sqlRepository');
const { authenticate, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

const router = Router();
router.use(authenticate, authorize('superadmin'));

router.get('/', asyncHandler(async (req, res) => {
  const usuarios = await prisma.usuario.findMany({
    orderBy: { createdAt: 'desc' },
    select: { id: true, username: true, role: true, lojaNome: true, empresaId: true, createdAt: true },
  });
  res.json(usuarios);
}));

router.post('/', asyncHandler(async (req, res) => {
  const { username, password, lojaNome, role, empresaId } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'username e password obrigatórios' });
  const existing = await prisma.usuario.findUnique({ where: { empresaId_username: { empresaId: empresaId || 1, username } } });
  if (existing) return res.status(409).json({ error: 'Usuário já existe' });
  const hash = await bcrypt.hash(password, 10);
  const user = await prisma.usuario.create({
    data: { empresaId: empresaId || 1, username, passwordHash: hash, lojaNome: lojaNome || username, role: role || 'user' },
    select: { id: true, username: true, role: true, lojaNome: true },
  });
  res.status(201).json(user);
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  await prisma.usuario.delete({ where: { id: Number(req.params.id) } });
  res.json({ success: true });
}));

router.put('/:id/password', asyncHandler(async (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'password obrigatório' });
  const hash = await bcrypt.hash(password, 10);
  await prisma.usuario.update({ where: { id: Number(req.params.id) }, data: { passwordHash: hash } });
  res.json({ success: true });
}));

module.exports = router;
