const { Router } = require('express');
const auditRepository = require('../repositories/auditRepository');
const { authenticate, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

const router = Router();
router.use(authenticate, authorize('superadmin'));

router.get('/', asyncHandler(async (req, res) => {
  const { module, action, severity, dataInicio, dataFim, page, limit } = req.query;
  const rawActorId = req.query.actorId;
  const actorId = (rawActorId === 'anon' || rawActorId === 'null') ? null : rawActorId;
  const result = await auditRepository.listAudit({
    actorId, module, action, severity, dataInicio, dataFim, page, limit,
    empresaId: req.user.empresaId || 1,
  });
  res.json(result);
}));

router.get('/usuarios', asyncHandler(async (req, res) => {
  const actors = await auditRepository.listActors(req.user.empresaId || 1);
  res.json(actors);
}));

module.exports = router;
