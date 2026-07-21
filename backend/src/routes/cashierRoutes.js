const { Router } = require('express');
const controller = require('../controllers/cashierController');
const { authenticate, authorize } = require('../middleware/auth');

const router = Router();

router.get('/hoje', authenticate, authorize('superadmin', 'admin'), controller.hoje);
router.post('/abrir', authenticate, authorize('superadmin', 'admin'), controller.abrir);
router.post('/fechar', authenticate, authorize('superadmin', 'admin'), controller.fechar);
router.get('/relatorios', authenticate, authorize('superadmin', 'admin'), controller.relatorios);

module.exports = router;
