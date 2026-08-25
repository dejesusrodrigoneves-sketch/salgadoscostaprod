const { Router } = require('express');
const sql = require('../repositories/sqlRepository');
const authService = require('../services/authService');
const { authenticate, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const clientAdminController = require('../controllers/clientAdminController');
const orderController = require('../controllers/orderController');
const adminController = require('../controllers/adminController');

const router = Router();

router.get('/pedidos/preview-limpeza', authenticate, authorize('superadmin', 'admin'), orderController.previewLimpeza);
router.post('/pedidos/limpar-expirados', authenticate, authorize('superadmin', 'admin'), orderController.executarLimpeza);

router.use(authenticate, authorize('superadmin'));

router.get('/', adminController.listar);
router.post('/', adminController.criar);
router.put('/:id', adminController.atualizar);
router.delete('/:id', adminController.deletar);

router.get('/clientes', clientAdminController.listar);
router.put('/clientes/:id', clientAdminController.atualizar);
router.put('/clientes/:id/password', clientAdminController.resetarSenha);
router.delete('/clientes/:id', clientAdminController.deletar);

router.delete('/empresa/:id/payment', adminController.deactivatePayment);

module.exports = router;
