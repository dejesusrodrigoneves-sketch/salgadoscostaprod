const { Router } = require('express');
const controller = require('../controllers/entregaController');
const { authenticate, authorize } = require('../middleware/auth');

const router = Router();

router.get('/resumo', authenticate, authorize('superadmin', 'admin'), controller.resumo);
router.get('/', authenticate, authorize('superadmin', 'admin'), controller.listar);
router.post('/', authenticate, authorize('superadmin', 'admin'), controller.registrar);
router.delete('/:pedidoId', authenticate, authorize('superadmin', 'admin'), controller.remover);

module.exports = router;
