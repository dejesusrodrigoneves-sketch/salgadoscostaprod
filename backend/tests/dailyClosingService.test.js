import { describe, it, expect, vi, beforeEach } from 'vitest';
import prisma from '../src/config/prisma.js';
import auditService from '../src/services/auditService.js';
import { gerarFechamento } from '../src/services/dailyClosingService.js';

describe('dailyClosingService', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it('faz upsert e audita', async () => {
    vi.spyOn(prisma.financialEntry, 'aggregate').mockResolvedValue({
      _sum: { grossAmount: 200, discountAmount: 10, platformFee: 0, paymentFee: 0, otherFees: 5, netAmount: 185, expectedAmount: 185, receivedAmount: 100 },
    });
    const upsert = vi.spyOn(prisma.dailyClosing, 'upsert').mockResolvedValue({ id: 9 });
    const audit = vi.spyOn(auditService, 'audit').mockResolvedValue(undefined);

    await gerarFechamento(7, new Date('2026-08-25T15:00:00Z'), 1);

    expect(upsert).toHaveBeenCalledTimes(1);
    const { update, create, where } = upsert.mock.calls[0][0];
    expect(where.empresaId_date.empresaId).toBe(7);
    expect(update.netAmount).toBe(185);
    expect(update.receivableAmount).toBe(85); // 185 - 100
    expect(create.empresaId).toBe(7);
    expect(audit).toHaveBeenCalledTimes(1);
    expect(audit.mock.calls[0][0].action).toBe('financial.daily_closing.upserted');
  });
});
