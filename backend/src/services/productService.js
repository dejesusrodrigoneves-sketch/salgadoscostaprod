const sql = require('../repositories/sqlRepository');

function sanitize(v) {
  if (typeof v !== 'string') return v;
  return v.trim().replace(/<[^>]*>/g, '');
}

function formatImageUrl(img) {
  if (!img) return null;
  if (img.startsWith('http')) return img;
  const base = process.env.SUPABASE_URL;
  if (!base) return img;
  return `${base}/storage/v1/object/public/produtos/${img}`;
}

function formatProduto(p) {
  if (!p) return p;
  return { ...p, img: formatImageUrl(p.img) };
}

async function listar() {
  const produtos = await sql.listarProdutos();
  return produtos.map(formatProduto);
}

async function buscar(id) {
  const produto = await sql.buscarProduto(id);
  if (!produto) throw Object.assign(new Error('Produto não encontrado'), { status: 404 });
  return formatProduto(produto);
}

async function criar(data) {
  const sanitized = { ...data };
  if (sanitized.name) sanitized.name = sanitize(sanitized.name);
  if (sanitized.description) sanitized.description = sanitize(sanitized.description);
  if (sanitized.img) sanitized.img = sanitize(sanitized.img);
  return sql.criarProduto(sanitized);
}

async function atualizar(id, data) {
  const produto = await sql.buscarProduto(id);
  if (!produto) throw Object.assign(new Error('Produto não encontrado'), { status: 404 });
  const sanitized = { ...data };
  if (sanitized.name) sanitized.name = sanitize(sanitized.name);
  if (sanitized.description) sanitized.description = sanitize(sanitized.description);
  if (sanitized.img) sanitized.img = sanitize(sanitized.img);
  return sql.atualizarProduto(id, sanitized);
}

async function deletar(id) {
  const produto = await sql.buscarProduto(id);
  if (!produto) throw Object.assign(new Error('Produto não encontrado'), { status: 404 });
  return sql.deletarProduto(id);
}

module.exports = { listar, buscar, criar, atualizar, deletar };
