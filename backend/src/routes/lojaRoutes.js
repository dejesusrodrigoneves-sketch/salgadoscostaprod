const { Router } = require('express');
const controller = require('../controllers/lojaController');
const { authenticate, authorize } = require('../middleware/auth');

const router = Router();

router.get('/status', controller.statusPublic);
router.get('/settings', controller.settingsPublic);
router.get('/settings-admin', authenticate, controller.settings);
router.put('/settings', authenticate, authorize('superadmin', 'admin'), controller.updateSettings);

module.exports = router;
