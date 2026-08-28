import prisma from '../config/prisma.js';
import auditService from './auditService.js';
import { dayRangeSaoPaulo } from '../utils/financialTime.js';

function round2(v) { return Math.round(v * 100) / 100; }

export async function reconciliarDia(empresaId, date = new Date(), actor = null) {
  const { start, end } = dayRangeSaoPaulo(date);

  const grupos = await prisma.financialEntry.groupBy({
    by: ['source'],
    where: { empresaId, transactionDate: { gte: start, lt: end } },
    _sum: { expectedAmount: true, receivedAmount: true },
  });

  const criados = [];
  for (const g of grupos) {
    const expected = round2(Number(g._sum.expectedAmount || 0));
    const received = round2(Number(g._sum.receivedAmount || 0));
    const difference = round2(expected - received);
    const status = Math.abs(difference) < 0.01 ? 'MATCHED' : 'DIVERGENT';
    const rec = await prisma.reconciliation.create({
      data: { empresaId, source: g.source, expectedAmount: expected, receivedAmount: received, difference, status },
    });
    criados.push(rec);
    if (status === 'DIVERGENT') {
      auditService.audit({
        action: 'financial.reconciliation.divergent',
        module: 'financeiro',
        actorType: 'admin',
        actorId: actor ? Number(actor) : undefined,
        targetType: 'reconciliation',
        targetId: rec.id,
        after: { empresaId, source: g.source, expected, received, difference },
        severity: 'warning',
      });
    }
  }
  return criados;
}

export async function listar(empresaId, page = 1, limit = 50) {
  const skip = (page - 1) * limit;
  const [reconciliations, total] = await Promise.all([
    prisma.reconciliation.findMany({ where: { empresaId }, orderBy: { createdAt: 'desc' }, skip, take: limit }),
    prisma.reconciliation.count({ where: { empresaId } }),
  ]);
  return { reconciliations, total, page, limit };
}

export default { reconciliarDia, listar };
