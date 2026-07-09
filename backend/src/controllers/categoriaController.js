const service = require('../services/categoriaService');
const { asyncHandler } = require('../middleware/errorHandler');

exports.listar = asyncHandler(async (req, res) => {
  const categorias = await service.listar();
  res.json(categorias);
});

exports.buscar = asyncHandler(async (req, res) => {
  const categoria = await service.buscar(req.params.id);
  res.json(categoria);
});

exports.criar = asyncHandler(async (req, res) => {
  const categoria = await service.criar({ ...req.body, empresaId: 1 });
  res.status(201).json(categoria);
});

exports.atualizar = asyncHandler(async (req, res) => {
  const categoria = await service.atualizar(req.params.id, req.body);
  res.json(categoria);
});

exports.deletar = asyncHandler(async (req, res) => {
  await service.deletar(req.params.id);
  res.json({ success: true });
});
