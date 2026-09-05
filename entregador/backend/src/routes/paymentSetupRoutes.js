const { Router } = require('express');
const controller = require('../controllers/paymentController');
const { authenticate, authorize } = require('../middleware/auth');

const router = Router();

router.use(authenticate, authorize('superadmin', 'admin'));

router.post('/setup', controller.setup);
router.get('/status', controller.getStatus);
router.put('/', controller.update);
router.delete('/', controller.deactivate);

module.exports = router;
