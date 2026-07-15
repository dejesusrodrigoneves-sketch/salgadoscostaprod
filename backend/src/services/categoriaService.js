const sql = require('../repositories/sqlRepository');

function sanitize(v) {
  if (typeof v !== 'string') return v;
  return v.trim().replace(/<[^>]*>/g, '');
}

async function listar() {
  return sql.listarCategorias();
}

async function buscar(id) {
  const categoria = await sql.buscarCategoria(id);
  if (!categoria) throw Object.assign(new Error('Categoria não encontrada'), { status: 404 });
  return categoria;
}

async function criar(data) {
  const sanitized = { ...data };
  if (sanitized.nome) sanitized.nome = sanitize(sanitized.nome);
  return sql.criarCategoria(sanitized);
}

async function atualizar(id, data) {
  const categoria = await sql.buscarCategoria(id);
  if (!categoria) throw Object.assign(new Error('Categoria não encontrada'), { status: 404 });
  const sanitized = { ...data };
  if (sanitized.nome) sanitized.nome = sanitize(sanitized.nome);
  return sql.atualizarCategoria(id, sanitized);
}

async function deletar(id) {
  const categoria = await sql.buscarCategoria(id);
  if (!categoria) throw Object.assign(new Error('Categoria não encontrada'), { status: 404 });
  await sql.deletarCategoria(id);
}

module.exports = { listar, buscar, criar, atualizar, deletar };
