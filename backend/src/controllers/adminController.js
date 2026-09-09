const sql = require('../repositories/sqlRepository');
const { asyncHandler } = require('../middleware/errorHandler');
const { normalizarSlug } = require('../utils/slug.js');
const { invalidateEmpresaCache } = require('../config/empresaCache');
const paymentSetupService = require('../services/paymentSetupService');

exports.listar = asyncHandler(async (req, res) => {
  const empresas = await sql.listarEmpresas();
  const filtradas = empresas.map(function(e) {
    return {
      id: e.id, nome: e.nome, slug: e.slug, telefone: e.telefone,
      endereco: e.endereco, numero: e.numero, bairro: e.bairro,
      cidade: e.cidade, estado: e.estado, cep: e.cep,
      descricao: e.descricao, logo: e.logo, capa: e.capa,
      empresaTipo: e.empresaTipo, parentEmpresaId: e.parentEmpresaId,
      asaasOnboarded: e.asaasOnboarded, deletedAt: e.deletedAt,
      createdAt: e.createdAt,
    };
  });
  res.json(filtradas);
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
  const prisma = require('../config/prisma.js');
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

// ---- Filiais ----

exports.criarFilial = asyncHandler(async (req, res) => {
  const { nome, justificativa } = req.body;
  if (!nome || !nome.trim()) {
    return res.status(400).json({ error: 'Nome é obrigatório' });
  }

  const isSuperadmin = req.user.role === 'superadmin';

  // Superadmin: must send parentEmpresaId
  let parentEmpresaId;
  if (isSuperadmin) {
    parentEmpresaId = Number(req.body.parentEmpresaId);
    if (!parentEmpresaId || !Number.isInteger(parentEmpresaId)) {
      return res.status(400).json({ error: 'parentEmpresaId é obrigatório' });
    }
  } else {
    // Admin: force own empresa
    parentEmpresaId = req.user.empresaId;
  }

  // Verify matriz exists and is not filial
  const matriz = await sql.buscarEmpresa(parentEmpresaId);
  if (!matriz) {
    return res.status(404).json({ error: 'Matriz não encontrada' });
  }
  if (!isSuperadmin && matriz.empresaTipo === 'filial') {
    return res.status(403).json({ error: 'Somente loja matriz pode criar filiais' });
  }

  // Verify loop
  const isLoop = await sql.verificarLoopFilial(parentEmpresaId, parentEmpresaId);
  if (isLoop) {
    return res.status(400).json({ error: 'Loop de vínculo detectado' });
  }

  // Generate slug from name
  const slugNorm = normalizarSlug(nome);
  if (!slugNorm) {
    return res.status(400).json({ error: 'Nome inválido para slug' });
  }
  const existente = await sql.buscarEmpresaPorSlug(slugNorm);
  if (existente) {
    return res.status(409).json({ error: 'Já existe loja com esse nome' });
  }

  // Create filial
  const filial = await sql.criarFilial({
    nome: nome.trim(),
    slug: slugNorm,
    parentEmpresaId,
    themeSettingsPai: matriz.themeSettings,
    status: isSuperadmin ? 'active' : 'pending',
    createdBy: req.user.id,
    justificativa: justificativa || null,
  });

  try { invalidateEmpresaCache(slugNorm); } catch (e) {}
  res.status(201).json(filial);
});

exports.aprovarFilial = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'ID inválido' });
  }

  const filial = await sql.buscarEmpresa(id);
  if (!filial) {
    return res.status(404).json({ error: 'Filial não encontrada' });
  }
  if (filial.empresaTipo !== 'filial') {
    return res.status(400).json({ error: 'Empresa não é filial' });
  }
  if (filial.status === 'active') {
    return res.status(400).json({ error: 'Filial já está ativa' });
  }

  const atualizada = await sql.aprovarFilial(id);
  try { invalidateEmpresaCache(filial.slug); } catch (e) {}
  res.json(atualizada);
});

