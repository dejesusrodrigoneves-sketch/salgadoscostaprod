const productService = require('../services/productService');
const { asyncHandler } = require('../middleware/errorHandler');

exports.listar = asyncHandler(async (req, res) => {
  const produtos = await productService.listar(req.user.empresaId);
  res.json(produtos);
});

exports.buscar = asyncHandler(async (req, res) => {
  const produto = await productService.buscar(req.user.empresaId, req.params.id);
  res.json(produto);
});

exports.criar = asyncHandler(async (req, res) => {
  const produto = await productService.criar({ ...req.body, empresaId: req.user.empresaId });
  res.status(201).json(produto);
});

exports.atualizar = asyncHandler(async (req, res) => {
  const produto = await productService.atualizar(req.user.empresaId, req.params.id, req.body);
  res.json(produto);
});

exports.deletar = asyncHandler(async (req, res) => {
  await productService.deletar(req.user.empresaId, req.params.id);
  res.json({ success: true });
});
