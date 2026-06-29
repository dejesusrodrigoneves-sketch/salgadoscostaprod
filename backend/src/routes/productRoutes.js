const { Router } = require('express');
const controller = require('../controllers/productController');
const { authenticate, authorize } = require('../middleware/auth');

const router = Router();

router.get('/', authenticate, controller.listar);
router.get('/:id', authenticate, controller.buscar);
router.post('/', authenticate, authorize('superadmin', 'admin'), controller.criar);
router.put('/:id', authenticate, authorize('superadmin', 'admin'), controller.atualizar);
router.delete('/:id', authenticate, authorize('superadmin'), controller.deletar);

module.exports = router;