exports.deletarFilial = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'ID inválido' });
  }

  const filial = await sql.buscarEmpresa(id);
  if (!filial) {
    return res.status(404).json({ error: 'Filial não encontrada' });
  }
  if (filial.empresaTipo !== 'filial') {
    return res.status(400).json({ error: 'Empresa não é filial' });
  }

  // Admin: can only delete own filiais
  if (req.user.role === 'admin' && filial.parentEmpresaId !== req.user.empresaId) {
    return res.status(403).json({ error: 'Acesso negado' });
  }

  await sql.softDeleteEmpresa(id);
  try { invalidateEmpresaCache(filial.slug); } catch (e) {}
  res.json({ success: true, message: 'Filial removida (soft delete)' });
});

exports.listarFiliaisPendentes = asyncHandler(async (req, res) => {
  const filiais = await sql.listarFiliaisPendentes();
  res.json(filiais);
});

exports.listarFiliais = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'ID inválido' });
  }

  // Se admin, só pode ver suas próprias filiais
  if (req.user.role === 'admin' && req.user.empresaId !== id) {
    return res.status(403).json({ error: 'Acesso negado' });
  }

  const filiais = await sql.listarFiliais(id);
  res.json(filiais);
});

exports.atualizarParent = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const { parentEmpresaId } = req.body;

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'ID inválido' });
  }

  const empresa = await sql.buscarEmpresa(id);
  if (!empresa) {
    return res.status(404).json({ error: 'Empresa não encontrada' });
  }

  // Admin: can only update own filiais
  if (req.user.role === 'admin' && empresa.parentEmpresaId !== req.user.empresaId) {
    return res.status(403).json({ error: 'Acesso negado' });
  }

  // Verificar loop se definindo como filial
  if (parentEmpresaId) {
    const isLoop = await sql.verificarLoopFilial(id, parentEmpresaId);
    if (isLoop) {
      return res.status(400).json({ error: 'Loop de vínculo detectado' });
    }
  }

  const atualizada = await sql.atualizarParent(id, parentEmpresaId);
  try { invalidateEmpresaCache(empresa.slug); } catch (e) {}
  res.json(atualizada);
});

exports.enviarTemaPendente = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const { themeSettings } = req.body;

  const empresa = await sql.buscarEmpresa(id);
  if (!empresa) {
    return res.status(404).json({ error: 'Empresa não encontrada' });
  }

  // Só filial pode enviar tema pendente
  if (empresa.empresaTipo !== 'filial') {
    return res.status(400).json({ error: 'Só filiais podem enviar tema pendente' });
  }

  // Só pode enviar se tema atual está aprovado
  if (!empresa.themeApproved) {
    return res.status(400).json({ error: 'Tema já está pendente de aprovação' });
  }

  const prisma = require('../config/prisma.js');
  const atualizada = await prisma.empresa.update({
    where: { id },
    data: {
      pendingThemeSettings: themeSettings,
      themeApproved: false,
    },
  });

  res.json(atualizada);
});

exports.aprovarTema = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const { approve } = req.body;

  const empresa = await sql.buscarEmpresa(id);
  if (!empresa) {
    return res.status(404).json({ error: 'Empresa não encontrada' });
  }

  // Verificar se é filial
  if (empresa.empresaTipo !== 'filial') {
    return res.status(400).json({ error: 'Só filiais têm tema pendente' });
  }

  // Se admin, só pode aprovar suas próprias filiais
  if (req.user.role === 'admin' && req.user.empresaId !== empresa.parentEmpresaId) {
    return res.status(403).json({ error: 'Acesso negado' });
  }

  const prisma = require('../config/prisma.js');
  let updateData;
  if (approve) {
    updateData = {
      themeSettings: empresa.pendingThemeSettings,
      pendingThemeSettings: null,
      themeApproved: true,
    };
  } else {
    updateData = {
      pendingThemeSettings: null,
      themeApproved: true,
    };
  }

  const atualizada = await prisma.empresa.update({
    where: { id },
    data: updateData,
  });

  res.json(atualizada);
});
