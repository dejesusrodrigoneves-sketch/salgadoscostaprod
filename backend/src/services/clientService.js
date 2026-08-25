const sqlRepo = require('../repositories/sqlRepository');
const bcrypt = require('bcryptjs');
const auditService = require('./auditService');

const DEFAULT_SALT_ROUNDS = 10;

// Dependências injetáveis para testes (padrão puro+injetado do entregaService).
function deps(overrides = {}) {
  return { sql: sqlRepo, bcrypt, auditService, SALT_ROUNDS: DEFAULT_SALT_ROUNDS, ...overrides };
}

function base(ctx) {
  return {
    requestId: ctx.requestId || null,
    ip: ctx.ip || null,
    userAgent: ctx.userAgent || null,
    ...(ctx.actor || {}),
    metadata: { url: ctx.path || null },
  };
}

async function listarClientes(empresaId, d = deps()) {
  const clientes = await d.sql.listarClientes(empresaId);
  return clientes.map(function (c) {
    return {
      id: c.id,
      nome: c.nome,
      telefone: c.telefone,
      endereco: c.endereco,
      numero: c.numero,
      bairro: c.bairro,
      cep: c.cep,
      pontoReferencia: c.pontoReferencia,
      createdAt: c.createdAt,
      consentimentoAt: c.consentimentoAt,
      consentimentoRevogadoAt: c.consentimentoRevogadoAt,
    };
  });
}

async function atualizarCliente(id, data, ctx = {}, d = deps()) {
  const clienteId = Number(id);
  const existente = await d.sql.buscarClientePorId(clienteId);
  if (!existente) throw Object.assign(new Error('Cliente não encontrado'), { status: 404 });

  const body = { ...data };
  delete body.passwordHash;
  delete body.id;

  if (body.telefone !== undefined) {
    const outro = await d.sql.buscarCliente(body.telefone);
    if (outro && outro.id !== clienteId) {
      throw Object.assign(new Error('Telefone já cadastrado por outro cliente'), { status: 409 });
    }
  }

  const cliente = await d.sql.atualizarCliente(clienteId, body);
  delete cliente.passwordHash;

  const changedFields = Object.keys(body).filter(function (k) { return body[k] !== undefined; });
  const before = {};
  const after = {};
  for (const key of changedFields) { before[key] = existente[key]; after[key] = body[key]; }

  await d.auditService.audit({
    ...base(ctx),
    action: 'cliente.admin_update',
    module: 'clientes',
    targetType: 'cliente',
    targetId: clienteId,
    before,
    after,
    changedFields,
  });

  return cliente;
}

async function resetarSenha(id, password, ctx = {}, d = deps()) {
  const clienteId = Number(id);
  const existente = await d.sql.buscarClientePorId(clienteId);
  if (!existente) throw Object.assign(new Error('Cliente não encontrado'), { status: 404 });
  if (!password || String(password).length < 6) {
    throw Object.assign(new Error('Senha deve ter 6+ caracteres'), { status: 400 });
  }

  const hash = await d.bcrypt.hash(password, d.SALT_ROUNDS);
  await d.sql.atualizarCliente(clienteId, { passwordHash: hash });

  await d.auditService.audit({
    ...base(ctx),
    action: 'cliente.admin_reset_password',
    module: 'clientes',
    targetType: 'cliente',
    targetId: clienteId,
    changedFields: ['passwordHash'],
    severity: 'critical',
  });

  return { success: true };
}

async function deletarCliente(id, ctx = {}, d = deps()) {
  const clienteId = Number(id);
  const existente = await d.sql.buscarClientePorId(clienteId);
  if (!existente) throw Object.assign(new Error('Cliente não encontrado'), { status: 404 });

  await d.sql.deletarCliente(clienteId);

  await d.auditService.audit({
    ...base(ctx),
    action: 'cliente.admin_delete',
    module: 'clientes',
    targetType: 'cliente',
    targetId: clienteId,
    after: { nome: existente.nome, telefone: existente.telefone },
    changedFields: ['*'],
    severity: 'critical',
  });

  return { success: true };
}

module.exports = { listarClientes, atualizarCliente, resetarSenha, deletarCliente };