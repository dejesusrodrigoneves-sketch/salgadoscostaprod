const prisma = require('../config/prisma');

// Wrapper para facilitar troca futura entre SQL e Firestore
// Todas as queries passam por esta camada

const sql = {
  // ---- Produtos ----
  async listarProdutos(empresaId) {
    return prisma.produto.findMany({ where: { empresaId } });
  },
  async buscarProduto(empresaId, id) {
    return prisma.produto.findFirst({ where: { id: Number(id), empresaId } });
  },
  async criarProduto(data) {
    return prisma.produto.create({ data });
  },
  async atualizarProduto(id, data) {
    return prisma.produto.update({ where: { id: Number(id) }, data });
  },
  async deletarProduto(id) {
    return prisma.produto.delete({ where: { id: Number(id) } });
  },

  // ---- Pedidos ----
  async listarPedidos(empresaId, filtros = {}) {
    const where = { empresaId, ...filtros };
    return prisma.pedido.findMany({ where, orderBy: { createdAt: 'desc' }, include: { itens: true } });
  },
  async buscarPedido(id) {
    return prisma.pedido.findUnique({ where: { id }, include: { itens: true } });
  },
  async criarPedido(data) {
    return prisma.pedido.create({ data });
  },
  async atualizarPedido(id, data) {
    return prisma.pedido.update({ where: { id }, data });
  },

  // ---- Entregadores ----
  async listarEntregadores(empresaId) {
    return prisma.entregador.findMany({ where: { empresaId } });
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
    return prisma.usuario.findUnique({ where: { empresaId_username: { empresaId, username } } });
  },
  async listarUsuarios(empresaId) {
    return prisma.usuario.findMany({ where: { empresaId } });
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
    return prisma.caixaDiario.findFirst({ where: { empresaId, data: new Date(data) } });
  },
  async criarCaixa(data) {
    return prisma.caixaDiario.create({ data });
  },
  async atualizarCaixa(id, data) {
    return prisma.caixaDiario.update({ where: { id: Number(id) }, data });
  },
  async relatoriosCaixa(empresaId, inicio, fim) {
    const where = { empresaId };
    if (inicio && fim) {
      where.data = { gte: new Date(inicio), lte: new Date(fim) };
    }
    return prisma.caixaDiario.findMany({ where, orderBy: { data: 'desc' } });
  },

  // ---- Horários ----
  async buscarHorarios(empresaId) {
    return prisma.horario.findFirst({ where: { empresaId } });
  },
  async upsertHorarios(empresaId, data) {
    return prisma.horario.upsert({ where: { empresaId }, update: data, create: { empresaId, ...data } });
  },

  // ---- Counters ----
  async nextPedidoId(empresaId) {
    const counter = await prisma.counter.upsert({
      where: { nome_empresaId: { nome: 'pedidoId', empresaId } },
      update: { lastValue: { increment: 1 } },
      create: { nome: 'pedidoId', empresaId, lastValue: 1 },
    });
    return String(counter.lastValue).padStart(3, '0');
  },

  // ---- Categorias ----
  async listarCategorias(empresaId) {
    return prisma.categoria.findMany({ where: { empresaId }, orderBy: { nome: 'asc' } });
  },
  async buscarCategoria(empresaId, id) {
    return prisma.categoria.findFirst({ where: { id: Number(id), empresaId } });
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
    return prisma.whatsAppInstance.findMany({ where: { empresaId } });
  },
  async buscarInstanciaAtiva(empresaId) {
    return prisma.whatsAppInstance.findFirst({ where: { empresaId, isActive: true } });
  },
  async buscarWhatsAppInstance(empresaId, id) {
    return prisma.whatsAppInstance.findFirst({ where: { id: Number(id), empresaId } });
  },
  async criarWhatsAppInstance(data) {
    return prisma.whatsAppInstance.create({ data });
  },
  async atualizarWhatsAppInstance(id, data) {
    return prisma.whatsAppInstance.update({ where: { id: Number(id) }, data });
  },
  async deletarWhatsAppInstance(id) {
    return prisma.whatsAppInstance.delete({ where: { id: Number(id) } });
  },

  // ---- Clientes ----
  async listarClientes(empresaId) {
    return prisma.cliente.findMany({ where: { empresaId }, orderBy: { createdAt: 'desc' } });
  },
  async buscarCliente(empresaId, telefone) {
    return prisma.cliente.findUnique({ where: { empresaId_telefone: { empresaId, telefone } } });
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
  async buscarCupom(empresaId, codigo) {
    return prisma.cupom.findFirst({ where: { empresaId, codigo } });
  },
  async listarCupons(empresaId) {
    return prisma.cupom.findMany({ where: { empresaId } });
  },
  async criarCupom(data) {
    return prisma.cupom.create({ data });
  },
  async atualizarCupom(codigo, data) {
    return prisma.cupom.update({ where: { codigo }, data });
  },

  // ---- Empresas (superadmin + store settings) ----
  async listarEmpresas() {
    return prisma.empresa.findMany({ include: { _count: { select: { usuarios: true, produtos: true, pedidos: true } } } });
  },
  async buscarEmpresa(id) {
    return prisma.empresa.findUnique({ where: { id } });
  },
  async buscarEmpresaPorSlug(slug) {
    return prisma.empresa.findUnique({ where: { slug } });
  },
  async atualizarEmpresa(id, data) {
    return prisma.empresa.update({ where: { id }, data });
  },
  async criarEmpresa(data) {
    return prisma.empresa.create({ data });
  },
};

module.exports = sql;
