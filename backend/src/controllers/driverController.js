const sql = require('../repositories/sqlRepository');
const auditService = require('../services/auditService');
const { getCtx } = require('../middleware/context');
const { asyncHandler } = require('../middleware/errorHandler');

exports.listar = asyncHandler(async (req, res) => {
  const where = { empresaId: 1 };
  if (req.query.ativo === 'true') where.ativo = true;
  const prisma = require('../config/prisma');
  const entregadores = await prisma.entregador.findMany({
    where,
    orderBy: req.query.sort === 'criadoEm' ? { createdAt: 'desc' } : { nome: 'asc' },
  });
  res.json(entregadores);
});

exports.criar = asyncHandler(async (req, res) => {
  const entregador = await sql.criarEntregador({ ...req.body, empresaId: 1 });

  auditService.audit({
    ...getCtx(req),
    action: 'entregador.create',
    module: 'entregadores',
    targetType: 'entregador',
    targetId: entregador.id,
    after: { nome: entregador.nome, whatsapp: entregador.whatsapp, ativo: entregador.ativo },
    changedFields: ['nome', 'whatsapp', 'ativo'],
  });

  res.status(201).json(entregador);
});

exports.atualizar = asyncHandler(async (req, res) => {
  const prisma = require('../config/prisma');
  const existente = await prisma.entregador.findFirst({ where: { id: Number(req.params.id), empresaId: 1 } });
  if (!existente) return res.status(404).json({ error: 'Entregador não encontrado' });
  const entregador = await sql.atualizarEntregador(req.params.id, req.body);

  const changedFields = Object.keys(req.body);
  const before = {};
  const after = {};
  for (const key of changedFields) {
    before[key] = existente[key];
    after[key] = req.body[key];
  }

  auditService.audit({
    ...getCtx(req),
    action: 'entregador.update',
    module: 'entregadores',
    targetType: 'entregador',
    targetId: entregador.id,
    before,
    after,
    changedFields,
  });

  res.json(entregador);
});

exports.toggle = asyncHandler(async (req, res) => {
  const { ativo } = req.body;
  const prisma = require('../config/prisma');
  const existente = await prisma.entregador.findFirst({ where: { id: Number(req.params.id), empresaId: 1 } });
  if (!existente) return res.status(404).json({ error: 'Entregador não encontrado' });
  const entregador = await sql.toggleEntregador(req.params.id, ativo);

  auditService.audit({
    ...getCtx(req),
    action: 'entregador.toggle',
    module: 'entregadores',
    targetType: 'entregador',
    targetId: entregador.id,
    before: { ativo: existente.ativo },
    after: { ativo: entregador.ativo },
    changedFields: ['ativo'],
  });

  res.json(entregador);
});

exports.deletar = asyncHandler(async (req, res) => {
  const prisma = require('../config/prisma');
  const existente = await prisma.entregador.findFirst({ where: { id: Number(req.params.id), empresaId: 1 } });
  if (!existente) return res.status(404).json({ error: 'Entregador não encontrado' });

  auditService.audit({
    ...getCtx(req),
    action: 'entregador.delete',
    module: 'entregadores',
    targetType: 'entregador',
    targetId: Number(req.params.id),
    after: { nome: existente.nome, whatsapp: existente.whatsapp },
    changedFields: ['nome', 'whatsapp'],
    severity: 'warning',
  });

  await sql.deletarEntregador(req.params.id);
  res.json({ success: true });
});
