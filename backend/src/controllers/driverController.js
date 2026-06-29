const sql = require('../repositories/sqlRepository');
const { asyncHandler } = require('../middleware/errorHandler');

exports.listar = asyncHandler(async (req, res) => {
  const where = { empresaId: req.user.empresaId };
  if (req.query.ativo === 'true') where.ativo = true;
  const prisma = require('../config/prisma');
  const entregadores = await prisma.entregador.findMany({
    where,
    orderBy: req.query.sort === 'criadoEm' ? { createdAt: 'desc' } : { nome: 'asc' },
  });
  res.json(entregadores);
});

exports.criar = asyncHandler(async (req, res) => {
  const entregador = await sql.criarEntregador({ ...req.body, empresaId: req.user.empresaId });
  res.status(201).json(entregador);
});

exports.atualizar = asyncHandler(async (req, res) => {
  const prisma = require('../config/prisma');
  const existente = await prisma.entregador.findFirst({ where: { id: Number(req.params.id), empresaId: req.user.empresaId } });
  if (!existente) return res.status(404).json({ error: 'Entregador não encontrado' });
  const entregador = await sql.atualizarEntregador(req.params.id, req.body);
  res.json(entregador);
});

exports.toggle = asyncHandler(async (req, res) => {
  const { ativo } = req.body;
  const prisma = require('../config/prisma');
  const existente = await prisma.entregador.findFirst({ where: { id: Number(req.params.id), empresaId: req.user.empresaId } });
  if (!existente) return res.status(404).json({ error: 'Entregador não encontrado' });
  const entregador = await sql.toggleEntregador(req.params.id, ativo);
  res.json(entregador);
});

exports.deletar = asyncHandler(async (req, res) => {
  const prisma = require('../config/prisma');
  const existente = await prisma.entregador.findFirst({ where: { id: Number(req.params.id), empresaId: req.user.empresaId } });
  if (!existente) return res.status(404).json({ error: 'Entregador não encontrado' });
  await sql.deletarEntregador(req.params.id);
  res.json({ success: true });
});
