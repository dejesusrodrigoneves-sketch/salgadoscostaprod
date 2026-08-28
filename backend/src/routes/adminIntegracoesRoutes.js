const { Router } = require('express');
const controller = require('../controllers/adminIntegracoesController');
const { authenticate, authorize } = require('../middleware/auth');

const router = Router();
router.use(authenticate, authorize('superadmin'));
router.get('/', controller.listar);
router.get('/:platform', controller.detalhe);

module.exports = router;
