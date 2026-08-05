const bcrypt = require('bcryptjs');
const prisma = require('../config/prisma');
const sql = require('../repositories/sqlRepository');
const { asyncHandler } = require('../middleware/errorHandler');
const { getCtx } = require('../middleware/context');
const auditService = require('../services/auditService');
const tokenService = require('../services/tokenService');
const productService = require('../services/productService');

const SALT_ROUNDS = 10;

function authenticatePublic(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token não fornecido' });
  }
  try {
    const token = authHeader.split(' ')[1];
    const decoded = tokenService.verificarToken(token);
    req.cliente = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }
}

exports.listarProdutos = asyncHandler(async (req, res) => {
  const produtos = await productService.listar();
  res.json(produtos);
});

exports.listarCategorias = asyncHandler(async (req, res) => {
  const categorias = await sql.listarCategorias();
  res.json(categorias);
});

exports.statusLoja = asyncHandler(async (req, res) => {
  const service = require('../services/lojaService');
  const status = await service.getStatus('salgadoscosta');
  res.json(status);
});

exports.settingsLoja = asyncHandler(async (req, res) => {
  const service = require('../services/lojaService');
  const settings = await service.getSettings();
  res.json(settings);
});

exports.registrarCliente = asyncHandler(async (req, res) => {
  const { nome, telefone, password, endereco, numero, bairro, cep, pontoReferencia } = req.body;
  if (!nome || !telefone) {
    return res.status(400).json({ error: 'Nome e telefone são obrigatórios' });
  }
  const existing = await sql.buscarCliente(telefone);
  if (existing) {
    auditService.audit({
      ...getCtx(req),
      action: 'cliente.register_failed',
      module: 'clientes',
      actorType: 'cliente',
      actorUsername: telefone,
      targetType: 'cliente',
      targetId: existing.id,
      severity: 'warning',
      reason: 'telefone_existente',
    });
    return res.status(409).json({ error: 'Cliente já cadastrado com este telefone' });
  }
  const passwordHash = password ? await bcrypt.hash(password, SALT_ROUNDS) : null;
  const cliente = await sql.criarCliente({
    empresaId: 1,
    nome, telefone, endereco, numero, bairro, cep, pontoReferencia, passwordHash,
  });
  const token = tokenService.gerarToken({ id: cliente.id, empresaId: 1, telefone: cliente.telefone, nome: cliente.nome });

  auditService.audit({
    ...getCtx(req),
    action: 'cliente.register',
    module: 'clientes',
    actorType: 'cliente',
    actorId: cliente.id,
    actorUsername: cliente.telefone,
    targetType: 'cliente',
    targetId: cliente.id,
    after: { nome: cliente.nome, telefone: cliente.telefone },
    changedFields: ['nome', 'telefone', 'passwordHash'],
  });

  res.status(201).json({ token, cliente: { id: cliente.id, nome: cliente.nome, telefone: cliente.telefone } });
});

exports.loginCliente = asyncHandler(async (req, res) => {
  const { telefone, password } = req.body;
  if (!telefone) return res.status(400).json({ error: 'Telefone é obrigatório' });
  const base = { ...getCtx(req), module: 'clientes' };
  const cliente = await sql.buscarCliente(telefone);
  if (!cliente) {
    auditService.audit({
      ...base,
      action: 'cliente.login_failed',
      actorType: 'anon',
      actorUsername: telefone,
      severity: 'warning',
      reason: 'cliente_nao_encontrado',
    });
    return res.status(404).json({ error: 'Cliente não encontrado' });
  }
  if (cliente.passwordHash && password) {
    const match = await bcrypt.compare(password, cliente.passwordHash);
    if (!match) {
      auditService.audit({
        ...base,
        action: 'cliente.login_failed',
        actorType: 'cliente',
        actorId: cliente.id,
        actorUsername: cliente.telefone,
        targetType: 'cliente',
        targetId: cliente.id,
        severity: 'warning',
        reason: 'senha_incorreta',
      });
      return res.status(401).json({ error: 'Senha incorreta' });
    }
  } else if (cliente.passwordHash && !password) {
    return res.status(401).json({ error: 'Senha necessária' });
  }
  const token = tokenService.gerarToken({ id: cliente.id, empresaId: 1, telefone: cliente.telefone, nome: cliente.nome });

  auditService.audit({
    ...base,
    action: 'cliente.login',
    actorType: 'cliente',
    actorId: cliente.id,
    actorUsername: cliente.telefone,
    targetType: 'cliente',
    targetId: cliente.id,
  });

  res.json({ token, cliente: { id: cliente.id, nome: cliente.nome, telefone: cliente.telefone, endereco: cliente.endereco, numero: cliente.numero, bairro: cliente.bairro, cep: cliente.cep, pontoReferencia: cliente.pontoReferencia } });
});

exports.clientePerfil = [authenticatePublic, asyncHandler(async (req, res) => {
  const cliente = await sql.buscarClientePorId(req.cliente.id);
  if (!cliente) return res.status(404).json({ error: 'Cliente não encontrado' });
  res.json({ id: cliente.id, nome: cliente.nome, telefone: cliente.telefone, endereco: cliente.endereco, numero: cliente.numero, bairro: cliente.bairro, cep: cliente.cep, pontoReferencia: cliente.pontoReferencia });
})];

