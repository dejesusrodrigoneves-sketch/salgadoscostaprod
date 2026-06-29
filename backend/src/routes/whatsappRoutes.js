const { Router } = require('express');
const controller = require('../controllers/whatsappController');
const { authenticate, authorize } = require('../middleware/auth');

const router = Router();

router.get('/', authenticate, controller.listar);
router.post('/criar', authenticate, authorize('superadmin', 'admin'), controller.criar);
router.delete('/:id', authenticate, authorize('superadmin', 'admin'), controller.deletar);
router.post('/:id/qrcode', authenticate, authorize('superadmin', 'admin'), controller.qrCode);
router.post('/:id/reconectar', authenticate, authorize('superadmin', 'admin'), controller.reconectar);
router.get('/:id/status', authenticate, controller.status);
router.post('/:id/teste', authenticate, authorize('superadmin', 'admin'), controller.enviarTeste);

module.exports = router;
