const bcrypt = require('bcryptjs');
const prisma = require('../config/prisma');
const auditService = require('./auditService');

const SALT_ROUNDS = 10;
const ROLES_VALIDOS = ['user', 'admin', 'superadmin'];

function base(ctx) {
  return {
    requestId: ctx.requestId || null,
    ip: ctx.ip || null,
    userAgent: ctx.userAgent || null,
    ...(ctx.actor || {}),
    metadata: { url: ctx.path || null },
  };
}

async function listar(empresaId) {
  return prisma.usuario.findMany({
    where: { empresaId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, username: true, role: true, lojaNome: true, createdAt: true },
  });
}

async function criar({ username, password, lojaNome, role, empresaId }, ctx = {}) {
  if (!empresaId) throw Object.assign(new Error('empresaId obrigatório'), { status: 400 });
  const existing = await prisma.usuario.findUnique({ where: { empresaId_username: { empresaId, username } } });
  if (existing) {
    auditService.audit({
      ...base(ctx),
      action: 'user.create_failed',
      module: 'usuarios',
      targetType: 'usuario',
      targetId: existing.id,
      severity: 'warning',
      reason: 'usuario_existe',
    });
    throw Object.assign(new Error('Usuário já existe'), { status: 409 });
  }

  const roleNorm = ROLES_VALIDOS.includes(role) ? role : 'user';
  const hash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await prisma.usuario.create({
    data: { empresaId, username, passwordHash: hash, lojaNome: lojaNome || username, role: roleNorm },
    select: { id: true, username: true, role: true, lojaNome: true },
  });

  auditService.audit({
    ...base(ctx),
    action: 'user.create',
    module: 'usuarios',
    targetType: 'usuario',
    targetId: user.id,
    after: { username: user.username, role: user.role },
    changedFields: ['username', 'role', 'passwordHash'],
  });

  return user;
}

async function deletar(id, empresaId, ctx = {}) {
  const user = await prisma.usuario.findFirst({
    where: { id: Number(id), empresaId },
    select: { id: true, username: true, role: true },
  });
  if (!user) throw Object.assign(new Error('Usuário não encontrado'), { status: 404 });

  await prisma.usuario.delete({ where: { id: user.id } });

  await auditService.audit({
    ...base(ctx),
    action: 'user.delete',
    module: 'usuarios',
    targetType: 'usuario',
    targetId: user.id,
    after: { username: user.username, role: user.role },
    changedFields: ['username', 'role'],
    severity: 'critical',
  });

  return { success: true };
}

async function resetarSenha(id, password, empresaId, ctx = {}) {
  const user = await prisma.usuario.findFirst({
    where: { id: Number(id), empresaId },
    select: { id: true, username: true, role: true },
  });
  if (!user) throw Object.assign(new Error('Usuário não encontrado'), { status: 404 });

  const hash = await bcrypt.hash(password, SALT_ROUNDS);
  await prisma.usuario.update({ where: { id: user.id }, data: { passwordHash: hash } });

  await auditService.audit({
    ...base(ctx),
    action: 'user.reset_password',
    module: 'usuarios',
    targetType: 'usuario',
    targetId: user.id,
    changedFields: ['passwordHash'],
    severity: 'critical',
  });

  return { success: true };
}

async function listarLogins() {
  return prisma.loginLog.findMany({
    orderBy: { loggedAt: 'desc' },
    take: 100,
  });
}

module.exports = { listar, criar, deletar, resetarSenha, listarLogins };
