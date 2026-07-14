const prisma = require('../config/prisma');
const EMPRESA_ID = 1;

const sql = {
  // ---- Produtos ----
  async listarProdutos() {
    return prisma.produto.findMany({ where: { empresaId: EMPRESA_ID }, include: { category: true } });
  },
  async buscarProduto(id) {
    return prisma.produto.findFirst({ where: { id: Number(id), empresaId: EMPRESA_ID } });
  },
  async criarProduto(data) {
    const { id, empresaId, ...rest } = data;
    return prisma.produto.create({
      data: { ...rest, empresa: { connect: { id: empresaId || EMPRESA_ID } } }
    });
  },
  async atualizarProduto(id, data) {
    return prisma.produto.update({ where: { id: Number(id) }, data });
  },
  async deletarProduto(id) {
    return prisma.produto.delete({ where: { id: Number(id) } });
  },

  // ---- Pedidos ----
  async listarPedidos(filtros = {}) {
    const where = { empresaId: EMPRESA_ID, ...filtros };
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
  async listarEntregadores() {
    return prisma.entregador.findMany({ where: { empresaId: EMPRESA_ID } });
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
  async buscarUsuario(username) {
    return prisma.usuario.findUnique({ where: { empresaId_username: { empresaId: EMPRESA_ID, username } } });
  },
  async listarUsuarios() {
    return prisma.usuario.findMany({ where: { empresaId: EMPRESA_ID } });
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
  async buscarCaixaHoje(data) {
    return prisma.caixaDiario.findFirst({ where: { empresaId: EMPRESA_ID, data: new Date(data) } });
  },
  async criarCaixa(data) {
    return prisma.caixaDiario.create({ data });
  },
  async atualizarCaixa(id, data) {
    return prisma.caixaDiario.update({ where: { id: Number(id) }, data });
  },
  async relatoriosCaixa(inicio, fim) {
    const where = { empresaId: EMPRESA_ID };
    if (inicio && fim) {
      where.data = { gte: new Date(inicio), lte: new Date(fim) };
    }
    return prisma.caixaDiario.findMany({ where, orderBy: { data: 'desc' } });
  },

  // ---- Horários ----
  async buscarHorarios() {
    return prisma.horario.findFirst({ where: { empresaId: EMPRESA_ID } });
  },
  async upsertHorarios(data) {
    return prisma.horario.upsert({ where: { empresaId: EMPRESA_ID }, update: data, create: { empresaId: EMPRESA_ID, ...data } });
  },

  // ---- Counters ----
  async nextPedidoId() {
    const counter = await prisma.counter.upsert({
      where: { nome_empresaId: { nome: 'pedidoId', empresaId: EMPRESA_ID } },
      update: { lastValue: { increment: 1 } },
      create: { nome: 'pedidoId', empresaId: EMPRESA_ID, lastValue: 1 },
    });
    return String(counter.lastValue).padStart(3, '0');
  },

  // ---- Categorias ----
  async listarCategorias() {
    return prisma.categoria.findMany({ where: { empresaId: EMPRESA_ID }, orderBy: { nome: 'asc' }, include: { produtos: true } });
  },
  async buscarCategoria(id) {
    return prisma.categoria.findFirst({ where: { id: Number(id), empresaId: EMPRESA_ID } });
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
  async listarWhatsAppInstances() {
    return prisma.whatsAppInstance.findMany({ where: { empresaId: EMPRESA_ID } });
  },
  async buscarInstanciaAtiva() {
    return prisma.whatsAppInstance.findFirst({ where: { empresaId: EMPRESA_ID, isActive: true } });
  },
  async buscarWhatsAppInstance(id) {
    return prisma.whatsAppInstance.findFirst({ where: { id: Number(id), empresaId: EMPRESA_ID } });
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
  async listarClientes() {
    return prisma.cliente.findMany({ where: { empresaId: EMPRESA_ID }, orderBy: { createdAt: 'desc' } });
  },
  async buscarCliente(telefone) {
    return prisma.cliente.findUnique({ where: { empresaId_telefone: { empresaId: EMPRESA_ID, telefone } } });
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
  async buscarCupom(codigo) {
    return prisma.cupom.findFirst({ where: { empresaId: EMPRESA_ID, codigo } });
  },
  async listarCupons() {
    return prisma.cupom.findMany({ where: { empresaId: EMPRESA_ID } });
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