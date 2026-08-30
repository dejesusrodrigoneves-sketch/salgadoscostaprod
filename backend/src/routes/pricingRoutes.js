// backend/src/routes/pricingRoutes.js (CJS)
const { Router } = require('express');
const { authenticate, authorize } = require('../middleware/auth.js');
const {
  createPricingController,
  getPricingController,
  getCurrentPricingController
} = require('../controllers/pricingController.js');

const router = Router();

router.post('/admin/pricing', authenticate, authorize('superadmin'), createPricingController);
router.get('/admin/pricing', authenticate, authorize('superadmin'), getPricingController);
router.get('/admin/pricing/current', authenticate, authorize('superadmin'), getCurrentPricingController);

module.exports = router;
