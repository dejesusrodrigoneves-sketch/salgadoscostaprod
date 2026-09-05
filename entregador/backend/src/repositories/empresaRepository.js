const prisma = require('../config/prisma');

const empresaRepository = {
  async listarEmpresas() {
    return prisma.empresa.findMany({ include: { _count: { select: { usuarios: true, produtos: true, pedidos: true } } } });
  },
  async buscarEmpresa(id) {
    return prisma.empresa.findUnique({ where: { id } });
  },
  async buscarEmpresaPorSlug(slug) {
    return prisma.empresa.findUnique({ where: { slug } });
  },
  async buscarEmpresaByEmail(email) {
    return prisma.empresa.findFirst({ where: { email } });
  },
  async atualizarEmpresa(id, data) {
    return prisma.empresa.update({ where: { id }, data });
  },
  async criarEmpresa(data) {
    return prisma.empresa.create({ data });
  },
  async deletarEmpresa(id) {
    return prisma.empresa.delete({ where: { id } });
  },
  async softDeleteEmpresa(id) {
    return prisma.empresa.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  },
  async hardDeleteEmpresa(id) {
    const empresaId = Number(id);
    await prisma.$transaction([
      prisma.loginLog.deleteMany({ where: { usuario: { empresaId } } }),
      prisma.auditLog.deleteMany({ where: { actorId: empresaId } }),
      prisma.processedWebhook.deleteMany({ where: {} }),
      prisma.whatsAppInstance.deleteMany({ where: { empresaId } }),
      prisma.entregaDiaria.deleteMany({ where: { pedido: { empresaId } } }),
      prisma.itensPedido.deleteMany({ where: { pedido: { empresaId } } }),
      prisma.pagamento.deleteMany({ where: { pedido: { empresaId } } }),
      prisma.pedido.deleteMany({ where: { empresaId } }),
      prisma.weeklySettlement.deleteMany({ where: { empresaId } }),
      prisma.caixaDiario.deleteMany({ where: { empresaId } }),
      prisma.horario.deleteMany({ where: { empresaId } }),
      prisma.cupom.deleteMany({ where: { empresaId } }),
      prisma.produto.deleteMany({ where: { empresaId } }),
      prisma.categoria.deleteMany({ where: { empresaId } }),
      prisma.usuario.deleteMany({ where: { empresaId } }),
      prisma.cliente.deleteMany({ where: { empresaId } }),
      prisma.counter.deleteMany({ where: { empresaId } }),
      prisma.empresa.delete({ where: { id: empresaId } }),
    ]);
  },
  async listarEmpresasAtivas() {
    return prisma.empresa.findMany({ where: { deletedAt: null } });
  },
};

module.exports = empresaRepository;
