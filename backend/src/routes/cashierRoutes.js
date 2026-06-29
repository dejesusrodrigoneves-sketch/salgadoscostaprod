const { Router } = require('express');
const controller = require('../controllers/cashierController');
const { authenticate } = require('../middleware/auth');

const router = Router();

router.get('/hoje', authenticate, controller.hoje);
router.post('/abrir', authenticate, controller.abrir);
router.post('/fechar', authenticate, controller.fechar);
router.get('/relatorios', authenticate, controller.relatorios);

module.exports = router;
