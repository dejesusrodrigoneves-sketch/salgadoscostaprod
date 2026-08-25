const { Router } = require('express');
const sql = require('../repositories/sqlRepository');
const { authenticate, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

const router = Router();

function empresaId(req) {
  return req.ctx?.empresaId || req.user?.empresaId;
}

router.get('/', authenticate, asyncHandler(async (req, res) => {
  const horarios = await sql.buscarHorarios(empresaId(req));
  res.json(horarios);
}));

router.put('/', authenticate, authorize('superadmin', 'admin'), asyncHandler(async (req, res) => {
  const horarios = await sql.upsertHorarios(empresaId(req), req.body);
  res.json(horarios);
}));

module.exports = router;
