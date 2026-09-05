const { Router } = require('express');
const controller = require('../controllers/whatsappController');
const { authenticate, authorize } = require('../middleware/auth');

const router = Router();

router.get('/', authenticate, controller.listar);
router.post('/criar', authenticate, authorize('superadmin', 'admin', 'user'), controller.criar);
router.delete('/:id', authenticate, authorize('superadmin', 'admin', 'user'), controller.deletar);
router.post('/:id/qrcode', authenticate, authorize('superadmin', 'admin', 'user'), controller.qrCode);
router.post('/:id/reconectar', authenticate, authorize('superadmin', 'admin', 'user'), controller.reconectar);
router.get('/:id/status', authenticate, controller.status);
router.post('/:id/teste', authenticate, authorize('superadmin', 'admin', 'user'), controller.enviarTeste);
router.post('/pedido/:id/contato', authenticate, authorize('superadmin', 'admin', 'user'), controller.enviarContatoPedido);

module.exports = router;
