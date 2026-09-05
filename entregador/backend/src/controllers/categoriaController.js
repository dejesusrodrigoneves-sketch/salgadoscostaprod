const service = require('../services/categoriaService');
const { asyncHandler } = require('../middleware/errorHandler');
const { getCtx } = require('../middleware/context');

function empresaId(req) {
  return req.ctx?.empresaId || req.user?.empresaId;
}

exports.listar = asyncHandler(async (req, res) => {
  const categorias = await service.listar(empresaId(req));
  res.json(categorias);
});

exports.buscar = asyncHandler(async (req, res) => {
  const categoria = await service.buscar(req.params.id, empresaId(req));
  res.json(categoria);
});

exports.criar = asyncHandler(async (req, res) => {
  const categoria = await service.criar({ ...req.body, empresaId: empresaId(req) }, getCtx(req));
  res.status(201).json(categoria);
});

exports.atualizar = asyncHandler(async (req, res) => {
  const categoria = await service.atualizar(req.params.id, req.body, empresaId(req), getCtx(req));
  res.json(categoria);
});

exports.deletar = asyncHandler(async (req, res) => {
  await service.deletar(req.params.id, empresaId(req), getCtx(req));
  res.json({ success: true });
});
