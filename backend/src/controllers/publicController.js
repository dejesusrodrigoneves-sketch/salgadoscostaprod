const bcrypt = require('bcryptjs');
const prisma = require('../config/prisma');
const sql = require('../repositories/sqlRepository');
const { asyncHandler } = require('../middleware/errorHandler');
const { getCtx } = require('../middleware/context');
const auditService = require('../services/auditService');
const tokenService = require('../services/tokenService');
const productService = require('../services/productService');
const consentimentoService = require('../services/consentimentoService');
const { validateMaxLen } = require('../utils/validation');

const SALT_ROUNDS = 10;

function empresaId(req) {
  return req.ctx?.empresaId || req.user?.empresaId || req.cliente?.empresaId;
}

// FAIL-CLOSED: rotas de tenant exigem tenant resolvido (subdomínio).
// Sem tenant (host raiz/www/api/localhost) => 404, nunca vaza dados globais.
function requireTenant(req, res) {
  const id = empresaId(req);
  if (!id) {
    res.status(404).json({ error: 'Loja não encontrada' });
    return null;
  }
  return id;
}

function setCache(res, seconds) {
  res.set('Cache-Control', 'public, max-age=' + seconds + ', s-maxage=' + seconds);
}

async function authenticatePublic(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token não fornecido' });
  }
  try {
    const token = authHeader.split(' ')[1];
    const decoded = tokenService.verificarToken(token);
    // Cross-tenant: token cunhado em empresa A não vale em empresa B
    if (decoded.empresaId && req.ctx?.empresaId && decoded.empresaId !== req.ctx.empresaId) {
      return res.status(403).json({ error: 'Acesso negado: empresa não corresponde' });
    }
    const cliente = await sql.buscarClientePorId(decoded.id);
    if (!cliente) {
      return res.status(401).json({ error: 'Conta não encontrada ou removida' });
    }
    if (cliente.consentimentoRevogadoAt) {
      return res.status(401).json({ error: 'Consentimento revogado. Reautorize os dados para continuar' });
    }
    req.cliente = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }
}

exports.listarProdutos = asyncHandler(async (req, res) => {
  const empId = requireTenant(req, res);
  if (!empId) return;
  const produtos = await productService.listar(empId);
  setCache(res, 60);
  res.json(produtos);
});

exports.listarCategorias = asyncHandler(async (req, res) => {
  const empId = requireTenant(req, res);
  if (!empId) return;
  const categorias = await sql.listarCategorias(empId);
  setCache(res, 60);
  res.json(categorias);
});

exports.statusLoja = asyncHandler(async (req, res) => {
  const slug = req.ctx?.empresa?.slug;
  if (!slug) return res.status(404).json({ error: 'Loja não encontrada' });
  const service = require('../services/lojaService');
  const status = await service.getStatus(slug);
  setCache(res, 30);
  res.json(status);
});

exports.settingsLoja = asyncHandler(async (req, res) => {
  const empId = requireTenant(req, res);
  if (!empId) return;
  const service = require('../services/lojaService');
  const settings = await service.getSettings(empId);
  setCache(res, 300);
  res.json(settings);
});

