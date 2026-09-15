// backend/src/services/filialBillingService.js (ESM)
import prisma from '../config/prisma.js';
import sql from '../repositories/sqlRepository.js';

const DEFAULT_BASE_MENSALIDADE = 100;

function erro409Consentimento() {
  const err = new Error('Aceite os termos de reajuste antes de continuar.');
  err.status = 409;
  err.code = 'TERMOS_NAO_ACEITOS';
  return err;
}

export async function getFilialX() {
  const config = await prisma.pricingFilialConfig.findFirst({
    where: { status: 'ACTIVE' },
    orderBy: { versao: 'desc' }
  });
  return config ? Number(config.valorX) : null;
}

export async function getBaseMensalidade() {
  const config = await prisma.pricingConfig.findFirst({
    where: { status: 'ACTIVE' },
    orderBy: { createdAt: 'desc' }
  });
  return config ? Number(config.value) : DEFAULT_BASE_MENSALIDADE;
}

export async function contarFiliaisAtivas(matrizId) {
  const count = await prisma.empresa.count({
    where: {
      parentEmpresaId: matrizId,
      status: 'active',
      deletedAt: null
    }
  });
  return count;
}

export async function contarFiliaisSuspensas(matrizId) {
  const count = await prisma.empresa.count({
    where: {
      parentEmpresaId: matrizId,
      status: 'suspended',
      deletedAt: null
    }
  });
  return count;
}

export async function getVersaoAtiva() {
  return prisma.pricingFilialConfig.findFirst({
    where: { status: 'ACTIVE' },
    orderBy: { versao: 'desc' }
  });
}

export async function recalcularValorMatriz(matrizId) {
  const x = await getFilialX();
  const base = await getBaseMensalidade();
  const n = await contarFiliaisAtivas(matrizId);

  const valorTotal = x ? base + (Number(x) * n) : base;

  await prisma.subscription.update({
    where: { empresaId: matrizId },
    data: { value: valorTotal }
  });

  return { valorBase: base, valorPorFilial: x ? Number(x) : 0, nFiliaisAtivas: n, valorTotal };
}

// Snapshot imutável do cálculo (spec §17/§18). Recebe valor explícito — NUNCA
// re-consultar ACTIVE aqui, senão processa versão errada (spec §17.1).
export async function calculateBillingSnapshot(empresaId, { valorPorFilial, pricingVersion }) {
  const base = await getBaseMensalidade();
  const n = await contarFiliaisAtivas(empresaId);
  const valorBase = Number(base);
  const valorFilial = Number(valorPorFilial);
  const valorTotal = valorBase + (valorFilial * n);

  return {
    empresaId,
    pricingVersion,
    valorBase,
    valorPorFilial: valorFilial,
    nFiliaisAtivas: n,
    valorTotal,
    effectiveDate: new Date(),
    generatedAt: new Date()
  };
}

export async function getVersaoVigente() {
  const config = await prisma.pricingFilialConfig.findFirst({
    where: { status: { in: ['PENDING', 'ACTIVE'] } },
    orderBy: { versao: 'desc' }
  });
  return config ? config.versao : null;
}

export async function getUltimaVersaoAceita(empresaId) {
  const consent = await prisma.termoConsent.findFirst({
    where: {
      empresaId,
      tipo: 'alteracao_preco_x',
      status: 'accepted'
    },
    orderBy: { termosVersao: 'desc' }
  });
  return consent ? consent.termosVersao : null;
}

export async function needsConsent(empresaId) {
  const empresa = await prisma.empresa.findUnique({ where: { id: empresaId } });
  if (!empresa || empresa.parentEmpresaId !== null) return false;

  const n = await contarFiliaisAtivas(empresaId);
  const nSuspensas = await contarFiliaisSuspensas(empresaId);
  if (n === 0 && nSuspensas === 0) return false;

  const versaoVigente = await getVersaoVigente();
  if (!versaoVigente) return false;

  const versaoAceita = await getUltimaVersaoAceita(empresaId);
  if (versaoAceita === null) return versaoVigente > 1; // Grandfather v1: no consent needed
  if (versaoAceita >= versaoVigente) return false;

  const pendingConfig = await prisma.pricingFilialConfig.findFirst({
    where: { status: 'PENDING' },
    orderBy: { versao: 'desc' }
  });

  // CASO 1: PENDING com Y > X → overlay antes da vigência
  if (pendingConfig) {
    const x = await getFilialX();
    if (!x) return false;
    if (Number(pendingConfig.valorX) <= x) return false; // Redução: não exige consentimento
    return true;
  }

  // CASO 2: Pós-vigência, sem PENDING, filiais suspended, versão não aceita
  // Matriz que rejeitou/silenciou → overlay permanece pra permitir reaceite
  if (nSuspensas > 0) {
    const versaoAtiva = await getVersaoAtiva();
    if (versaoAtiva && versaoAceita < versaoAtiva.versao) return true;
  }

  return false;
}

export async function registrarConsentimento(empresaId, tipo, status, usuarioId, {
  valorFilialX,
  valorMensalidade,
  termosVersao,
  termosTexto,
  filialId,
  pricingFilialConfigId,
  nFiliaisSnapshot,
  valorTotalProjetado,
  ip,
  userAgent,
  requestId
}) {
  return prisma.termoConsent.create({
    data: {
      empresaId,
      filialId: filialId || null,
      pricingFilialConfigId: pricingFilialConfigId || null,
      tipo,
      valorFilialX: valorFilialX || null,
      valorMensalidade: valorMensalidade || null,
      nFiliaisSnapshot: nFiliaisSnapshot || null,
      valorTotalProjetado: valorTotalProjetado || null,
      status,
      termosVersao: termosVersao || null,
      termosTexto: termosTexto || null,
      usuarioId: usuarioId || null,
      ip: ip || null,
      userAgent: userAgent || null,
      requestId: requestId || null,
      agreedAt: new Date()
    }
  });
}

// M6: Criação/desvinculação com consentimento (spec §19/§20).
// Encapsula o fluxo real existente — NÃO duplica slug/status/tema.
// `sql.criarFilial`/`sql.atualizarParent` continuam responsáveis por esses campos.

export async function criarFilialComConsentimento(parentEmpresaId, dados, contexto = {}) {
  if (await needsConsent(parentEmpresaId)) {
    throw erro409Consentimento();
  }

  const filial = await sql.criarFilial(dados);

  await registrarConsentimento(parentEmpresaId, 'criacao_filial', 'accepted', contexto.usuarioId, {
    filialId: filial.id,
    ip: contexto.ip,
    userAgent: contexto.userAgent,
    requestId: contexto.requestId
  });

  return filial;
}

export async function desvincularComConsentimento(filialId, usuarioId, contexto = {}) {
  const empresa = await sql.buscarEmpresa(filialId);
  if (!empresa) {
    const e = new Error('Empresa não encontrada');
    e.status = 404;
    throw e;
  }

  const matrizId = empresa.parentEmpresaId;
  if (matrizId && await needsConsent(matrizId)) {
    throw erro409Consentimento();
  }

  const atualizada = await sql.atualizarParent(filialId, null);

  if (matrizId) {
    await registrarConsentimento(matrizId, 'desvinculacao_filial', 'accepted', usuarioId, {
      filialId,
      ip: contexto.ip,
      userAgent: contexto.userAgent,
      requestId: contexto.requestId
    });
  }

  return atualizada;
}