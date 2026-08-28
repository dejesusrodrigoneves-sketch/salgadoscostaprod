import { describe, it, expect, vi, beforeEach } from 'vitest';
import prisma from '../src/config/prisma.js';
import { syncSaas } from '../src/services/financialSyncService.js';

describe('financialSyncService.syncSaas', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it('é idempotente: 2 syncs criam 1 entrada', async () => {
    const pedido = { id: '1-001', empresaId: 7, total: 100, desconto: 0, taxasEntrega: 0, taxasCartao: 0, createdAt: new Date() };
    vi.spyOn(prisma.pedido, 'findMany').mockResolvedValue([pedido]);
    vi.spyOn(prisma.pagamento, 'findMany').mockResolvedValue([]);
    const findUnique = vi.spyOn(prisma.financialEntry, 'findUnique')
      .mockResolvedValueOnce(null)   // 1º sync: não existe
      .mockResolvedValueOnce({ id: 1 }); // 2º sync: já existe
    const upsert = vi.spyOn(prisma.financialEntry, 'upsert').mockResolvedValue({ id: 1 });

    const r1 = await syncSaas(7);
    const r2 = await syncSaas(7);

    expect(r1).toEqual({ created: 1, updated: 0 });
    expect(r2).toEqual({ created: 0, updated: 1 });
    expect(upsert).toHaveBeenCalledTimes(2);
    const call = upsert.mock.calls[0][0];
    expect(call.where.empresaId_source_externalId).toEqual({ empresaId: 7, source: 'SAAS', externalId: '1-001' });
    expect(findUnique).toHaveBeenCalledTimes(2);
  });
});
