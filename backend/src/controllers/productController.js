const productService = require('../services/productService');
const { asyncHandler } = require('../middleware/errorHandler');
const { getCtx } = require('../middleware/context');

function empresaId(req) {
  return req.ctx?.empresaId || req.user?.empresaId;
}

exports.listar = asyncHandler(async (req, res) => {
  const produtos = await productService.listar(empresaId(req));
  res.json(produtos);
});

exports.buscar = asyncHandler(async (req, res) => {
  const produto = await productService.buscar(req.params.id, empresaId(req));
  res.json(produto);
});

exports.criar = asyncHandler(async (req, res) => {
  const produto = await productService.criar({ ...req.body, empresaId: empresaId(req) }, getCtx(req));
  res.status(201).json(produto);
});

exports.atualizar = asyncHandler(async (req, res) => {
  const produto = await productService.atualizar(req.params.id, req.body, empresaId(req), getCtx(req));
  res.json(produto);
});

exports.deletar = asyncHandler(async (req, res) => {
  await productService.deletar(req.params.id, empresaId(req), getCtx(req));
  res.json({ success: true });
});
