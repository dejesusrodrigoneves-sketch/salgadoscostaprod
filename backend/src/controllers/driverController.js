const sql = require('../repositories/sqlRepository');
const auditService = require('../services/auditService');
const { getCtx } = require('../middleware/context');
const { asyncHandler } = require('../middleware/errorHandler');
const bcrypt = require('bcryptjs');

function empresaId(req) {
  return req.ctx?.empresaId || req.user?.empresaId;
}

exports.listar = asyncHandler(async (req, res) => {
  const where = { empresaId: empresaId(req) };
  if (req.query.ativo === 'true') where.ativo = true;
  const prisma = require('../config/prisma');
  const entregadores = await prisma.entregador.findMany({
    where,
    orderBy: req.query.sort === 'criadoEm' ? { createdAt: 'desc' } : { nome: 'asc' },
  });
  res.json(entregadores);
});

exports.criar = asyncHandler(async (req, res) => {
  const prisma = require('../config/prisma');
  const { nome, telefone, whatsapp, endereco, chavePix } = req.body;
  const eId = empresaId(req);

  // Generate provisional password (format: SIC-XXXX)
  const provisionalPassword = 'SIC-' + Math.random().toString(36).substring(2, 6).toUpperCase();
  const passwordHash = await bcrypt.hash(provisionalPassword, 10);

  // Create Entregador
  const entregador = await prisma.entregador.create({
    data: {
      nome,
      telefone,
      whatsapp,
      endereco,
      chavePix,
      empresaId: eId,
      passwordHash,
      mustChangePassword: true,
    },
  });

  // Auto-create Usuario with role 'entregador'
  const usuario = await prisma.usuario.create({
    data: {
      username: telefone,
      passwordHash,
      role: 'entregador',
      lojaNome: nome,
      empresaId: eId,
    },
  });

  // Link entregador to usuario
  await prisma.entregador.update({
    where: { id: entregador.id },
    data: { usuarioId: usuario.id },
  });

  auditService.audit({
    ...getCtx(req),
    action: 'entregador.create',
    module: 'entregadores',
    targetType: 'entregador',
    targetId: entregador.id,
    after: { nome: entregador.nome, whatsapp: entregador.whatsapp, ativo: entregador.ativo },
    changedFields: ['nome', 'whatsapp', 'ativo'],
  });

  // Return entregador with provisional password (for admin to share via WhatsApp)
  res.status(201).json({ ...entregador, provisionalPassword });
});

exports.atualizar = asyncHandler(async (req, res) => {
  const prisma = require('../config/prisma');
  const existente = await prisma.entregador.findFirst({ where: { id: Number(req.params.id), empresaId: empresaId(req) } });
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
  const existente = await prisma.entregador.findFirst({ where: { id: Number(req.params.id), empresaId: empresaId(req) } });
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
  const existente = await prisma.entregador.findFirst({ where: { id: Number(req.params.id), empresaId: empresaId(req) } });
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