exports.atualizarCliente = [authenticatePublic, asyncHandler(async (req, res) => {
  const { nome, endereco, numero, bairro, cep, pontoReferencia } = req.body;
  const existente = await sql.buscarClientePorId(req.cliente.id);
  if (!existente) return res.status(404).json({ error: 'Cliente não encontrado' });
  const cliente = await sql.atualizarCliente(req.cliente.id, { nome, endereco, numero, bairro, cep, pontoReferencia });

  const changedFields = ['nome', 'endereco', 'numero', 'bairro', 'cep', 'pontoReferencia'].filter((k) => req.body[k] !== undefined);
  const before = {};
  const after = {};
  for (const key of changedFields) {
    before[key] = existente[key];
    after[key] = req.body[key];
  }

  auditService.audit({
    ...getCtx(req),
    action: 'cliente.update',
    module: 'clientes',
    targetType: 'cliente',
    targetId: req.cliente.id,
    before,
    after,
    changedFields,
  });

  res.json({ id: cliente.id, nome: cliente.nome, telefone: cliente.telefone, endereco: cliente.endereco, numero: cliente.numero, bairro: cliente.bairro, cep: cliente.cep, pontoReferencia: cliente.pontoReferencia });
})];

exports.listarPedidosCliente = [authenticatePublic, asyncHandler(async (req, res) => {
  const pedidos = await prisma.pedido.findMany({
    where: { empresaId: 1, clienteWhatsapp: req.cliente.telefone },
    orderBy: { createdAt: 'desc' },
    include: { itens: { include: { produto: true } } },
  });
  res.json(pedidos);
})];

exports.criarPedido = asyncHandler(async (req, res) => {
  const { clienteNome, clienteWhatsapp, clienteEndereco, clienteNumero, clienteBairro, clienteCep, clienteReferencia, tipoEntrega, formaPagamento, troco, itens, taxasEntrega, taxasCartao, desconto, total } = req.body;
  if (!clienteNome || !itens || !Array.isArray(itens) || itens.length === 0) {
    return res.status(400).json({ error: 'Dados do pedido incompletos' });
  }
  const pedidoId = await sql.nextPedidoId();

  let valoresItens = 0;
  const itensPedido = [];
  for (const item of itens) {
    const produto = await sql.buscarProduto(item.produtoId);
    if (!produto) continue;
    const preco = Number(produto.price);
    const qtd = item.quantidade || 1;
    valoresItens += preco * qtd;
    itensPedido.push({
      produtoId: Number(item.produtoId),
      quantidade: qtd,
      precoUnitario: preco,
      sabores: item.sabores || null,
    });
  }

  const pedido = await prisma.pedido.create({
    data: {
      id: pedidoId,
      empresaId: 1,
      clienteNome, clienteWhatsapp, clienteEndereco, clienteNumero, clienteBairro, clienteCep, clienteReferencia,
      tipoEntrega: tipoEntrega || 'delivery',
      formaPagamento: formaPagamento || null,
      troco: troco ? Number(troco) : null,
      status: 'pendente',
      valoresItens,
      taxasEntrega: taxasEntrega !== undefined ? Number(taxasEntrega) : 0,
      taxasCartao: taxasCartao !== undefined ? Number(taxasCartao) : 0,
      desconto: desconto !== undefined ? Number(desconto) : 0,
      total: total !== undefined ? Number(total) : valoresItens,
      itens: { create: itensPedido },
    },
    include: { itens: true },
  });

  auditService.audit({
    ...getCtx(req),
    action: 'pedido.create',
    module: 'pedidos',
    targetType: 'pedido',
    targetId: pedido.id,
    after: {
      clienteNome: pedido.clienteNome,
      clienteWhatsapp: pedido.clienteWhatsapp,
      total: Number(pedido.total),
      status: pedido.status,
      tipoEntrega: pedido.tipoEntrega,
      formaPagamento: pedido.formaPagamento,
    },
    changedFields: ['clienteNome', 'clienteWhatsapp', 'total', 'status', 'tipoEntrega', 'formaPagamento'],
    metadata: { itensCount: itensPedido.length, url: req.context?.path },
  });

  res.status(201).json({ id: pedido.id, status: pedido.status });
});

exports.buscarPedido = asyncHandler(async (req, res) => {
  const pedido = await sql.buscarPedido(req.params.id);
  if (!pedido) return res.status(404).json({ error: 'Pedido não encontrado' });
  res.json(pedido);
});

exports.validarCupom = asyncHandler(async (req, res) => {
  const cupom = await sql.buscarCupom(req.params.codigo);
  if (!cupom) return res.status(404).json({ error: 'Cupom não encontrado' });
  if (cupom.usado) return res.status(400).json({ error: 'Cupom já utilizado' });
  res.json({ codigo: cupom.codigo, desconto: Number(cupom.desconto) });
});


