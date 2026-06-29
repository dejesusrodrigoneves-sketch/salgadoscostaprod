const bcrypt = require('bcryptjs');
const prisma = require('../config/prisma');
const sql = require('../repositories/sqlRepository');
const { asyncHandler } = require('../middleware/errorHandler');
const tokenService = require('../services/tokenService');

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

async function resolveEmpresa(slug) {
  const empresa = await sql.buscarEmpresaPorSlug(slug || 'salgadoscosta');
  if (!empresa) throw Object.assign(new Error('Loja não encontrada'), { status: 404 });
  return empresa;
}

exports.listarProdutos = asyncHandler(async (req, res) => {
  const empresa = await resolveEmpresa(req.query.slug);
  const produtos = await sql.listarProdutos(empresa.id);
  res.json(produtos);
});

exports.listarCategorias = asyncHandler(async (req, res) => {
  const empresa = await resolveEmpresa(req.query.slug);
  const categorias = await sql.listarCategorias(empresa.id);
  res.json(categorias);
});

exports.statusLoja = asyncHandler(async (req, res) => {
  const service = require('../services/lojaService');
  const status = await service.getStatus(req.query.slug || 'salgadoscosta');
  res.json(status);
});

exports.settingsLoja = asyncHandler(async (req, res) => {
  const service = require('../services/lojaService');
  const empresa = await resolveEmpresa(req.query.slug);
  const settings = await service.getSettings(empresa.id);
  res.json(settings);
});

exports.registrarCliente = asyncHandler(async (req, res) => {
  const { slug, nome, telefone, password, endereco, numero, bairro, cep, pontoReferencia } = req.body;
  if (!nome || !telefone) {
    return res.status(400).json({ error: 'Nome e telefone são obrigatórios' });
  }
  const empresa = await resolveEmpresa(slug);
  const existing = await sql.buscarCliente(empresa.id, telefone);
  if (existing) {
    return res.status(409).json({ error: 'Cliente já cadastrado com este telefone' });
  }
  const passwordHash = password ? await bcrypt.hash(password, SALT_ROUNDS) : null;
  const cliente = await sql.criarCliente({
    empresaId: empresa.id,
    nome, telefone, endereco, numero, bairro, cep, pontoReferencia, passwordHash,
  });
  const token = tokenService.gerarToken({ id: cliente.id, empresaId: cliente.empresaId, telefone: cliente.telefone, nome: cliente.nome });
  res.status(201).json({ token, cliente: { id: cliente.id, nome: cliente.nome, telefone: cliente.telefone } });
});

exports.loginCliente = asyncHandler(async (req, res) => {
  const { slug, telefone, password } = req.body;
  if (!telefone) return res.status(400).json({ error: 'Telefone é obrigatório' });
  const empresa = await resolveEmpresa(slug);
  const cliente = await sql.buscarCliente(empresa.id, telefone);
  if (!cliente) return res.status(404).json({ error: 'Cliente não encontrado' });
  if (cliente.passwordHash && password) {
    const match = await bcrypt.compare(password, cliente.passwordHash);
    if (!match) return res.status(401).json({ error: 'Senha incorreta' });
  } else if (cliente.passwordHash && !password) {
    return res.status(401).json({ error: 'Senha necessária' });
  }
  const token = tokenService.gerarToken({ id: cliente.id, empresaId: cliente.empresaId, telefone: cliente.telefone, nome: cliente.nome });
  res.json({ token, cliente: { id: cliente.id, nome: cliente.nome, telefone: cliente.telefone, endereco: cliente.endereco, numero: cliente.numero, bairro: cliente.bairro, cep: cliente.cep, pontoReferencia: cliente.pontoReferencia } });
});

exports.clientePerfil = [authenticatePublic, asyncHandler(async (req, res) => {
  const cliente = await sql.buscarClientePorId(req.cliente.id);
  if (!cliente) return res.status(404).json({ error: 'Cliente não encontrado' });
  res.json({ id: cliente.id, nome: cliente.nome, telefone: cliente.telefone, endereco: cliente.endereco, numero: cliente.numero, bairro: cliente.bairro, cep: cliente.cep, pontoReferencia: cliente.pontoReferencia });
})];

exports.atualizarCliente = [authenticatePublic, asyncHandler(async (req, res) => {
  const { nome, endereco, numero, bairro, cep, pontoReferencia } = req.body;
  const cliente = await sql.atualizarCliente(req.cliente.id, { nome, endereco, numero, bairro, cep, pontoReferencia });
  res.json({ id: cliente.id, nome: cliente.nome, telefone: cliente.telefone, endereco: cliente.endereco, numero: cliente.numero, bairro: cliente.bairro, cep: cliente.cep, pontoReferencia: cliente.pontoReferencia });
})];

exports.listarPedidosCliente = [authenticatePublic, asyncHandler(async (req, res) => {
  const pedidos = await prisma.pedido.findMany({
    where: { empresaId: req.cliente.empresaId, clienteWhatsapp: req.cliente.telefone },
    orderBy: { createdAt: 'desc' },
    include: { itens: { include: { produto: true } } },
  });
  res.json(pedidos);
})];

exports.criarPedido = [authenticatePublic, asyncHandler(async (req, res) => {
  const { slug, clienteNome, clienteEndereco, clienteNumero, clienteBairro, clienteCep, clienteReferencia, tipoEntrega, formaPagamento, troco, itens } = req.body;
  if (!clienteNome || !itens || !Array.isArray(itens) || itens.length === 0) {
    return res.status(400).json({ error: 'Dados do pedido incompletos' });
  }
  const empresa = await resolveEmpresa(slug);
  const pedidoId = await sql.nextPedidoId(empresa.id);
  const clienteWhatsapp = req.cliente.telefone;

  let valoresItens = 0;
  const itensPedido = [];
  for (const item of itens) {
    const produto = await sql.buscarProduto(empresa.id, item.produtoId);
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
      empresaId: empresa.id,
      clienteNome, clienteWhatsapp, clienteEndereco, clienteNumero, clienteBairro, clienteCep, clienteReferencia,
      tipoEntrega: tipoEntrega || 'delivery',
      formaPagamento: formaPagamento || null,
      troco: troco ? Number(troco) : null,
      status: 'pendente',
      valoresItens,
      taxasEntrega: 0,
      taxasCartao: 0,
      desconto: 0,
      total: valoresItens,
      itens: { create: itensPedido },
    },
    include: { itens: true },
  });

  res.status(201).json({ id: pedido.id, status: pedido.status });
})];

exports.buscarPedido = asyncHandler(async (req, res) => {
  const pedido = await sql.buscarPedido(req.params.id);
  if (!pedido) return res.status(404).json({ error: 'Pedido não encontrado' });
  res.json(pedido);
});

exports.validarCupom = asyncHandler(async (req, res) => {
  const empresa = await resolveEmpresa(req.query.slug);
  const cupom = await sql.buscarCupom(empresa.id, req.params.codigo);
  if (!cupom) return res.status(404).json({ error: 'Cupom não encontrado' });
  if (cupom.usado) return res.status(400).json({ error: 'Cupom já utilizado' });
  res.json({ codigo: cupom.codigo, desconto: Number(cupom.desconto) });
});


