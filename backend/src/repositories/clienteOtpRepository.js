const prisma = require('../config/prisma');
module.exports = {
  async invalidatePending(empresaId, clienteId) {
    await prisma.clienteOtp.updateMany({ where: { empresaId, clienteId, consumedAt: null }, data: { consumedAt: new Date() } });
  },
  async create(row) { await prisma.clienteOtp.create({ data: row }); },
  async findLatest(empresaId, clienteId) {
    return prisma.clienteOtp.findFirst({ where: { empresaId, clienteId }, orderBy: { id: 'desc' } });
  },
  async consume(id) { await prisma.clienteOtp.update({ where: { id }, data: { consumedAt: new Date() } }); },
  async incrementAttempts(id) { await prisma.clienteOtp.update({ where: { id }, data: { attempts: { increment: 1 } } }); },
};
