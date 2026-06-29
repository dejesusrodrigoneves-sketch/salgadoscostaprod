const { Router } = require('express');
const controller = require('../controllers/entregaController');
const { authenticate } = require('../middleware/auth');

const router = Router();

router.get('/resumo', authenticate, controller.resumo);
router.get('/', authenticate, controller.listar);
router.post('/', authenticate, controller.registrar);
router.delete('/:pedidoId', authenticate, controller.remover);

module.exports = router;
