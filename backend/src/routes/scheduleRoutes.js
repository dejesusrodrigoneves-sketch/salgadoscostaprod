const { Router } = require('express');
const sql = require('../repositories/sqlRepository');
const { authenticate, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

const router = Router();

router.get('/', authenticate, asyncHandler(async (req, res) => {
  const horarios = await sql.buscarHorarios(req.user.empresaId);
  res.json(horarios);
}));

router.put('/', authenticate, authorize('superadmin', 'admin'), asyncHandler(async (req, res) => {
  const horarios = await sql.upsertHorarios(req.user.empresaId, req.body);
  res.json(horarios);
}));

module.exports = router;
