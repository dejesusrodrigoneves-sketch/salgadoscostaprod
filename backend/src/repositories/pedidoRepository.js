const prisma = require('../config/prisma');

const ITENS_SELECT = { id: true, produtoId: true, quantidade: true, precoUnitario: true, sabores: true };

const pedidoRepository = {
  async listarPedidos(empresaId, filtros = {}) {
    const where = { deletedAt: null };
    if (empresaId) where.empresaId = empresaId;
    if (filtros?.status) where.status = filtros.status;
    if (filtros?.page) {
      const page = Number(filtros.page) || 1;
      const limit = Math.min(Number(filtros.limit) || 50, 100);
      const skip = (page - 1) * limit;
      const [items, total] = await Promise.all([
        prisma.pedido.findMany({ where, orderBy: { createdAt: 'desc' }, include: { itens: { select: ITENS_SELECT } }, skip, take: limit }),
        prisma.pedido.count({ where }),
      ]);
      return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
    }
    return prisma.pedido.findMany({ where, orderBy: { createdAt: 'desc' }, include: { itens: { select: ITENS_SELECT } } });
  },
  async listarPedidosFiltrados(empresaId, filtros = {}) {
    const where = { deletedAt: null };
    if (empresaId) where.empresaId = empresaId;

    if (filtros?.status?.trim()) {
      const statusList = filtros.status.split(',').map(s => s.trim()).filter(Boolean);
      if (statusList.length === 1) where.status = statusList[0];
      else if (statusList.length > 1) where.status = { in: statusList };
    }

    if (filtros?.paymentStatus?.trim()) {
      const psList = filtros.paymentStatus.split(',').map(s => s.trim()).filter(Boolean);
      if (psList.length === 1) where.paymentStatus = psList[0];
      else if (psList.length > 1) where.paymentStatus = { in: psList };
    }

    const hasValidFrom = filtros?.createdAtFrom && !isNaN(Date.parse(filtros.createdAtFrom));
    const hasValidTo = filtros?.createdAtTo && !isNaN(Date.parse(filtros.createdAtTo));

    if (hasValidFrom || hasValidTo) {
      where.createdAt = {};
      if (hasValidFrom) where.createdAt.gte = new Date(filtros.createdAtFrom);
      if (hasValidTo) where.createdAt.lte = new Date(filtros.createdAtTo);
    }

    const order = (filtros?.order === 'asc') ? 'asc' : 'desc';

    if (filtros?.page) {
      const page = Number(filtros.page) || 1;
      const limit = Math.min(Number(filtros.limit) || 50, 100);
      const skip = (page - 1) * limit;
      const [items, total] = await Promise.all([
        prisma.pedido.findMany({ where, orderBy: { createdAt: order }, include: { itens: { select: ITENS_SELECT } }, skip, take: limit }),
        prisma.pedido.count({ where }),
      ]);
      return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
    }

    return prisma.pedido.findMany({ where, orderBy: { createdAt: order }, include: { itens: { select: ITENS_SELECT } } });
  },
  async buscarPedido(id, empresaId) {
    const where = { id, deletedAt: null };
    if (empresaId) where.empresaId = empresaId;
    return prisma.pedido.findUnique({ where, include: { itens: { select: ITENS_SELECT } } });
  },
  async buscarPedidoComItens(id, empresaId) {
    const where = { id, deletedAt: null };
    if (empresaId) where.empresaId = empresaId;
    return prisma.pedido.findUnique({
      where,
      include: { itens: { include: { produto: { select: { name: true } } } } }
    });
  },
  async listarPedidosPorIds(ids) {
    return prisma.pedido.findMany({
      where: { id: { in: ids }, deletedAt: null },
      include: { itens: { include: { produto: { select: { name: true } } } } },
    });
  },
  async criarPedido(data) {
    const payload = { ...data };
    if (Array.isArray(data.itens)) {
      const produtoIds = data.itens.map(i => Number(i.produtoId));
      const produtos = await prisma.produto.findMany({ where: { id: { in: produtoIds } } });
      const produtoMap = new Map(produtos.map(p => [p.id, p]));

      let valoresItens = 0;
      payload.itens = { create: [] };
      for (const item of data.itens) {
        const produto = produtoMap.get(Number(item.produtoId));
        const preco = Number(produto ? produto.price : 0);
        const qtd = Number(item.quantidade) || 1;
        valoresItens += preco * qtd;
        payload.itens.create.push({
          produtoId: Number(item.produtoId),
          quantidade: qtd,
          precoUnitario: preco,
          sabores: item.sabores || null,
        });
      }
      if (data.valoresItens === undefined || data.valoresItens === null) {
        payload.valoresItens = valoresItens;
      }
    }
    return prisma.pedido.create({ data: payload, include: { itens: { select: ITENS_SELECT } } });
  },
  async atualizarPedido(id, data) {
    return prisma.pedido.update({ where: { id }, data });
  },
  async listarNaoConcluidos(empresaId, filtros = {}) {
    const where = { paymentStatus: { in: ['expirado', 'rejeitado'] }, deletedAt: null };
    if (empresaId) where.empresaId = empresaId;
    if (filtros?.status) where.status = filtros.status;
    return prisma.pedido.findMany({ where, orderBy: { createdAt: 'desc' }, include: { itens: true, pagamentos: true } });
  },
  async hardDeletePedidos(ids) {
    return prisma.$transaction(ids.map(id => prisma.pedido.delete({ where: { id } })));
  },
  async listarParaLimpeza(dias = 30) {
    const cutoff = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);
    return prisma.pedido.findMany({
      where: { deletedAt: { lt: cutoff } },
      select: { id: true, paymentStatus: true, deletedAt: true, total: true, clienteNome: true },
      orderBy: { deletedAt: 'asc' }
    });
  },
  async marcarPedidosArquivados(empresaId, weekStart, weekEnd) {
    return prisma.pedido.updateMany({
      where: {
        empresaId,
        status: 'pago',
        semanaNoAcervo: false,
        createdAt: { gte: weekStart, lte: weekEnd },
      },
      data: { semanaNoAcervo: true },
    });
  },
  async buscarPedidosPagosNoPeriodo(empresaId, weekStart, weekEnd) {
    return prisma.pedido.findMany({
      where: {
        empresaId,
        status: 'pago',
        createdAt: { gte: weekStart, lte: weekEnd },
      },
      select: { id: true, total: true, createdAt: true },
    });
  },
};

module.exports = pedidoRepository;
