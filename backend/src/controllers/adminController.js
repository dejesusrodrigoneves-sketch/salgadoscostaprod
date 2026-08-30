const sql = require('../repositories/sqlRepository');
const { asyncHandler } = require('../middleware/errorHandler');
const { normalizarSlug } = require('../utils/slug.js');
const { invalidateEmpresaCache } = require('../config/empresaCache');
const paymentSetupService = require('../services/paymentSetupService');

exports.listar = asyncHandler(async (req, res) => {
  const empresas = await sql.listarEmpresas();
  res.json(empresas);
});

exports.criar = asyncHandler(async (req, res) => {
  const { nome, slug, telefone, endereco, numero, bairro, cidade, estado, cep, descricao } = req.body;
  if (!nome || !nome.trim() || !slug) {
    return res.status(400).json({ error: 'Nome e slug são obrigatórios' });
  }
  const slugNorm = normalizarSlug(slug);
  if (!slugNorm) {
    return res.status(400).json({ error: 'Slug inválido' });
  }
  const existente = await sql.buscarEmpresaPorSlug(slugNorm);
  if (existente) {
    return res.status(409).json({ error: 'Slug já existe' });
  }
  let empresa;
  try {
    empresa = await sql.criarEmpresa({
      nome: nome.trim(),
      slug: slugNorm,
      telefone: telefone || null,
      endereco: endereco || null,
      numero: numero || null,
      bairro: bairro || null,
      cidade: cidade || null,
      estado: estado || null,
      cep: cep || null,
      descricao: descricao || null,
    });
  } catch (err) {
    if (err && err.code === 'P2002') {
      return res.status(409).json({ error: 'Slug já existe' });
    }
    throw err;
  }
  try { invalidateEmpresaCache(slugNorm); } catch (e) {}
  
  // Auto-create subscription (trial)
  try {
    const { createTrialSubscription } = require('../services/subscriptionService.js');
    await createTrialSubscription(empresa.id);
  } catch (e) {
    console.error('[Empresa] Erro ao criar assinatura trial:', e.message);
  }
  
  // Create Asaas customer
  try {
    if (empresa.cpf_cnpj && empresa.email) {
      const asaasResponse = await fetch('https://api-sandbox.asaas.com/v3/customers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'access_token': process.env.ASAAS_API_KEY
        },
        body: JSON.stringify({
          name: empresa.nome,
          cpfCnpj: empresa.cpf_cnpj,
          email: empresa.email,
          phone: empresa.telefone
        })
      });
      
      if (asaasResponse.ok) {
        const asaasData = await asaasResponse.json();
        const prisma = require('../config/prisma.js').default;
        await prisma.empresa.update({
          where: { id: empresa.id },
          data: { asaasSubcontaId: asaasData.id }
        });
      }
    }
  } catch (e) {
    console.error('[Empresa] Erro ao criar cliente Asaas:', e.message);
  }
  
  res.status(201).json(empresa);
});

exports.atualizar = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'ID inválido' });
  const existente = await sql.buscarEmpresa(id);
  if (!existente) return res.status(404).json({ error: 'Empresa não encontrada' });
  const allowed = ['nome', 'slug', 'telefone', 'endereco', 'numero', 'bairro', 'cidade', 'estado', 'cep', 'descricao', 'logo', 'capa', 'openingTime', 'closingTime', 'workingDays', 'isOpen', 'manualOverride', 'themeSettings', 'bairrosAtendidos'];
  const payload = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) payload[key] = req.body[key];
  }
  if (payload.nome !== undefined && (!payload.nome || !payload.nome.trim())) {
    return res.status(400).json({ error: 'Nome não pode ser vazio' });
  }
  if (payload.nome !== undefined) payload.nome = payload.nome.trim();
  if (Object.keys(payload).length === 0) {
    return res.status(400).json({ error: 'Nenhum campo para atualizar' });
  }
  if (payload.slug !== undefined) {
    const slugNorm = normalizarSlug(payload.slug);
    if (!slugNorm) return res.status(400).json({ error: 'Slug inválido' });
    const dupe = await sql.buscarEmpresaPorSlug(slugNorm);
    if (dupe && dupe.id !== id) return res.status(409).json({ error: 'Slug já existe' });
    payload.slug = slugNorm;
  }
  let empresa;
  try {
    empresa = await sql.atualizarEmpresa(id, payload);
  } catch (err) {
    if (err && err.code === 'P2002') {
      return res.status(409).json({ error: 'Slug já existe' });
    }
    throw err;
  }
  try { invalidateEmpresaCache(existente.slug); } catch (e) {}
  if (payload.slug !== undefined && payload.slug !== existente.slug) {
    try { invalidateEmpresaCache(payload.slug); } catch (e) {}
  }
  res.json(empresa);
});

exports.deletar = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'ID inválido' });
  const existente = await sql.buscarEmpresa(id);
  if (!existente) return res.status(404).json({ error: 'Empresa não encontrada' });

  // Verificar settlements pendentes
  const pendentes = await sql.countSettlementsPendentes(id);
  if (pendentes > 0) {
    return res.status(409).json({
      error: `Empresa possui ${pendentes} settlement(s) pendente(s). Aguarde processamento.`,
    });
  }

  await sql.softDeleteEmpresa(id);
  try { invalidateEmpresaCache(existente.slug); } catch (e) {}
  res.json({ success: true, message: 'Empresa removida (soft delete)' });
});

exports.deactivatePayment = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'ID inválido' });
  const empresa = await sql.buscarEmpresa(id);
  const result = await paymentSetupService.deactivate(id);
  if (empresa) {
    try { invalidateEmpresaCache(empresa.slug); } catch (e) {}
  }
  res.json(result);
});
