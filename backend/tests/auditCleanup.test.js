import { describe, it, expect, vi } from 'vitest';
import { deleteClienteLogs, deleteOldLogs } from '../src/repositories/auditRepository.js';

function mockPrisma() {
  return {
    auditLog: {
      deleteMany: vi.fn(async (opts) => ({ count: opts.where.actorType === 'cliente' ? 5 : 12 })),
    }
  };
}

describe('deleteClienteLogs', () => {
  it('chama deleteMany com where actorType=cliente', async () => {
    const p = mockPrisma();
    const count = await deleteClienteLogs(p);
    expect(p.auditLog.deleteMany).toHaveBeenCalledWith({
      where: { actorType: 'cliente' }
    });
    expect(count).toBe(5);
  });

  it('retorna 0 quando nenhum log de cliente', async () => {
    const p = mockPrisma();
    p.auditLog.deleteMany.mockResolvedValue({ count: 0 });
    const count = await deleteClienteLogs(p);
    expect(count).toBe(0);
  });
});

describe('deleteOldLogs', () => {
  it('deleta logs mais antigos que N dias', async () => {
    const p = mockPrisma();
    const count = await deleteOldLogs(90, p);
    expect(p.auditLog.deleteMany).toHaveBeenCalledTimes(1);
    const call = p.auditLog.deleteMany.mock.calls[0][0];
    expect(call.where.createdAt.lt).toBeInstanceOf(Date);
    // Verify cutoff ~90 days ago
    const diff = Date.now() - call.where.createdAt.lt.getTime();
    expect(diff).toBeGreaterThan(89 * 86400000);
    expect(diff).toBeLessThan(91 * 86400000);
    expect(count).toBe(12);
  });

  it('default 90 dias', async () => {
    const p = mockPrisma();
    await deleteOldLogs(undefined, p);
    const call = p.auditLog.deleteMany.mock.calls[0][0];
    const diff = Date.now() - call.where.createdAt.lt.getTime();
    expect(diff).toBeGreaterThan(89 * 86400000);
  });
});
