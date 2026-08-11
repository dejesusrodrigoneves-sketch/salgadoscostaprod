const defaultPrisma = require('../config/prisma');

function createManyAudit(entries, prisma = defaultPrisma) {
  if (!entries || entries.length === 0) return Promise.resolve(0);
  return prisma.auditLog.createMany({ data: entries });
}

function createManyAppLog(entries, prisma = defaultPrisma) {
  if (!entries || entries.length === 0) return Promise.resolve(0);
  return prisma.appLog.createMany({ data: entries });
}

async function listAudit({ actorId, module, action, severity, dataInicio, dataFim, page = 1, limit = 50, empresaId = 1 } = {}, prisma = defaultPrisma) {
  const where = { empresaId };
  if (actorId !== undefined && actorId !== '') where.actorId = actorId === null ? null : Number(actorId);
  if (module) where.module = module;
  if (action) where.action = action;
  if (severity) where.severity = severity;
  if (dataInicio || dataFim) {
    where.createdAt = {};
    if (dataInicio) where.createdAt.gte = new Date(dataInicio);
    if (dataFim) where.createdAt.lte = new Date(dataFim);
  }
  const take = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const skip = (Math.max(Number(page) || 1, 1) - 1) * take;

  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, take, skip }),
    prisma.auditLog.count({ where }),
  ]);

  const serialized = items.map((i) => ({ ...i, id: String(i.id) }));

  return { items: serialized, total, page: Math.max(Number(page) || 1, 1), limit: take, totalPages: Math.ceil(total / take) };
}

async function listActors(empresaId = 1, prisma = defaultPrisma) {
  const rows = await prisma.auditLog.groupBy({
    by: ['actorId', 'actorUsername', 'actorRole', 'actorType'],
    where: { empresaId },
    _max: { createdAt: true },
    _count: { _all: true },
    orderBy: { _max: { createdAt: 'desc' } },
  });
  return rows.map((r) => ({
    actorId: r.actorId,
    actorUsername: r.actorUsername,
    actorRole: r.actorRole,
    actorType: r.actorType,
    lastActivity: r._max.createdAt,
    totalActions: r._count._all,
  }));
}

async function deleteClienteLogs(prisma = defaultPrisma) {
  const result = await prisma.auditLog.deleteMany({
    where: { actorType: 'cliente' }
  });
  return result.count;
}

async function deleteOldLogs(days = 90, prisma = defaultPrisma) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const result = await prisma.auditLog.deleteMany({
    where: { createdAt: { lt: cutoff } }
  });
  return result.count;
}

module.exports = { createManyAudit, createManyAppLog, listAudit, listActors, deleteClienteLogs, deleteOldLogs };
