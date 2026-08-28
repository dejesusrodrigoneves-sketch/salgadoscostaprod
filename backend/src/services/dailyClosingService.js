import prisma from '../config/prisma.js';
import auditService from './auditService.js';
import { dayRangeSaoPaulo } from '../utils/financialTime.js';

function round2(v) { return Math.round(v * 100) / 100; }

export async function gerarFechamento(empresaId, date = new Date(), actor = null) {
  const { start, end, dateKey } = dayRangeSaoPaulo(date);

  const agg = await prisma.financialEntry.aggregate({
    where: { empresaId, transactionDate: { gte: start, lt: end } },
    _sum: {
      grossAmount: true,
      discountAmount: true,
      platformFee: true,
      paymentFee: true,
      otherFees: true,
      netAmount: true,
      expectedAmount: true,
      receivedAmount: true,
    },
  });
  const s = agg._sum || {};
  const gross = round2(Number(s.grossAmount || 0));
  const discount = round2(Number(s.discountAmount || 0));
  const fees = round2(Number(s.platformFee || 0) + Number(s.paymentFee || 0) + Number(s.otherFees || 0));
  const net = round2(Number(s.netAmount || 0));
  const received = round2(Number(s.receivedAmount || 0));
  const receivable = round2(Math.max(0, net - received));

  const closing = await prisma.dailyClosing.upsert({
    where: { empresaId_date: { empresaId, date: dateKey } },
    update: { grossAmount: gross, discountAmount: discount, feesAmount: fees, netAmount: net, receivedAmount: received, receivableAmount: receivable, divergenceAmount: 0, generatedBy: actor ? Number(actor) : null, generatedAt: new Date() },
    create: { empresaId, date: dateKey, grossAmount: gross, discountAmount: discount, feesAmount: fees, netAmount: net, receivedAmount: received, receivableAmount: receivable, divergenceAmount: 0, generatedBy: actor ? Number(actor) : null },
  });

  auditService.audit({
    action: 'financial.daily_closing.upserted',
    module: 'financeiro',
    actorType: 'admin',
    actorId: actor ? Number(actor) : undefined,
    targetType: 'daily_closing',
    targetId: closing.id,
    after: { empresaId, dateKey, net, received, receivable },
    severity: 'info',
  });

  return closing;
}

export async function listarClosings(empresaId, page = 1, limit = 20) {
  const skip = (page - 1) * limit;
  const [closings, total] = await Promise.all([
    prisma.dailyClosing.findMany({ where: { empresaId }, orderBy: { date: 'desc' }, skip, take: limit }),
    prisma.dailyClosing.count({ where: { empresaId } }),
  ]);
  return { closings, total, page, limit };
}

export default { gerarFechamento, listarClosings };
