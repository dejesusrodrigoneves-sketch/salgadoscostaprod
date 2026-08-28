import { describe, it, expect, vi, beforeEach } from 'vitest';
import prisma from '../src/config/prisma.js';
import { reconciliarDia } from '../src/services/reconciliationService.js';

describe('reconciliationService', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it('marca MATCHED quando esperado == recebido', async () => {
    vi.spyOn(prisma.financialEntry, 'groupBy').mockResolvedValue([
      { source: 'SAAS', _sum: { expectedAmount: 100, receivedAmount: 100 } },
    ]);
    const create = vi.spyOn(prisma.reconciliation, 'create').mockResolvedValue({ id: 1 });
    const rows = await reconciliarDia(7, new Date('2026-08-25T15:00:00Z'));
    expect(rows.length).toBe(1);
    expect(create.mock.calls[0][0].data.status).toBe('MATCHED');
    expect(create.mock.calls[0][0].data.difference).toBe(0);
  });

  it('marca DIVERGENT quando ha diferenca', async () => {
    vi.spyOn(prisma.financialEntry, 'groupBy').mockResolvedValue([
      { source: 'SAAS', _sum: { expectedAmount: 100, receivedAmount: 70 } },
    ]);
    const create = vi.spyOn(prisma.reconciliation, 'create').mockResolvedValue({ id: 2 });
    const rows = await reconciliarDia(7, new Date('2026-08-25T15:00:00Z'));
    expect(create.mock.calls[0][0].data.status).toBe('DIVERGENT');
    expect(create.mock.calls[0][0].data.difference).toBe(30);
    expect(rows.length).toBe(1);
  });
});
