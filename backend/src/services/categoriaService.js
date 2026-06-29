const sql = require('../repositories/sqlRepository');

async function listar(empresaId) {
  return sql.listarCategorias(empresaId);
}

async function buscar(empresaId, id) {
  const categoria = await sql.buscarCategoria(empresaId, id);
  if (!categoria) throw Object.assign(new Error('Categoria não encontrada'), { status: 404 });
  return categoria;
}

async function criar(data) {
  return sql.criarCategoria(data);
}

async function atualizar(empresaId, id, data) {
  const categoria = await sql.buscarCategoria(empresaId, id);
  if (!categoria) throw Object.assign(new Error('Categoria não encontrada'), { status: 404 });
  return sql.atualizarCategoria(id, data);
}

async function deletar(empresaId, id) {
  const categoria = await sql.buscarCategoria(empresaId, id);
  if (!categoria) throw Object.assign(new Error('Categoria não encontrada'), { status: 404 });
  await sql.deletarCategoria(id);
}

module.exports = { listar, buscar, criar, atualizar, deletar };
