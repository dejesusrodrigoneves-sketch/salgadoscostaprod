const sql = require('../repositories/sqlRepository');

async function listar(empresaId) {
  return sql.listarProdutos(empresaId);
}

async function buscar(empresaId, id) {
  const produto = await sql.buscarProduto(empresaId, id);
  if (!produto) throw Object.assign(new Error('Produto não encontrado'), { status: 404 });
  return produto;
}

async function criar(data) {
  return sql.criarProduto(data);
}

async function atualizar(empresaId, id, data) {
  const produto = await sql.buscarProduto(empresaId, id);
  if (!produto) throw Object.assign(new Error('Produto não encontrado'), { status: 404 });
  return sql.atualizarProduto(id, data);
}

async function deletar(empresaId, id) {
  const produto = await sql.buscarProduto(empresaId, id);
  if (!produto) throw Object.assign(new Error('Produto não encontrado'), { status: 404 });
  return sql.deletarProduto(id);
}

module.exports = { listar, buscar, criar, atualizar, deletar };
