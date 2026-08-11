const { Router } = require('express');
const controller = require('../controllers/orderController');
const whatsapp = require('../services/whatsappService');
const auditService = require('../services/auditService');
const { getCtx } = require('../middleware/context');
const { authenticate, authorize } = require('../middleware/auth');
const { requireOwnership } = require('../middleware/ownership');
const { asyncHandler } = require('../middleware/errorHandler');

const router = Router();

router.get('/', authenticate, controller.listar);
router.get('/:id', authenticate, requireOwnership('pedido'), controller.buscar);
router.post('/', authenticate, controller.criar);
router.patch('/:id/status', authenticate, requireOwnership('pedido'), controller.atualizarStatus);
router.delete('/:id', authenticate, requireOwnership('pedido'), controller.deletar);
router.post('/:id/finalizar', authenticate, requireOwnership('pedido'), controller.finalizar);
router.patch('/:id/editar', authenticate, requireOwnership('pedido'), authorize('superadmin', 'admin', 'user'), controller.editarPedido);

function legacyCtx(req, rota) {
  const ctx = getCtx(req);
  return {
    ...ctx,
    action: `whatsapp.legacy_${rota}`,
    module: 'whatsapp',
    targetType: 'pedido',
    targetId: req.body.pedidoId,
    after: { clienteNome: req.body.nome, clienteWhatsapp: req.body.telefone },
    changedFields: ['clienteNome', 'clienteWhatsapp'],
    metadata: { ...(ctx.metadata || {}), rotaLegada: `/api/pedidos/${rota}` },
  };
}

// Rotas legadas de notificação WhatsApp (backward compatible)
router.post('/producao', asyncHandler(async (req, res) => {
  await whatsapp.notificarStatus({ clienteNome: req.body.nome, clienteWhatsapp: req.body.telefone, id: req.body.pedidoId }, 'producao');
  auditService.audit(legacyCtx(req, 'producao'));
  res.json({ success: true });
}));

router.post('/pronto', asyncHandler(async (req, res) => {
  await whatsapp.notificarStatus({ clienteNome: req.body.nome, clienteWhatsapp: req.body.telefone, id: req.body.pedidoId }, 'pronto');
  auditService.audit(legacyCtx(req, 'pronto'));
  res.json({ success: true });
}));

router.post('/em-rota', asyncHandler(async (req, res) => {
  await whatsapp.enviarMensagem(req.body.telefone, `🚚 Olá ${req.body.nome}!\n\nSeu pedido está a caminho!\n\n${req.body.rastreioLink}`);
  auditService.audit(legacyCtx(req, 'em_rota'));
  res.json({ success: true });
}));

module.exports = router;
