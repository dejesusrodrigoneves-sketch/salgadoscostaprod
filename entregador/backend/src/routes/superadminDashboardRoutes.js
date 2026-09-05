// backend/src/routes/superadminDashboardRoutes.js (CJS)
const { Router } = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const { getSummaryController, getEmpresasController } = require('../controllers/superadminDashboardController');

const router = Router();

router.get('/summary', authenticate, authorize('superadmin'), getSummaryController);
router.get('/empresas', authenticate, authorize('superadmin'), getEmpresasController);

module.exports = router;