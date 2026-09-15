// backend/src/routes/filialPricingRoutes.js (ESM — services/cron são ESM; vitest intercepta)
import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import prisma from '../config/prisma.js';
import * as pricingFilialConfigService from '../services/pricingFilialConfigService.js';
import * as filialBillingService from '../services/filialBillingService.js';

const router = Router();

// ---- Superadmin endpoints ----

router.get('/filial-pricing', authenticate, authorize('superadmin'), asyncHandler(async (req, res) => {
  const current = await pricingFilialConfigService.getCurrent();
  const pending = await pricingFilialConfigService.getPending();
  const history = await pricingFilialConfigService.getHistory();

  res.json({ current, pending, history });
}));

router.post('/filial-pricing', authenticate, authorize('superadmin'), asyncHandler(async (req, res) => {
  const { valorX, effectiveDate, termosTexto } = req.body;

  if (!valorX || !effectiveDate) {
    return res.status(400).json({ error: 'valorX e effectiveDate são obrigatórios' });
  }

  if (Number(valorX) <= 0) {
    return res.status(400).json({ error: 'valorX deve ser positivo' });
  }

  const existingPending = await pricingFilialConfigService.getPending();
  if (existingPending) {
    return res.status(409).json({ error: 'Já existe reajuste pendente' });
  }

  const current = await pricingFilialConfigService.getCurrent();
  if (current && Number(current.valorX) === Number(valorX)) {
    return res.status(400).json({ error: 'Y == X: valor deve ser diferente do vigente' });
  }

  const config = await pricingFilialConfigService.createConfig(
    Number(valorX),
    effectiveDate,
    req.user.id,
    termosTexto || null
  );

  // Notify matrizes (best effort)
  try {
    await pricingFilialConfigService.notificarMatrizesWhatsApp(config);
  } catch (e) {
    console.error('[Filial Pricing] Erro ao notificar matrizes:', e.message);
  }

  res.status(201).json(config);
}));

router.post('/filial-pricing/:id/cancel', authenticate, authorize('superadmin'), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'ID inválido' });
  }

  const config = await pricingFilialConfigService.cancelPending(id);
  res.json(config);
}));

// ---- Admin endpoints ----

router.get('/filial-pricing/status', authenticate, authorize('admin'), asyncHandler(async (req, res) => {
  const empresaId = req.user.empresaId;

  const needsConsent = await filialBillingService.needsConsent(empresaId);
  const current = await pricingFilialConfigService.getCurrent();
  const pending = await pricingFilialConfigService.getPending();
  const x = await filialBillingService.getFilialX();
  const base = await filialBillingService.getBaseMensalidade();
  const n = await filialBillingService.contarFiliaisAtivas(empresaId);
  const versaoAceita = await filialBillingService.getUltimaVersaoAceita(empresaId);

  let motivo = null;
  if (needsConsent) {
    motivo = pending ? 'aumento_pendente' : 'aumento_nao_aceito_pos_vigencia';
  }

  res.json({
    needsConsent,
    motivo,
    valorX: x ? Number(x) : null,
    valorY: pending ? Number(pending.valorX) : null,
    versaoVigente: pending ? pending.versao : (current ? current.versao : null),
    effectiveDate: pending ? pending.effectiveDate : null,
    baseMensalidade: Number(base),
    nFiliaisAtivas: n,
    mensalidadeAtual: Number(base) + (x ? Number(x) * n : 0),
    mensalidadeProjetado: pending ? Number(base) + (Number(pending.valorX) * n) : null,
    termosVersao: versaoAceita,
    termosTexto: pending ? pending.termosTexto : null
  });
}));

router.post('/filial-pricing/accept', authenticate, authorize('admin'), asyncHandler(async (req, res) => {
  const empresaId = req.user.empresaId;
  const pending = await pricingFilialConfigService.getPending();

  if (!pending) {
    return res.status(409).json({ error: 'Nenhum reajuste pendente' });
  }

  const base = await filialBillingService.getBaseMensalidade();
  const n = await filialBillingService.contarFiliaisAtivas(empresaId);

  await filialBillingService.registrarConsentimento(
    empresaId,
    'alteracao_preco_x',
    'accepted',
    req.user.id,
    {
      valorFilialX: Number(pending.valorX),
      valorMensalidade: Number(base),
      termosVersao: pending.versao,
      termosTexto: pending.termosTexto, // Snapshot do texto customizado do superadmin
      nFiliaisSnapshot: n,
      valorTotalProjetado: Number(base) + (Number(pending.valorX) * n),
      pricingFilialConfigId: pending.id,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      requestId: req.context?.requestId
    }
  );

  // Reactivate suspended filiais for this matriz
  await prisma.empresa.updateMany({
    where: {
      parentEmpresaId: empresaId,
      status: 'suspended',
      suspendedByPricingVersion: pending.versao
    },
    data: {
      status: 'active',
      statusReason: null,
      suspendedAt: null,
      suspendedByPricingVersion: null
    }
  });

  // Recalculate billing
  await filialBillingService.recalcularValorMatriz(empresaId);

  res.json({ success: true });
}));

router.post('/filial-pricing/reject', authenticate, authorize('admin'), asyncHandler(async (req, res) => {
  const empresaId = req.user.empresaId;
  const pending = await pricingFilialConfigService.getPending();

  if (!pending) {
    return res.status(409).json({ error: 'Nenhum reajuste pendente' });
  }

  const base = await filialBillingService.getBaseMensalidade();
  const n = await filialBillingService.contarFiliaisAtivas(empresaId);

  await filialBillingService.registrarConsentimento(
    empresaId,
    'alteracao_preco_x',
    'rejected',
    req.user.id,
    {
      valorFilialX: Number(pending.valorX),
      valorMensalidade: Number(base),
      termosVersao: pending.versao,
      termosTexto: pending.termosTexto, // Snapshot do texto customizado do superadmin
      nFiliaisSnapshot: n,
      valorTotalProjetado: Number(base) + (Number(pending.valorX) * n),
      pricingFilialConfigId: pending.id,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      requestId: req.context?.requestId
    }
  );

  res.json({ success: true });
}));

// ── Test helper: reset consents + pending configs ────────────────
router.post('/filial-pricing/test-reset', authenticate, authorize('superadmin'), asyncHandler(async (req, res) => {
  const prisma = (await import('../config/prisma.js')).default;
  await prisma.termoConsent.deleteMany({});
  await prisma.pricingFilialConfig.updateMany({ where: { status: 'PENDING' }, data: { status: 'CANCELLED', cancelledAt: new Date() } });
  res.json({ success: true });
}));

export default router;