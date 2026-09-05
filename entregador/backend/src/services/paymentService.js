import { EventEmitter } from 'events';
import prisma from '../config/prisma.js';
import sql from '../repositories/sqlRepository.js';
import asaasClient from './asaasClient.js';
import orderService from './orderService.js';
import auditService from './auditService.js';
import env from '../config/env.js';
import logger from '../config/logger.js';

const paymentEvents = new EventEmitter();
paymentEvents.setMaxListeners(0);

function registrarLog(tipo, meta, level = 'info') {
  auditService.appLog({ level, message: tipo, module: 'pagamentos', meta });
}

async function criarPixPedido(pedidoId, { cliente, valor }) {
  const v = Number(valor);
  const pedido = await sql.buscarPedido(pedidoId); // obter empresaId (corrige pedido undefined)
  if (!pedido) throw Object.assign(new Error('Pedido não encontrado'), { status: 404 });
  const empresaId = pedido.empresaId;
  const empresa = await sql.buscarEmpresa(empresaId);
  let asaasCustomerId = cliente.asaasCustomerId;
  if (!asaasCustomerId) {
    asaasCustomerId = await asaasClient.criarCustomer({
      nome: cliente.nome, cpf: cliente.cpf, telefone: cliente.telefone,
    });
    if (cliente.id) {
      await sql.atualizarCliente(cliente.id, { asaasCustomerId });
    }
  }

  const expiryMin = env.asaasPixExpiryMin;
  const taxaServico = Math.round(v * env.asaasPixFeePercent / 100 * 100) / 100;
  const dueDate = new Date(Date.now() + expiryMin * 60 * 1000);
  const pixPayload = {
    customerId: asaasCustomerId,
    valor: v,
    descricao: `Pedido ${pedidoId}`,
    dueDate: dueDate.toISOString().slice(0, 10),
  };

  let pix;
  if (empresa && empresa.asaasOnboarded && empresa.asaasWalletId) {
    pixPayload.splits = [{ walletId: empresa.asaasWalletId, percentualValue: 98 }];
    pix = await asaasClient.criarPixComSplit(pixPayload);
    registrarLog('PIX_SPLIT_CREATED', { pedidoId, empresaId, walletId: empresa.asaasWalletId });
  } else {
    pix = await asaasClient.criarPix(pixPayload);
  }

  const pagamento = await prisma.pagamento.create({
    data: {
      pedidoId, empresaId,
      asaasPaymentId: pix.paymentId,
      asaasCustomerId,
      valor: v,
      pixCode: pix.pixCode,
      pixQrCode: pix.pixQrCode,
      status: 'aguardando_pagamento',
      expiresAt: new Date(Date.now() + expiryMin * 60 * 1000),
    },
  });
  await prisma.pedido.update({ where: { id: pedidoId }, data: { paymentId: pagamento.id } });
  registrarLog('PIX_CREATED', { pedidoId, pagamento: pagamento.id });
  return { ...pagamento, taxaServico };
}

async function liberarPedido(pedido) {
  try {
    await orderService.atualizarStatus(pedido.id, 'producao', {});
    registrarLog('PIX_CONFIRMED', { pedidoId: pedido.id });
  } catch (err) {
    registrarLog('PIX_LIBERAR_ERRO', { pedidoId: pedido.id, err: err.message }, 'error');
  }
}

async function marcarExpirado(pedido, pagamento) {
  if (pagamento.status !== 'aguardando_pagamento') return;
  await prisma.pagamento.update({ where: { id: pagamento.id }, data: { status: 'expirado' } });
  await prisma.pedido.update({ where: { id: pedido.id }, data: { paymentStatus: 'expirado' } });
  paymentEvents.emit(pedido.id, { status: 'expirado' });
  registrarLog('PIX_EXPIRED', { pedidoId: pedido.id });
}

async function rejeitarEReembolsar(pedido, pagamento, motivo) {
  await prisma.pagamento.update({
    where: { id: pagamento.id },
    data: { status: 'rejeitado', rejeitadoEm: new Date(), refundReason: motivo },
  });
  await prisma.pedido.update({ where: { id: pedido.id }, data: { paymentStatus: 'rejeitado' } });
  registrarLog('PIX_REJECTED', { pedidoId: pedido.id, motivo });
  try {
    const refund = await asaasClient.reembolsar(pagamento.asaasPaymentId, Number(pagamento.valor));
    await prisma.pagamento.update({
      where: { id: pagamento.id },
      data: { refundId: refund.id, refundStatus: 'refund_requested', refundedAt: new Date() },
    });
    registrarLog('PIX_REFUNDED', { pedidoId: pedido.id, motivo });
  } catch (err) {
    registrarLog('PIX_REEMBOLSO_ERRO', { pedidoId: pedido.id, err: err.message }, 'error');
  }
}

