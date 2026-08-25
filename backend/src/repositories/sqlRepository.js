const prisma = require('../config/prisma');

const sql = {
  // ---- Produtos ----
  async listarProdutos(empresaId) {
    const where = {};
    if (empresaId) where.empresaId = empresaId;
    return prisma.produto.findMany({ where, include: { category: true } });
  },
  async buscarProduto(id, empresaId) {
    const where = { id: Number(id) };
    if (empresaId) where.empresaId = empresaId;
    return prisma.produto.findFirst({ where });
  },
  async buscarProdutosPorIds(ids, empresaId) {
    return prisma.produto.findMany({ where: { id: { in: ids.map(Number) }, ...(empresaId && { empresaId }) } });
  },
  async criarProduto(data) {
    const { id, empresaId, ...rest } = data;
    if (!empresaId) throw Object.assign(new Error('empresaId obrigatório'), { status: 400 });
    if (rest.categoryId) {
      rest.category = { connect: { id: rest.categoryId } };
      delete rest.categoryId;
    }
    return prisma.produto.create({
      data: { ...rest, empresa: { connect: { id: empresaId } } }
    });
  },
  async atualizarProduto(id, data) {
    const { id: _, empresaId, ...rest } = data;
    if (rest.categoryId) {
      rest.category = { connect: { id: rest.categoryId } };
      delete rest.categoryId;
    }
    return prisma.produto.update({ where: { id: Number(id) }, data: rest });
  },
  async deletarProduto(id) {
    return prisma.produto.delete({ where: { id: Number(id) } });
  },

  // ---- Pedidos ----
  async listarPedidos(empresaId, filtros = {}) {
    const where = { deletedAt: null };
    if (empresaId) where.empresaId = empresaId;
    if (filtros?.status) where.status = filtros.status;
    return prisma.pedido.findMany({ where, orderBy: { createdAt: 'desc' }, include: { itens: true } });
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
    return prisma.pedido.findMany({ where, orderBy: { createdAt: order }, include: { itens: true } });
  },
  async buscarPedido(id, empresaId) {
    const where = { id, deletedAt: null };
    if (empresaId) where.empresaId = empresaId;
    return prisma.pedido.findUnique({ where, include: { itens: true } });
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
    return prisma.pedido.create({ data: payload, include: { itens: true } });
  },
  async atualizarPedido(id, data) {
    return prisma.pedido.update({ where: { id }, data });
  },

  // ---- Webhooks / Pagamentos ----
  async buscarEventoWebhook(eventId) {
    return prisma.processedWebhook.findUnique({ where: { eventId } });
  },
  async criarEventoWebhook(eventId) {
    return prisma.processedWebhook.create({ data: { eventId } });
  },
  async listarPagamentosRejeitados(empresaId) {
    const where = { status: 'rejeitado', refundId: null };
    if (empresaId) where.empresaId = empresaId;
    return prisma.pagamento.findMany({
      where,
      include: { pedido: true },
      orderBy: { rejeitadoEm: 'desc' },
    });
  },

  // ---- Entregadores ----
  async listarEntregadores(empresaId) {
    const where = {};
    if (empresaId) where.empresaId = empresaId;
    return prisma.entregador.findMany({ where });
  },
  async buscarEntregador(id) {
    return prisma.entregador.findUnique({ where: { id: Number(id) } });
  },
  async criarEntregador(data) {
    return prisma.entregador.create({ data });
  },
  async toggleEntregador(id, ativo) {
    return prisma.entregador.update({ where: { id: Number(id) }, data: { ativo } });
  },
  async atualizarEntregador(id, data) {
    return prisma.entregador.update({ where: { id: Number(id) }, data });
  },
  async deletarEntregador(id) {
    return prisma.entregador.delete({ where: { id: Number(id) } });
  },

  // ---- Usuários ----
  async buscarUsuario(username, empresaId) {
    if (empresaId) {
      return prisma.usuario.findUnique({ where: { empresaId_username: { empresaId, username } } });
    }
    return prisma.usuario.findFirst({ where: { username } });
  },
  async buscarUsuarioSuperadmin(username) {
    return prisma.usuario.findFirst({ where: { username, role: 'superadmin' } });
  },
  async listarUsuarios(empresaId) {
    const where = {};
    if (empresaId) where.empresaId = empresaId;
    return prisma.usuario.findMany({ where });
  },
  async criarUsuario(data) {
    return prisma.usuario.create({ data });
  },
  async deletarUsuario(id) {
    return prisma.usuario.delete({ where: { id: Number(id) } });
  },
  async buscarUsuarioPorId(id) {
    return prisma.usuario.findUnique({ where: { id: Number(id) } });
  },
  async atualizarUsuario(id, data) {
    return prisma.usuario.update({ where: { id: Number(id) }, data });
  },

  // ---- Caixa ----
  async buscarCaixaHoje(empresaId, data) {
    const where = { data: new Date(data) };
    if (empresaId) where.empresaId = empresaId;
    return prisma.caixaDiario.findFirst({ where });
  },
  async criarCaixa(data) {
    return prisma.caixaDiario.create({ data });
  },
  async atualizarCaixa(id, data) {
    return prisma.caixaDiario.update({ where: { id: Number(id) }, data });
  },
  async relatoriosCaixa(empresaId, inicio, fim) {
    const where = {};
    if (empresaId) where.empresaId = empresaId;
    if (inicio && fim) {
      where.data = { gte: new Date(inicio), lte: new Date(fim) };
    }
    return prisma.caixaDiario.findMany({ where, orderBy: { data: 'desc' } });
  },

  // ---- Horários ----
  async buscarHorarios(empresaId) {
    const where = {};
    if (empresaId) where.empresaId = empresaId;
    return prisma.horario.findFirst({ where });
  },
  async upsertHorarios(empresaId, data) {
    if (!empresaId) return prisma.horario.findFirst({ where: {} });
    return prisma.horario.upsert({ where: { empresaId }, update: data, create: { empresaId, ...data } });
  },

  // ---- Counters (prefixo por empresa p/ PK global) ----
  async nextPedidoId(empresaId) {
    if (!empresaId) throw new Error('empresaId required for nextPedidoId');
    const counter = await prisma.counter.upsert({
      where: { nome_empresaId: { nome: 'pedidoId', empresaId } },
      update: { lastValue: { increment: 1 } },
      create: { nome: 'pedidoId', empresaId, lastValue: 1 },
    });
    return `${empresaId}-${String(counter.lastValue).padStart(3, '0')}`;
  },

  // ---- Categorias ----
  async listarCategorias(empresaId) {
    const where = {};
    if (empresaId) where.empresaId = empresaId;
    return prisma.categoria.findMany({ where, orderBy: { nome: 'asc' }, include: { produtos: true } });
  },
  async buscarCategoria(id, empresaId) {
    const where = { id: Number(id) };
    if (empresaId) where.empresaId = empresaId;
    return prisma.categoria.findFirst({ where });
  },
  async criarCategoria(data) {
    return prisma.categoria.create({ data });
  },
  async atualizarCategoria(id, data) {
    return prisma.categoria.update({ where: { id: Number(id) }, data });
  },
  async deletarCategoria(id) {
    return prisma.categoria.delete({ where: { id: Number(id) } });
  },

  // ---- WhatsApp Instances ----
  async listarWhatsAppInstances(empresaId) {
    if (!empresaId) {
      return prisma.whatsAppInstance.findMany(); // superadmin: todas
    }
    return prisma.whatsAppInstance.findMany({ where: { empresaId } });
  },
  async buscarInstanciaAtiva(empresaId) {
    const where = { isActive: true };
    if (empresaId) where.empresaId = empresaId;
    return prisma.whatsAppInstance.findFirst({ where });
  },
  async buscarWhatsAppInstance(id, empresaId) {
    const where = { id: Number(id) };
    if (empresaId) where.empresaId = empresaId; // valida empresa
    return prisma.whatsAppInstance.findFirst({ where });
  },
  async criarWhatsAppInstance(data) {
    return prisma.whatsAppInstance.create({ data });
  },
  async atualizarWhatsAppInstance(id, data) {
    return prisma.whatsAppInstance.update({ where: { id: Number(id) }, data });
  },
  async deletarWhatsAppInstance(id, empresaId) {
    const where = { id: Number(id) };
    if (empresaId) where.empresaId = empresaId; // valida empresa
    return prisma.whatsAppInstance.delete({ where });
  },

  // ---- Clientes ----
  async listarClientes(empresaId) {
    const where = {};
    if (empresaId) where.empresaId = empresaId;
    return prisma.cliente.findMany({ where, orderBy: { createdAt: 'desc' } });
  },
  async buscarCliente(telefone, empresaId) {
    if (empresaId) {
      return prisma.cliente.findUnique({ where: { empresaId_telefone: { empresaId, telefone } } });
    }
    return prisma.cliente.findFirst({ where: { telefone } });
  },
  async buscarClientePorId(id) {
    return prisma.cliente.findUnique({ where: { id: Number(id) } });
  },
  async criarCliente(data) {
    return prisma.cliente.create({ data });
  },
  async atualizarCliente(id, data) {
    return prisma.cliente.update({ where: { id: Number(id) }, data });
  },
  async deletarCliente(id) {
    return prisma.cliente.delete({ where: { id: Number(id) } });
  },

  // ---- Cupons ----
  async buscarCupom(codigo, empresaId) {
    const where = { codigo };
    if (empresaId) where.empresaId = empresaId;
    return prisma.cupom.findFirst({ where });
  },
  async listarCupons(empresaId) {
    const where = {};
    if (empresaId) where.empresaId = empresaId;
    return prisma.cupom.findMany({ where });
  },
  async criarCupom(data) {
    return prisma.cupom.create({ data });
  },
  async atualizarCupom(codigo, data) {
    return prisma.cupom.update({ where: { codigo }, data });
  },

  // ---- Empresas ----
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

  // ---- Pedidos (soft-delete helpers) ----
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

  // ---- Settlements ----
  async criarSettlement(data) {
    return prisma.weeklySettlement.create({ data });
  },
  async buscarSettlementActual(empresaId, weekStart) {
    return prisma.weeklySettlement.findUnique({
      where: { empresaId_weekStart: { empresaId, weekStart } },
    });
  },
  async listarSettlements(empresaId, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [settlements, total] = await Promise.all([
      prisma.weeklySettlement.findMany({
        where: { empresaId },
        orderBy: { weekStart: 'desc' },
        skip,
        take: limit,
      }),
      prisma.weeklySettlement.count({ where: { empresaId } }),
    ]);
    return { settlements, total, page, limit };
  },
  async buscarSettlementPorId(id) {
    return prisma.weeklySettlement.findUnique({ where: { id } });
  },
  async atualizarSettlement(id, data) {
    return prisma.weeklySettlement.update({ where: { id }, data });
  },
  async buscarSettlementByTransferId(transferId) {
    return prisma.weeklySettlement.findFirst({ where: { transferId } });
  },
  async countSettlementsPendentes(empresaId) {
    return prisma.weeklySettlement.count({
      where: { empresaId, status: { in: ['processando', 'pendente'] } },
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
  // ---- Empresa soft/hard delete ----
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

module.exports = sql;
