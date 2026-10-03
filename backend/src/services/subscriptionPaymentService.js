// backend/src/services/subscriptionPaymentService.js (ESM)
import prisma from '../config/prisma.js';
import * as cycle from './subscriptionCycle.js';
import { getAccessLevel } from './subscriptionService.js';
import {
  getBaseMensalidade, getFilialX, contarFiliaisAtivas,
} from './filialBillingService.js';

const APPLICATION_TIPOS = ['matriz', 'independente'];

export async function computeBreakdownForEmpresa(empresaId, { nFiliais } = {}) {
  const base = Number(await getBaseMensalidade());
  const x = Number(await getFilialX()) || 0;
  const n = typeof nFiliais === 'number' ? nFiliais : await contarFiliaisAtivas(empresaId);
  return cycle.computeBreakdown({ base, valorPorFilial: x, nFiliais: n });
}

export async function getCurrentInvoice(empresaId, now = new Date()) {
  const empresa = await prisma.empresa.findUnique({
    where: { id: empresaId },
    select: { id: true, empresaTipo: true, parentEmpresaId: true, subscription: true },
  });
  const aplicavel = !!empresa && APPLICATION_TIPOS.includes(empresa.empresaTipo);
  if (!aplicavel) {
    return { aplicavel: false, breakdown: null, canPay: false, canPayReason: null, status: null };
  }

  const sub = empresa.subscription;
  const breakdown = await computeBreakdownForEmpresa(empresaId);

  // ciclo corrente: vencimento conhecido (sub.nextDueDate) ou, sem ciclo aberto, o próximo dia 10
  const dueDate = sub?.nextDueDate ? new Date(sub.nextDueDate) : cycle.nextDueAfterPayment(now);
  const mesRef = cycle.mesRefOf(dueDate);
  const openAt = cycle.cycleOpenAt(dueDate);

  const existing = await prisma.subscriptionPayment.findUnique({
    where: { empresaId_mesRef: { empresaId, mesRef } },
  });

  const days = cycle.daysOverdue(dueDate, now);
  const interest = cycle.interestFor(breakdown.total, days);
  const gate = cycle.canPay({ now, dueDate, hasPaidCurrentCycle: existing?.status === 'PAID' });
  // motivo 'trial' (spec §5.1): empresa em trial com ciclo ainda fechado
  const reason = gate.canPay
    ? null
    : (gate.reason === 'ciclo_fechado' && sub?.status === 'TRIAL' ? 'trial' : gate.reason);

  return {
    aplicavel: true,
    status: sub?.status || null,
    mesRef,
    breakdown,
    dueDate: dueDate.toISOString().slice(0, 10),
    cycleOpenAt: openAt.toISOString().slice(0, 10),
    canPay: gate.canPay,
    canPayReason: reason,
    daysOverdue: days,
    interest,
    totalDue: Math.round((breakdown.total + interest) * 100) / 100,
    paidAt: existing?.status === 'PAID' ? (existing.paidAt ? existing.paidAt.toISOString().slice(0, 10) : null) : null,
    receiptUrl: existing && existing.status === 'PAID'
      ? `/api/empresa/subscription/payments/${existing.id}/receipt`
      : null,
    accessLevel: sub ? getAccessLevel(sub) : 'FULL',
  };
}

export async function ensurePendingInvoice(empresaId, { mesRef, dueDate, base, interest, total, asaasPaymentId }) {
  return prisma.subscriptionPayment.upsert({
    where: { empresaId_mesRef: { empresaId, mesRef } },
    create: { empresaId, mesRef, dueDate, base, interest, total, status: 'PENDING', asaasPaymentId },
    update: { dueDate, base, interest, total, status: 'PENDING', asaasPaymentId },
  });
}

export async function markPaidByAsaasPaymentId(asaasPaymentId, { paidAt = new Date(), total } = {}) {
  const row = await prisma.subscriptionPayment.findUnique({ where: { asaasPaymentId } });
  if (!row) return null;
  if (total !== undefined && Math.abs(Number(total) - Number(row.total)) > 0.01) {
    return null; // valor divergente: não confirma
  }
  const paid = new Date(paidAt);
  const updated = await prisma.subscriptionPayment.update({
    where: { asaasPaymentId },
    data: { status: 'PAID', paidAt: paid },
  });

  // Avança o ciclo da assinatura para o próximo dia 10.
  // Sem isto o webhook legado (que só acha subscription por payment.subscription,
  // inexistente em PIX avulso) nunca correria e a fatura ficaria presa em 'mes_pago'.
  const sub = await prisma.subscription.findUnique({ where: { empresaId: row.empresaId } });
  if (sub) {
    await prisma.subscription.update({
      where: { empresaId: row.empresaId },
      data: {
        status: 'ACTIVE',
        lastPaymentAt: paid,
        nextDueDate: cycle.nextDueAfterPayment(paid),
      },
    });
  }
  return updated;
}

export async function listPayments(empresaId, { page = 1, mesRef } = {}) {
  const limit = 50;
  const where = { empresaId };
  if (mesRef) where.mesRef = String(mesRef);
  const [rows, total] = await Promise.all([
    prisma.subscriptionPayment.findMany({
      where,
      orderBy: { dueDate: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.subscriptionPayment.count({ where }),
  ]);
  return { payments: rows.map(toDto), total, page, limit };
}

export async function getOwnedPaidPayment(empresaId, id) {
  const row = await prisma.subscriptionPayment.findFirst({
    where: { id: Number(id), empresaId, status: 'PAID' },
  });
  return row || null;
}

function toDto(r) {
  return {
    id: r.id,
    mesRef: r.mesRef,
    dueDate: r.dueDate.toISOString().slice(0, 10),
    base: Number(r.base),
    interest: Number(r.interest),
    total: Number(r.total),
    status: r.status,
    paidAt: r.paidAt ? r.paidAt.toISOString().slice(0, 10) : null,
    receiptUrl: r.status === 'PAID' ? `/api/empresa/subscription/payments/${r.id}/receipt` : null,
  };
}

export default {
  computeBreakdownForEmpresa, getCurrentInvoice, ensurePendingInvoice,
  markPaidByAsaasPaymentId, listPayments, getOwnedPaidPayment,
};
