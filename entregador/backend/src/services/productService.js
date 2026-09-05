const sql = require('../repositories/sqlRepository');
const auditService = require('./auditService');

function sanitize(v) {
  if (typeof v !== 'string') return v;
  return v.trim().replace(/<[^>]*>/g, '');
}

function sanitizeConfig(config) {
  if (!config || typeof config !== 'object') return null;
  const out = {};
  if (config.tipo === 'combo_salgado') {
    out.tipo = 'combo_salgado';
    out.unidades = Number(config.unidades) || 0;
    out.sabores = (Array.isArray(config.sabores) ? config.sabores : [])
      .map(s => {
        if (typeof s === 'string') return { nome: s.trim().replace(/<[^>]*>/g, ''), pausado: false };
        if (s && typeof s === 'object') return { nome: String(s.nome || '').trim().replace(/<[^>]*>/g, ''), pausado: !!s.pausado };
        return null;
      })
      .filter(s => s && s.nome);
  } else if (config.tipo === 'combo_acai') {
    out.tipo = 'combo_acai';
    out.acrescimosGratis = Number(config.acrescimosGratis) || 0;
    out.maxAcrescimos = Number(config.maxAcrescimos) || 0;
    out.acrescimos = (Array.isArray(config.acrescimos) ? config.acrescimos : [])
      .map(a => ({
        nome: String(a.nome || '').trim().replace(/<[^>]*>/g, ''),
        preco: Number(a.preco) || 0,
        pausado: !!a.pausado,
      }))
      .filter(a => a.nome);
  } else {
    return null;
  }
  return out;
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

async function listar(empresaId) {
  const produtos = await sql.listarProdutos(empresaId);
  return produtos.map(formatProduto);
}

async function buscar(id, empresaId) {
  const produto = await sql.buscarProduto(id, empresaId);
  if (!produto) throw Object.assign(new Error('Produto não encontrado'), { status: 404 });
  return formatProduto(produto);
}

async function criar(data, ctx = {}) {
  const sanitized = { ...data };
  if (sanitized.name) sanitized.name = sanitize(sanitized.name);
  if (sanitized.description) sanitized.description = sanitize(sanitized.description);
  if (sanitized.img) sanitized.img = sanitize(sanitized.img);
  if (sanitized.config) sanitized.config = sanitizeConfig(sanitized.config);
  const produto = await sql.criarProduto(sanitized);

  auditService.audit({
    ...ctx,
    action: 'produto.create',
    module: 'produtos',
    targetType: 'produto',
    targetId: produto.id,
    after: { name: produto.name, price: Number(produto.price), status: produto.status, estoqueAtual: produto.estoqueAtual },
    changedFields: Object.keys(sanitized),
  });

  return produto;
}

async function atualizar(id, data, empresaId, ctx = {}) {
  const produto = await sql.buscarProduto(id, empresaId);
  if (!produto) throw Object.assign(new Error('Produto não encontrado'), { status: 404 });
  const sanitized = { ...data };
  if (sanitized.name) sanitized.name = sanitize(sanitized.name);
  if (sanitized.description) sanitized.description = sanitize(sanitized.description);
  if (sanitized.img) sanitized.img = sanitize(sanitized.img);
  if (sanitized.config !== undefined) sanitized.config = sanitizeConfig(sanitized.config);
  const atualizado = await sql.atualizarProduto(id, sanitized);

  const changedFields = Object.keys(sanitized);
  const before = {};
  const after = {};
  for (const key of changedFields) {
    before[key] = produto[key];
    after[key] = sanitized[key];
  }

  auditService.audit({
    ...ctx,
    action: 'produto.update',
    module: 'produtos',
    targetType: 'produto',
    targetId: id,
    before,
    after,
    changedFields,
  });

  return atualizado;
}

async function deletar(id, empresaId, ctx = {}) {
  const produto = await sql.buscarProduto(id, empresaId);
  if (!produto) throw Object.assign(new Error('Produto não encontrado'), { status: 404 });
  await sql.deletarProduto(id);

  auditService.audit({
    ...ctx,
    action: 'produto.delete',
    module: 'produtos',
    targetType: 'produto',
    targetId: id,
    after: { name: produto.name, price: Number(produto.price), status: produto.status },
    changedFields: ['name', 'price', 'status'],
    severity: 'warning',
  });
}

module.exports = { listar, buscar, criar, atualizar, deletar };
