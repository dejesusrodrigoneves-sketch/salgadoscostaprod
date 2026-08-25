const sql = require('../repositories/sqlRepository');
const auditService = require('./auditService');

function sanitize(v) {
  if (typeof v !== 'string') return v;
  return v.trim().replace(/<[^>]*>/g, '');
}

async function listar(empresaId) {
  return sql.listarCategorias(empresaId);
}

async function buscar(id, empresaId) {
  const categoria = await sql.buscarCategoria(id, empresaId);
  if (!categoria) throw Object.assign(new Error('Categoria não encontrada'), { status: 404 });
  return categoria;
}

async function criar(data, ctx = {}) {
  const sanitized = { ...data };
  if (sanitized.nome) sanitized.nome = sanitize(sanitized.nome);
  const categoria = await sql.criarCategoria(sanitized);

  auditService.audit({
    ...ctx,
    action: 'categoria.create',
    module: 'categorias',
    targetType: 'categoria',
    targetId: categoria.id,
    after: { nome: categoria.nome },
    changedFields: Object.keys(sanitized),
  });

  return categoria;
}

async function atualizar(id, data, empresaId, ctx = {}) {
  const categoria = await sql.buscarCategoria(id, empresaId);
  if (!categoria) throw Object.assign(new Error('Categoria não encontrada'), { status: 404 });
  const sanitized = { ...data };
  if (sanitized.nome) sanitized.nome = sanitize(sanitized.nome);
  const atualizada = await sql.atualizarCategoria(id, sanitized);

  const changedFields = Object.keys(sanitized);
  const before = {};
  const after = {};
  for (const key of changedFields) {
    before[key] = categoria[key];
    after[key] = sanitized[key];
  }

  auditService.audit({
    ...ctx,
    action: 'categoria.update',
    module: 'categorias',
    targetType: 'categoria',
    targetId: id,
    before,
    after,
    changedFields,
  });

  return atualizada;
}

async function deletar(id, empresaId, ctx = {}) {
  const categoria = await sql.buscarCategoria(id, empresaId);
  if (!categoria) throw Object.assign(new Error('Categoria não encontrada'), { status: 404 });
  await sql.deletarCategoria(id);

  auditService.audit({
    ...ctx,
    action: 'categoria.delete',
    module: 'categorias',
    targetType: 'categoria',
    targetId: id,
    after: { nome: categoria.nome },
    changedFields: ['nome'],
    severity: 'warning',
  });
}

module.exports = { listar, buscar, criar, atualizar, deletar };
