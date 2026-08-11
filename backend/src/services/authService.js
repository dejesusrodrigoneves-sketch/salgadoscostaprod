const bcrypt = require('bcryptjs');
const sql = require('../repositories/sqlRepository');
const tokenService = require('./tokenService');
const auditService = require('./auditService');
const prisma = require('../config/prisma');

const SALT_ROUNDS = 10;

async function login(username, password, ip, userAgent, ctx = {}) {
  const base = {
    requestId: ctx.requestId || null,
    ip: ip || ctx.ip || null,
    userAgent: userAgent || ctx.userAgent || null,
    metadata: { url: ctx.path || null },
  };

  const user = await sql.buscarUsuario(username);
  if (!user) {
    auditService.audit({
      ...base,
      action: 'auth.login_failed',
      module: 'auth',
      actorType: 'anon',
      actorUsername: username,
      severity: 'warning',
      reason: 'usuario_nao_encontrado',
    });
    throw Object.assign(new Error('Credenciais inválidas'), { status: 401 });
  }

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) {
    auditService.audit({
      ...base,
      action: 'auth.login_failed',
      module: 'auth',
      actorType: 'admin',
      actorId: user.id,
      actorUsername: user.username,
      actorRole: user.role,
      severity: 'warning',
      reason: 'senha_incorreta',
    });
    throw Object.assign(new Error('Credenciais inválidas'), { status: 401 });
  }

  const payload = { id: user.id, username: user.username, role: user.role, empresaId: 1, lojaNome: user.lojaNome };
  const token = tokenService.gerarToken(payload);

  auditService.audit({
    ...base,
    action: 'auth.login',
    module: 'auth',
    actorType: 'admin',
    actorId: user.id,
    actorUsername: user.username,
    actorRole: user.role,
  });

  return { token, user: { id: user.id, username: user.username, role: user.role, lojaNome: user.lojaNome } };
}

async function criarUsuario(data, ctx = {}) {
  const existing = await sql.buscarUsuario(data.username);
  if (existing) {
    auditService.audit({
      requestId: ctx.requestId || null,
      ip: ctx.ip || null,
      userAgent: ctx.userAgent || null,
      action: 'user.create_failed',
      module: 'usuarios',
      ...(ctx.actor || {}),
      targetType: 'usuario',
      targetId: existing.id,
      severity: 'warning',
      reason: 'usuario_existe',
      metadata: { url: ctx.path || null },
    });
    throw Object.assign(new Error('Usuário já existe'), { status: 409 });
  }

  const hash = await bcrypt.hash(data.password, SALT_ROUNDS);
  const user = await sql.criarUsuario({ ...data, passwordHash: hash });

  auditService.audit({
    requestId: ctx.requestId || null,
    ip: ctx.ip || null,
    userAgent: ctx.userAgent || null,
    action: 'user.create',
    module: 'usuarios',
    ...(ctx.actor || {}),
    targetType: 'usuario',
    targetId: user.id,
    after: { username: user.username, role: user.role },
    changedFields: ['username', 'role', 'passwordHash'],
    metadata: { url: ctx.path || null },
  });

  return user;
}

async function alterarSenha(userId, senhaAtual, novaSenha, ctx = {}) {
  const user = await sql.buscarUsuarioPorId(userId);
  const base = {
    requestId: ctx.requestId || null,
    ip: ctx.ip || null,
    userAgent: ctx.userAgent || null,
    actorType: 'admin',
    actorId: user.id,
    actorUsername: user.username,
    actorRole: user.role,
    targetType: 'usuario',
    targetId: user.id,
    metadata: { url: ctx.path || null },
  };

  const match = await bcrypt.compare(senhaAtual, user.passwordHash);
  if (!match) {
    auditService.audit({
      ...base,
      action: 'auth.change_password_failed',
      module: 'auth',
      severity: 'warning',
      reason: 'senha_atual_incorreta',
    });
    throw Object.assign(new Error('Senha atual incorreta'), { status: 400 });
  }
  const hash = await bcrypt.hash(novaSenha, SALT_ROUNDS);
  await sql.atualizarUsuario(userId, { passwordHash: hash });

  auditService.audit({
    ...base,
    action: 'auth.change_password',
    module: 'auth',
    changedFields: ['passwordHash'],
  });
}

async function criarConta({ username, password, lojaNome }, ctx = {}) {
  const existing = await sql.buscarUsuario(username);
  if (existing) {
    auditService.audit({
      requestId: ctx.requestId || null,
      ip: ctx.ip || null,
      userAgent: ctx.userAgent || null,
      action: 'auth.register_failed',
      module: 'auth',
      actorType: 'anon',
      actorUsername: username,
      targetType: 'usuario',
      targetId: existing.id,
      severity: 'warning',
      reason: 'usuario_existe',
      metadata: { url: ctx.path || null },
    });
    throw Object.assign(new Error('Usuário já existe'), { status: 409 });
  }

  const hash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await sql.criarUsuario({
    empresaId: 1,
    username,
    passwordHash: hash,
    lojaNome: lojaNome || username,
    role: 'admin',
  });

  auditService.audit({
    requestId: ctx.requestId || null,
    ip: ctx.ip || null,
    userAgent: ctx.userAgent || null,
    action: 'auth.register',
    module: 'auth',
    actorType: 'admin',
    actorId: user.id,
    actorUsername: user.username,
    actorRole: user.role,
    targetType: 'usuario',
    targetId: user.id,
    changedFields: ['username', 'role', 'passwordHash'],
    metadata: { url: ctx.path || null },
  });

  const payload = { id: user.id, username: user.username, role: user.role, empresaId: user.empresaId, lojaNome: user.lojaNome };
  const token = tokenService.gerarToken(payload);

  return { token, user: { id: user.id, username: user.username, role: user.role, lojaNome: user.lojaNome } };
}

module.exports = { login, criarUsuario, alterarSenha, criarConta };