exports.registrarCliente = asyncHandler(async (req, res) => {
  const empId = requireTenant(req, res);
  if (!empId) return;
  const { nome, telefone, password, endereco, numero, bairro, cep, pontoReferencia } = req.body;
  if (!nome || !telefone) {
    return res.status(400).json({ error: 'Nome e telefone são obrigatórios' });
  }
  const consent = consentimentoService.validarConsentimento(req.body);
  if (!consent.ok) {
    return res.status(400).json({ error: consent.erro });
  }
  const existing = await sql.buscarCliente(telefone, empId);
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
    empresaId: empId,
    nome, telefone, endereco, numero, bairro, cep, pontoReferencia, passwordHash,
    consentimentoAt: new Date(),
    politicaVersao: consent.versao,
  });
  const token = tokenService.gerarToken({ id: cliente.id, empresaId: empId, telefone: cliente.telefone, nome: cliente.nome });

  auditService.audit({
    ...getCtx(req),
    action: 'cliente.register',
    module: 'clientes',
    actorType: 'cliente',
    actorId: cliente.id,
    actorUsername: cliente.telefone,
    targetType: 'cliente',
    targetId: cliente.id,
    after: { nome: cliente.nome, telefone: cliente.telefone, politicaVersao: consent.versao },
    changedFields: ['nome', 'telefone', 'passwordHash', 'consentimentoAt', 'politicaVersao'],
  });

  res.status(201).json({ token, cliente: { id: cliente.id, nome: cliente.nome, telefone: cliente.telefone } });
  // Set httpOnly cookie for additional security
  res.cookie('clientToken_' + empId, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  });
});

exports.revogarConsentimento = [authenticatePublic, asyncHandler(async (req, res) => {
  const agora = new Date();
  const cliente = await sql.buscarClientePorId(req.cliente.id);
  if (!cliente) return res.status(404).json({ error: 'Cliente não encontrado' });
  await sql.atualizarCliente(req.cliente.id, { consentimentoRevogadoAt: agora });

  auditService.audit({
    ...getCtx(req),
    action: 'cliente.revogar_consentimento',
    module: 'clientes',
    actorType: 'cliente',
    actorId: req.cliente.id,
    targetType: 'cliente',
    targetId: req.cliente.id,
    after: { consentimentoRevogadoAt: agora.toISOString() },
    changedFields: ['consentimentoRevogadoAt'],
  });

  res.json({ ok: true, revogadoEm: agora.toISOString() });
})];

exports.excluirConta = [authenticatePublic, asyncHandler(async (req, res) => {
  const cliente = await sql.buscarClientePorId(req.cliente.id);
  if (!cliente) return res.status(404).json({ error: 'Cliente não encontrado' });
  await sql.deletarCliente(req.cliente.id);

  auditService.audit({
    ...getCtx(req),
    action: 'cliente.eliminar',
    module: 'clientes',
    actorType: 'cliente',
    actorId: req.cliente.id,
    targetType: 'cliente',
    targetId: req.cliente.id,
    before: { nome: cliente.nome, telefone: cliente.telefone },
    changedFields: ['*'],
  });

  res.json({ ok: true, mensagem: 'Conta e dados pessoais removidos. Histórico fiscal de pedidos retido por 5 anos (Art. 16 I).' });
})];

exports.loginCliente = asyncHandler(async (req, res) => {
  const empId = requireTenant(req, res);
  if (!empId) return;
  const { telefone, password } = req.body;
  if (!telefone) return res.status(400).json({ error: 'Telefone é obrigatório' });
  const base = { ...getCtx(req), module: 'clientes' };
  const cliente = await sql.buscarCliente(telefone, empId);
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
  const token = tokenService.gerarToken({ id: cliente.id, empresaId: empId, telefone: cliente.telefone, nome: cliente.nome });

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
  // Set httpOnly cookie for additional security
  res.cookie('clientToken_' + empId, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  });
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
  const empId = requireTenant(req, res);
  if (!empId) return;
  const pedidos = await prisma.pedido.findMany({
    where: { empresaId: empId, clienteWhatsapp: req.cliente.telefone },
    orderBy: { createdAt: 'desc' },
    include: { itens: { include: { produto: true } } },
  });
  res.json(pedidos);
})];

