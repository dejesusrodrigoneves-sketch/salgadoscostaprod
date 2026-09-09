const { Router } = require('express');
const sql = require('../repositories/sqlRepository');
const authService = require('../services/authService');
const { authenticate, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const clientAdminController = require('../controllers/clientAdminController');
const orderController = require('../controllers/orderController');
const adminController = require('../controllers/adminController');

const router = Router();

// Filiais routes (before superadmin gate)
router.post('/filiais', authenticate, authorize('superadmin', 'admin'), adminController.criarFilial);
router.get('/filiais/pendentes', authenticate, authorize('superadmin'), adminController.listarFiliaisPendentes);
router.get('/empresas/:id/filiais', authenticate, authorize('superadmin', 'admin'), adminController.listarFiliais);
router.put('/filiais/:id/approve', authenticate, authorize('superadmin'), adminController.aprovarFilial);
router.delete('/filiais/:id', authenticate, authorize('superadmin', 'admin'), adminController.deletarFilial);
router.put('/empresas/:id/parent', authenticate, authorize('superadmin', 'admin'), adminController.atualizarParent);

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

router.put('/empresas/:id/theme/pending', adminController.enviarTemaPendente);
router.put('/empresas/:id/theme/approve', adminController.aprovarTema);

module.exports = router;
