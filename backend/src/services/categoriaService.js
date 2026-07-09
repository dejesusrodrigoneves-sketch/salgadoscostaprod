const sql = require('../repositories/sqlRepository');

async function listar() {
  return sql.listarCategorias();
}

async function buscar(id) {
  const categoria = await sql.buscarCategoria(id);
  if (!categoria) throw Object.assign(new Error('Categoria não encontrada'), { status: 404 });
  return categoria;
}

async function criar(data) {
  return sql.criarCategoria(data);
}

async function atualizar(id, data) {
  const categoria = await sql.buscarCategoria(id);
  if (!categoria) throw Object.assign(new Error('Categoria não encontrada'), { status: 404 });
  return sql.atualizarCategoria(id, data);
}

async function deletar(id) {
  const categoria = await sql.buscarCategoria(id);
  if (!categoria) throw Object.assign(new Error('Categoria não encontrada'), { status: 404 });
  await sql.deletarCategoria(id);
}

module.exports = { listar, buscar, criar, atualizar, deletar };
