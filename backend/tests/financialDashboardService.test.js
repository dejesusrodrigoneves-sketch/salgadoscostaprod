import { describe, it, expect, vi, beforeEach } from 'vitest';
import prisma from '../src/config/prisma.js';
import { balanco } from '../src/services/financialDashboardService.js';

describe('financialDashboardService.balanco', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it('consolida totais e por plataforma', async () => {
    vi.spyOn(prisma.financialEntry, 'aggregate').mockResolvedValue({
      _sum: { grossAmount: 500, discountAmount: 20, platformFee: 10, paymentFee: 5, otherFees: 5, netAmount: 460, receivedAmount: 400 },
    });
    vi.spyOn(prisma.financialEntry, 'groupBy').mockResolvedValue([
      { source: 'SAAS', _sum: { netAmount: 460 } },
    ]);
    const b = await balanco(7, {});
    expect(b.gross).toBe(500);
    expect(b.fees).toBe(20);
    expect(b.net).toBe(460);
    expect(b.receivable).toBe(60);
    expect(b.porPlataforma).toEqual([{ source: 'SAAS', net: 460 }]);
  });
});
