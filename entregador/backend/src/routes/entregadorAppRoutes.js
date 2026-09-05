const { Router } = require('express');
const controller = require('../controllers/entregadorAppController');

const router = Router();

// Orders
router.get('/pedidos', controller.listarPedidos);
router.get('/pedidos/:id', controller.buscarPedido);
router.post('/pedidos/:id/confirmar', controller.confirmarEntrega);
router.post('/pedidos/:id/falha', controller.registrarFalha);

// History
router.get('/historico', controller.buscarHistorico);

// Profile
router.get('/perfil', controller.buscarPerfil);
router.put('/perfil', controller.atualizarPerfil);

// Push notifications
router.post('/push/register', controller.registrarPushToken);
router.post('/push/unregister', controller.removerPushToken);

module.exports = router;
