const { Router } = require('express');
const controller = require('../controllers/orderController');
const whatsapp = require('../services/whatsappService');
const { authenticate } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

const router = Router();

router.get('/', authenticate, controller.listar);
router.get('/:id', authenticate, controller.buscar);
router.post('/', controller.criar);
router.patch('/:id/status', authenticate, controller.atualizarStatus);
router.delete('/:id', authenticate, controller.deletar);
router.post('/:id/finalizar', authenticate, controller.finalizar);

// Rotas legadas de notificação WhatsApp (backward compatible)
router.post('/producao', asyncHandler(async (req, res) => {
  await whatsapp.notificarStatus({ clienteNome: req.body.nome, clienteWhatsapp: req.body.telefone, id: req.body.pedidoId }, 'producao');
  res.json({ success: true });
}));

router.post('/pronto', asyncHandler(async (req, res) => {
  await whatsapp.notificarStatus({ clienteNome: req.body.nome, clienteWhatsapp: req.body.telefone, id: req.body.pedidoId }, 'pronto');
  res.json({ success: true });
}));

router.post('/em-rota', asyncHandler(async (req, res) => {
  await whatsapp.enviarMensagem(req.body.telefone, `🚚 Olá ${req.body.nome}!\n\nSeu pedido está a caminho!\n\n${req.body.rastreioLink}`);
  res.json({ success: true });
}));

module.exports = router;
