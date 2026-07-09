const sql = require('../repositories/sqlRepository');

async function listar() {
  return sql.listarProdutos();
}

async function buscar(id) {
  const produto = await sql.buscarProduto(id);
  if (!produto) throw Object.assign(new Error('Produto não encontrado'), { status: 404 });
  return produto;
}

async function criar(data) {
  return sql.criarProduto(data);
}

async function atualizar(id, data) {
  const produto = await sql.buscarProduto(id);
  if (!produto) throw Object.assign(new Error('Produto não encontrado'), { status: 404 });
  return sql.atualizarProduto(id, data);
}

async function deletar(id) {
  const produto = await sql.buscarProduto(id);
  if (!produto) throw Object.assign(new Error('Produto não encontrado'), { status: 404 });
  return sql.deletarProduto(id);
}

module.exports = { listar, buscar, criar, atualizar, deletar };
