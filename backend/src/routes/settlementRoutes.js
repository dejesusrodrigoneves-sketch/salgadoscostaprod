const { Router } = require('express');
const controller = require('../controllers/settlementController');
const { authenticate, authorize } = require('../middleware/auth');

const router = Router();

router.use(authenticate, authorize('superadmin', 'admin'));

router.get('/actual', controller.actual);
router.get('/history', controller.history);
router.get('/global', authorize('superadmin'), controller.globalSettlements);
router.get('/:id', controller.detalhe);

module.exports = router;