async function confirmarPagamento(pedido, pagamento, asaas) {
  if (pagamento.status === 'pago') return;
  const valorAsaas = Number(asaas.value);
  const valorEsperado = Number(pagamento.valor);
  if (Math.abs(valorAsaas - valorEsperado) > 0.001) {
    await rejeitarEReembolsar(pedido, pagamento, 'valor_divergente');
    return;
  }
  await prisma.pagamento.update({ where: { id: pagamento.id }, data: { status: 'pago', paidAt: new Date() } });
  await prisma.pedido.update({ where: { id: pedido.id }, data: { paymentStatus: 'pago', paymentMethod: 'pix' } });
  await liberarPedido(pedido);
  paymentEvents.emit(pedido.id, { status: 'pago' });
}

async function consultarESincronizar(pedidoId) {
  const pedido = await sql.buscarPedido(pedidoId);
  if (!pedido) return null;
  if (pedido.paymentStatus !== 'aguardando_pagamento') return pedido;

  const pagamento = await prisma.pagamento.findFirst({
    where: { pedidoId, status: 'aguardando_pagamento' },
  });
  if (!pagamento) return pedido;

  if (pagamento.expiresAt && new Date() > pagamento.expiresAt) {
    await marcarExpirado(pedido, pagamento);
    return sql.buscarPedido(pedidoId);
  }

  const asaas = await asaasClient.consultarPayment(pagamento.asaasPaymentId);
  if (asaas.status === 'RECEIVED') {
    await confirmarPagamento(pedido, pagamento, asaas);
  } else if (['OVERDUE', 'CANCELLED', 'EXPIRED'].includes(asaas.status)) {
    await marcarExpirado(pedido, pagamento);
  }
  return sql.buscarPedido(pedidoId);
}

async function processarWebhook(evento) {
  const { id: eventId, event, payment } = evento;
  if (!payment && event !== 'TRANSFER_RECEIVED') return { received: true };

  const jaVisto = await sql.buscarEventoWebhook(eventId);
  if (jaVisto) {
    registrarLog('WEBHOOK_DUPLICATE', { eventId });
    return { received: true };
  }
  await sql.criarEventoWebhook(eventId);

  if (event === 'TRANSFER_RECEIVED') {
    const asaasTransferId = evento.transferId || evento.id;
    const settlement = await sql.buscarSettlementByTransferId(asaasTransferId);
    if (settlement) {
      await sql.atualizarSettlement(settlement.id, { status: 'pago' });
      logger.info({ settlementId: settlement.id }, 'Settlement marked as paid via transfer');
    }
    return { received: true };
  }

  if (event !== 'PAYMENT_RECEIVED') return { received: true };

  const pagamento = await prisma.pagamento.findUnique({ where: { asaasPaymentId: payment.id } });
  if (!pagamento) {
    registrarLog('WEBHOOK_ORFAO', { paymentId: payment.id }, 'warning');
    try { await asaasClient.reembolsar(payment.id); } catch (e) { /* noop */ }
    return { received: true };
  }

  const pedido = await sql.buscarPedido(pagamento.pedidoId);
  const asaas = await asaasClient.consultarPayment(payment.id);
  await confirmarPagamento(pedido, pagamento, asaas);
  return { received: true };
}

async function reembolsar(pagamentoId) {
  const pagamento = await prisma.pagamento.findUnique({ where: { id: Number(pagamentoId) } });
  if (!pagamento) throw Object.assign(new Error('Pagamento não encontrado'), { status: 404 });
  if (pagamento.status !== 'rejeitado') throw Object.assign(new Error('Somente pagamentos rejeitados podem ser reembolsados'), { status: 400 });
  if (pagamento.refundId) throw Object.assign(new Error('Reembolso já solicitado'), { status: 400 });
  const refund = await asaasClient.reembolsar(pagamento.asaasPaymentId, Number(pagamento.valor));
  await prisma.pagamento.update({
    where: { id: pagamento.id },
    data: { refundId: refund.id, refundStatus: 'refund_requested', refundedAt: new Date() },
  });
  registrarLog('PIX_REFUNDED', { pedidoId: pagamento.pedidoId, motivo: 'manual_admin' });
  return prisma.pagamento.findUnique({ where: { id: pagamento.id } });
}

export {
  criarPixPedido, consultarESincronizar, processarWebhook, reembolsar,
  liberarPedido, paymentEvents,
};

export default {
  criarPixPedido, consultarESincronizar, processarWebhook, reembolsar,
  liberarPedido, paymentEvents,
};
