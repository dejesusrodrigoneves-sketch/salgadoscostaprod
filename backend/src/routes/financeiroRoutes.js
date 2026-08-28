const { Router } = require('express');
const controller = require('../controllers/financeiroController');
const { authenticate, authorize } = require('../middleware/auth');
const requireEmpresa = require('../middleware/requireEmpresa');

const router = Router();

router.get('/balance', authenticate, authorize('superadmin', 'admin', 'user'), requireEmpresa, controller.balance);
router.get('/entries', authenticate, authorize('superadmin', 'admin', 'user'), requireEmpresa, controller.entries);
router.get('/closings', authenticate, authorize('superadmin', 'admin', 'user'), requireEmpresa, controller.closings);
router.get('/reconciliations', authenticate, authorize('superadmin', 'admin', 'user'), requireEmpresa, controller.reconciliations);
router.get('/integrations', authenticate, authorize('superadmin', 'admin'), requireEmpresa, controller.integrations);
router.post('/sync', authenticate, authorize('superadmin', 'admin'), requireEmpresa, controller.sync);
router.post('/closing', authenticate, authorize('superadmin', 'admin'), requireEmpresa, controller.closing);
router.post('/integrations/:platform/connect', authenticate, authorize('superadmin', 'admin'), requireEmpresa, controller.connect);
router.get('/integrations/:platform/callback', controller.callback);
router.post('/integrations/:platform/disconnect', authenticate, authorize('superadmin', 'admin'), requireEmpresa, controller.disconnect);

module.exports = router;
