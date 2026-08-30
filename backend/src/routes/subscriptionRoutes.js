// backend/src/routes/subscriptionRoutes.js (CJS)
const { Router } = require('express');
const { authenticate, authorize } = require('../middleware/auth.js');
const { subscriptionGuard } = require('../middleware/subscriptionGuard.js');
const {
  getSubscriptionController,
  getMySubscriptionController,
  createSubscriptionController,
  updateStatusController,
  payController,
  cancelController,
  listAllSubscriptionsController
} = require('../controllers/subscriptionController.js');
const { webhookAsaasController } = require('../controllers/webhookAsaasController.js');

const router = Router();

// Admin routes (superadmin)
router.get('/admin/subscription/list', authenticate, authorize('superadmin'), listAllSubscriptionsController);
router.get('/admin/subscription/:empresaId', authenticate, authorize('superadmin'), getSubscriptionController);
router.post('/admin/subscription/:empresaId', authenticate, authorize('superadmin'), createSubscriptionController);
router.put('/admin/subscription/:empresaId/status', authenticate, authorize('superadmin'), updateStatusController);

// Empresa routes (admin only)
router.get('/empresa/subscription/status', authenticate, authorize('admin'), subscriptionGuard, getMySubscriptionController);
router.post('/empresa/subscription/pay', authenticate, authorize('admin'), subscriptionGuard, payController);
router.delete('/empresa/subscription/cancel', authenticate, authorize('admin'), subscriptionGuard, cancelController);

// Asaas webhook (no auth — verified by Asaas signature)
router.post('/webhooks/asaas/subscription', webhookAsaasController);

module.exports = router;
