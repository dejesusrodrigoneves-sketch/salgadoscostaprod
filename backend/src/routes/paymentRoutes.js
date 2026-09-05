import { Router } from 'express';
import paymentService from '../services/paymentService.js';
import sql from '../repositories/sqlRepository.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { authenticate, authorize } from '../middleware/auth.js';

const paymentRouter = Router();

// SSE: authenticated payment status tracking
paymentRouter.get('/status/:pedidoId', authenticate, asyncHandler(async (req, res) => {
  // Validate pedido belongs to user's empresa
  const empId = req.ctx?.empresaId || req.user?.empresaId;
  if (empId) {
    const pedido = await sql.buscarPedido(req.params.pedidoId, empId);
    if (!pedido) return res.status(404).json({ error: 'Pedido não encontrado' });
  }
  // Reconcilia antes de abrir o stream (cobre webhook perdido)
  try { await paymentService.consultarESincronizar(req.params.pedidoId); } catch (e) { /* best-effort */ }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const pedidoId = req.params.pedidoId;
  const listener = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
    if (data.status === 'pago' || data.status === 'expirado') {
      paymentService.paymentEvents.removeListener(pedidoId, listener);
      res.end();
    }
  };
  paymentService.paymentEvents.on(pedidoId, listener);
  req.on('close', () => paymentService.paymentEvents.removeListener(pedidoId, listener));
}));

// Admin: lista pagamentos rejeitados para refund manual
paymentRouter.get('/rejeitados', authenticate, authorize('superadmin', 'admin'), asyncHandler(async (req, res) => {
  const rows = await sql.listarPagamentosRejeitados(req.ctx?.empresaId || req.user?.empresaId);
  res.json(rows.map((r) => ({
    id: r.id,
    pedidoId: r.pedidoId,
    clienteNome: r.pedido?.clienteNome,
    clienteWhatsapp: r.pedido?.clienteWhatsapp,
    total: r.pedido?.total ? Number(r.pedido.total) : null,
    criadoEm: r.pedido?.createdAt,
    rejeitadoEm: r.rejeitadoEm,
    valor: Number(r.valor),
    motivo: r.refundReason,
    refundId: r.refundId,
  })));
}));

// Admin: solicita refund manual
paymentRouter.post('/:id/refund', authenticate, authorize('superadmin', 'admin'), asyncHandler(async (req, res) => {
  const pagamento = await paymentService.reembolsar(req.params.id);
  res.json(pagamento);
}));

export { paymentRouter };
