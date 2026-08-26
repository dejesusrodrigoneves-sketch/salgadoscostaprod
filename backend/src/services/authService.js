const bcrypt = require('bcryptjs');
const sql = require('../repositories/sqlRepository');
const tokenService = require('./tokenService');
const auditService = require('./auditService');
const prisma = require('../config/prisma');

const SALT_ROUNDS = 10;
const ROLES_VALIDOS = ['user', 'admin', 'superadmin'];

// Account lockout: track failed attempts per username
const failedAttempts = new Map();
const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

function isLockedOut(username) {
  const record = failedAttempts.get(username);
  if (!record) return false;
  if (Date.now() - record.lastAttempt > LOCKOUT_DURATION) {
    failedAttempts.delete(username);
    return false;
  }
  return record.count >= LOCKOUT_THRESHOLD;
}

function recordFailedAttempt(username) {
  const record = failedAttempts.get(username) || { count: 0, lastAttempt: 0 };
  record.count++;
  record.lastAttempt = Date.now();
  failedAttempts.set(username, record);
}

function clearFailedAttempts(username) {
  failedAttempts.delete(username);
}

async function login(username, password, empresaId, ip, userAgent, ctx = {}) {
  const base = {
    requestId: ctx.requestId || null,
    ip: ip || ctx.ip || null,
    userAgent: userAgent || ctx.userAgent || null,
    metadata: { url: ctx.path || null },
  };

  // Account lockout check
  if (isLockedOut(username)) {
    throw Object.assign(new Error('Conta temporariamente bloqueada. Tente novamente em 15 minutos.'), { status: 429 });
  }

  let user = await sql.buscarUsuario(username, undefined);
  if (!user) user = await sql.buscarUsuarioSuperadmin(username);

  // Verificar se empresa está deletada
  if (user && user.empresaId) {
    const empresa = await sql.buscarEmpresa(user.empresaId);
    if (empresa && empresa.deletedAt) {
      throw Object.assign(new Error('Empresa inativa'), { status: 403 });
    }
  }

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
    recordFailedAttempt(username);
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
    recordFailedAttempt(username);
    throw Object.assign(new Error('Credenciais inválidas'), { status: 401 });
  }

  // Clear failed attempts on successful login
  clearFailedAttempts(username);

  // Superadmin sempre empresaId null (acesso global)
  const payload = {
    id: user.id,
    username: user.username,
    role: user.role,
    empresaId: user.role === 'superadmin' ? null : user.empresaId,
    lojaNome: user.lojaNome || null,
  };
  const token = tokenService.gerarToken(payload);
  const refreshToken = tokenService.gerarRefreshToken(payload);

  auditService.audit({
    ...base,
    action: 'auth.login',
    module: 'auth',
    actorType: 'admin',
    actorId: user.id,
    actorUsername: user.username,
    actorRole: user.role,
  });

  return { token, refreshToken, user: { id: user.id, username: user.username, role: user.role, lojaNome: user.lojaNome } };
}

async function criarUsuario(data, ctx = {}) {
  const existing = await sql.buscarUsuario(data.username, data.empresaId);
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

  const roleNorm = ROLES_VALIDOS.includes(data.role) ? data.role : 'user';
  // Password complexity validation
  if (data.password && data.password.length >= 6 && (!/[A-Z]/.test(data.password) || !/[a-z]/.test(data.password) || !/[0-9]/.test(data.password))) {
    throw Object.assign(new Error('Senha deve conter maiúscula, minúscula e número'), { status: 400 });
  }
  const hash = await bcrypt.hash(data.password, SALT_ROUNDS);
  const user = await sql.criarUsuario({ ...data, role: roleNorm, passwordHash: hash });

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
  if (!user) throw Object.assign(new Error('Usuário não encontrado'), { status: 404 });
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

async function criarConta({ username, password, lojaNome, empresaId }, ctx = {}) {
  if (!empresaId) {
    throw Object.assign(new Error('empresaId obrigatório'), { status: 400 });
  }
  const existing = await sql.buscarUsuario(username, undefined);
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
    empresaId,
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
