const prisma = require('../config/prisma');
const pedidoRepository = require('./pedidoRepository');
const empresaRepository = require('./empresaRepository');

const sql = {
  // ---- Produtos ----
  async listarProdutos(empresaId, filtros = {}) {
    const where = {};
    if (empresaId) where.empresaId = empresaId;
    if (filtros?.page) {
      const page = Number(filtros.page) || 1;
      const limit = Math.min(Number(filtros.limit) || 50, 100);
      const skip = (page - 1) * limit;
      const [items, total] = await Promise.all([
        prisma.produto.findMany({ where, include: { category: true }, orderBy: { name: 'asc' }, skip, take: limit }),
        prisma.produto.count({ where }),
      ]);
      return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
    }
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

  // ---- Pedidos (delegated to pedidoRepository) ----
  async listarPedidos(empresaId, filtros) { return pedidoRepository.listarPedidos(empresaId, filtros); },
  async listarPedidosFiltrados(empresaId, filtros) { return pedidoRepository.listarPedidosFiltrados(empresaId, filtros); },
  async buscarPedido(id, empresaId) { return pedidoRepository.buscarPedido(id, empresaId); },
  async buscarPedidoComItens(id, empresaId) { return pedidoRepository.buscarPedidoComItens(id, empresaId); },
  async listarPedidosPorIds(ids) { return pedidoRepository.listarPedidosPorIds(ids); },
  async criarPedido(data) { return pedidoRepository.criarPedido(data); },
  async atualizarPedido(id, data) { return pedidoRepository.atualizarPedido(id, data); },
  async listarNaoConcluidos(empresaId, filtros) { return pedidoRepository.listarNaoConcluidos(empresaId, filtros); },
  async hardDeletePedidos(ids) { return pedidoRepository.hardDeletePedidos(ids); },
  async listarParaLimpeza(dias) { return pedidoRepository.listarParaLimpeza(dias); },
  async marcarPedidosArquivados(empresaId, weekStart, weekEnd) { return pedidoRepository.marcarPedidosArquivados(empresaId, weekStart, weekEnd); },
  async buscarPedidosPagosNoPeriodo(empresaId, weekStart, weekEnd) { return pedidoRepository.buscarPedidosPagosNoPeriodo(empresaId, weekStart, weekEnd); },

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
  async listarEntregadores(empresaId, filtros = {}) {
    const where = {};
    if (empresaId) where.empresaId = empresaId;
    if (filtros?.page) {
      const page = Number(filtros.page) || 1;
      const limit = Math.min(Number(filtros.limit) || 50, 100);
      const skip = (page - 1) * limit;
      const [items, total] = await Promise.all([
        prisma.entregador.findMany({ where, skip, take: limit }),
        prisma.entregador.count({ where }),
      ]);
      return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
    }
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
  async listarClientes(empresaId, filtros = {}) {
    const where = {};
    if (empresaId) where.empresaId = empresaId;
    if (filtros?.page) {
      const page = Number(filtros.page) || 1;
      const limit = Math.min(Number(filtros.limit) || 50, 100);
      const skip = (page - 1) * limit;
      const [items, total] = await Promise.all([
        prisma.cliente.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit }),
        prisma.cliente.count({ where }),
      ]);
      return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
    }
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

  // ---- Empresas (delegated to empresaRepository) ----
  async listarEmpresas() { return empresaRepository.listarEmpresas(); },
  async buscarEmpresa(id) { return empresaRepository.buscarEmpresa(id); },
  async buscarEmpresaPorSlug(slug) { return empresaRepository.buscarEmpresaPorSlug(slug); },
  async buscarEmpresaByEmail(email) { return empresaRepository.buscarEmpresaByEmail(email); },
  async atualizarEmpresa(id, data) { return empresaRepository.atualizarEmpresa(id, data); },
  async criarEmpresa(data) { return empresaRepository.criarEmpresa(data); },
  async deletarEmpresa(id) { return empresaRepository.deletarEmpresa(id); },
  async softDeleteEmpresa(id) { return empresaRepository.softDeleteEmpresa(id); },
  async hardDeleteEmpresa(id) { return empresaRepository.hardDeleteEmpresa(id); },
  async listarEmpresasAtivas() { return empresaRepository.listarEmpresasAtivas(); },

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
};

sql.pedidoRepository = pedidoRepository;
sql.empresaRepository = empresaRepository;
module.exports = sql;