exports.criarPedido = asyncHandler(async (req, res) => {
  const empId = requireTenant(req, res);
  if (!empId) return;
  const { clienteNome, clienteWhatsapp, clienteEndereco, clienteNumero, clienteBairro, clienteCep, clienteReferencia, tipoEntrega, formaPagamento, troco, itens, taxasEntrega, taxasCartao, desconto, cpf } = req.body;
  if (!clienteNome || !itens || !Array.isArray(itens) || itens.length === 0) {
    return res.status(400).json({ error: 'Dados do pedido incompletos' });
  }
  // Input length validation
  for (const [field, value] of Object.entries({ clienteNome, clienteWhatsapp, clienteEndereco, clienteBairro, clienteCep, clienteReferencia })) {
    const check = validateMaxLen(field, value);
    if (!check.valid) return res.status(400).json({ error: check.error });
  }
  const ehPix = String(formaPagamento || '').toLowerCase() === 'pix';
  if (ehPix && (!cpf || !/^\d{11}$/.test(String(cpf).replace(/\D/g, '')))) {
    return res.status(400).json({ error: 'CPF obrigatório para pagamento via PIX' });
  }
  const pedidoId = await sql.nextPedidoId(empId);

  const produtoIds = itens.map(i => Number(i.produtoId));
  const produtos = await sql.buscarProdutosPorIds(produtoIds, empId);
  const produtoMap = new Map(produtos.map(p => [p.id, p]));

  let valoresItens = 0;
  const itensPedido = [];
  for (const item of itens) {
    const produto = produtoMap.get(Number(item.produtoId));
    if (!produto) {
      return res.status(400).json({ error: 'Produto #' + item.produtoId + ' nao encontrado' });
    }
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
      empresaId: empId,
      clienteNome, clienteWhatsapp, clienteEndereco, clienteNumero, clienteBairro, clienteCep, clienteReferencia,
      tipoEntrega: tipoEntrega || 'delivery',
      formaPagamento: formaPagamento || null,
      troco: troco ? Number(troco) : null,
      status: ehPix ? 'aguardando_pagamento' : 'pendente',
      paymentStatus: ehPix ? 'aguardando_pagamento' : null,
      paymentMethod: ehPix ? 'pix' : null,
      valoresItens,
      taxasEntrega: taxasEntrega !== undefined ? Number(taxasEntrega) : 0,
      taxasCartao: taxasCartao !== undefined ? Number(taxasCartao) : 0,
      desconto: desconto !== undefined ? Number(desconto) : 0,
      total: Number(valoresItens) + Number(taxasEntrega || 0) + Number(taxasCartao || 0) - Number(desconto || 0),
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

  if (ehPix) {
    const paymentService = (await import('../services/paymentService.js')).default;
    const pagamento = await paymentService.criarPixPedido(pedido.id, {
      cliente: {
        id: req.cliente?.id || null,
        nome: clienteNome,
        cpf: String(cpf).replace(/\D/g, ''),
        telefone: clienteWhatsapp,
        asaasCustomerId: null,
      },
      valor: Number(pedido.total),
    });
    return res.status(201).json({
      id: pedido.id,
      status: pedido.status,
      pagamento: {
        id: pagamento.id,
        pixCode: pagamento.pixCode,
        pixQrCode: pagamento.pixQrCode,
        expiresAt: pagamento.expiresAt,
        taxaServico: pagamento.taxaServico,
      },
    });
  }

  res.status(201).json({ id: pedido.id, status: pedido.status });
});

exports.buscarPedido = asyncHandler(async (req, res) => {
  const empId = requireTenant(req, res);
  if (!empId) return;
  const pedido = await sql.buscarPedido(req.params.id, empId);
  if (!pedido) return res.status(404).json({ error: 'Pedido não encontrado' });
  res.json(pedido);
});

exports.validarCupom = asyncHandler(async (req, res) => {
  const empId = requireTenant(req, res);
  if (!empId) return;
  const cupom = await sql.buscarCupom(req.params.codigo, empId);
  if (!cupom) return res.status(404).json({ error: 'Cupom não encontrado' });
  if (cupom.usado) return res.status(400).json({ error: 'Cupom já utilizado' });
  res.json({ codigo: cupom.codigo, desconto: Number(cupom.desconto) });
});
