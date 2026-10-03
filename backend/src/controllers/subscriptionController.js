// backend/src/controllers/subscriptionController.js (CJS)
const fs = require('node:fs');
const path = require('node:path');
const subscriptionService = require('../services/subscriptionService.js');
const subscriptionPaymentService = require('../services/subscriptionPaymentService.js');
const { buildSimplePdf } = require('../utils/simplePdf.js');
const prisma = require('../config/prisma.js');

async function getSubscriptionController(req, res) {
  try {
    const { empresaId } = req.params;
    const subscription = await subscriptionService.getSubscriptionByEmpresaId(parseInt(empresaId));
    if (!subscription) return res.status(404).json({ error: 'Assinatura não encontrada' });
    res.json(subscription);
  } catch (e) {
    console.error('Subscription get error:', e);
    res.status(500).json({ error: 'Erro ao buscar assinatura' });
  }
}

async function getMySubscriptionController(req, res) {
  try {
    const empresaId = req.user.empresaId || req.user.empresa?.id;
    if (!empresaId) return res.status(400).json({ error: 'Empresa não identificada' });

    const payment = await subscriptionPaymentService.getCurrentInvoice(empresaId);
    const subscription = await subscriptionService.getSubscriptionByEmpresaId(empresaId);

    return res.json({
      // campos legados (overlay existente)
      value: subscription ? Number(subscription.value) : null,
      daysOverdue: payment.daysOverdue ?? 0,
      interest: payment.interest ?? 0,
      totalDue: payment.totalDue ?? 0,
      accessLevel: payment.accessLevel ?? subscriptionService.getAccessLevel(subscription),
      // contrato novo (Pagamentos)
      aplicavel: payment.aplicavel,
      status: payment.status,
      mesRef: payment.mesRef ?? null,
      breakdown: payment.breakdown,
      dueDate: payment.dueDate ?? null,
      cycleOpenAt: payment.cycleOpenAt ?? null,
      canPay: payment.canPay,
      canPayReason: payment.canPayReason,
      hasInterest: Number(payment.daysOverdue) > 0,
      paidAt: payment.paidAt ?? null,
      receiptUrl: payment.receiptUrl ?? null,
    });
  } catch (e) {
    console.error('Subscription get error:', e);
    res.status(500).json({ error: 'Erro ao buscar assinatura' });
  }
}

async function createSubscriptionController(req, res) {
  try {
    const { empresaId } = req.params;
    const subscription = await subscriptionService.createTrialSubscription(parseInt(empresaId));
    res.status(201).json(subscription);
  } catch (e) {
    console.error('Subscription create error:', e);
    res.status(500).json({ error: 'Erro ao criar assinatura' });
  }
}

async function updateStatusController(req, res) {
  try {
    const { empresaId } = req.params;
    const { status } = req.body;
    const subscription = await subscriptionService.updateSubscriptionStatus(parseInt(empresaId), status);
    res.json(subscription);
  } catch (e) {
    console.error('Subscription update error:', e);
    res.status(500).json({ error: 'Erro ao atualizar assinatura' });
  }
}

async function payController(req, res) {
  try {
    const empresaId = req.user.empresaId || req.user.empresa?.id;
    if (!empresaId) return res.status(400).json({ error: 'Empresa não identificada' });

    // Guarda do ciclo (primeiro: responde 409 mesmo sem conta Asaas configurada)
    const invoice = await subscriptionPaymentService.getCurrentInvoice(empresaId);
    if (!invoice.canPay) {
      return res.status(409).json({
        error: 'pagamento_nao_liberado',
        reason: invoice.canPayReason,
        cycleOpenAt: invoice.cycleOpenAt,
      });
    }

    const empresa = await prisma.empresa.findUnique({
      where: { id: empresaId }
    });
    
    if (!empresa?.asaasSubcontaId) {
      return res.status(400).json({ error: 'Cliente Asaas não cadastrado' });
    }
    
    const subscription = await subscriptionService.getSubscriptionByEmpresaId(empresaId);
    if (!subscription) return res.status(404).json({ error: 'Assinatura não encontrada' });

    // Valores calculados no servidor (fatura do ciclo corrente)
    const totalDue = invoice.totalDue;
    const interest = invoice.interest;
    const daysOverdue = invoice.daysOverdue;
    
    // Criar pagamento PIX com valor fixo (valor + juros)
    const asaasClient = require('../services/asaasClient.js').default;
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 7);
    
    const pix = await asaasClient.criarPix({
      customerId: empresa.asaasSubcontaId,
      valor: totalDue,
      descricao: daysOverdue > 0 
        ? `Assinatura ${empresa.nome} (${daysOverdue} dias atraso + juros)`
        : `Assinatura ${empresa.nome}`,
      dueDate: dueDate.toISOString().slice(0, 10),
    });

    // Registra a fatura do ciclo com o PIX vinculado (extrato server-side)
    await subscriptionPaymentService.ensurePendingInvoice(empresaId, {
      mesRef: invoice.mesRef,
      dueDate: new Date(invoice.dueDate),
      base: invoice.breakdown.total,
      interest,
      total: totalDue,
      asaasPaymentId: pix.paymentId,
    });
    
    res.json({ 
      pixCode: pix.pixCode,
      pixQrCode: pix.pixQrCode,
      expiresAt: pix.expiresAt,
      mesRef: invoice.mesRef,
      value: invoice.breakdown.total,
      interest,
      totalDue,
      daysOverdue,
      message: daysOverdue > 0 
        ? `QR Code gerado com R$ ${totalDue.toFixed(2)} (valor + ${daysOverdue} dias de juros)`
        : 'QR Code PIX gerado',
    });
  } catch (e) {
    console.error('Subscription pay error:', e);
    res.status(500).json({ error: 'Erro ao gerar pagamento' });
  }
}

async function cancelController(req, res) {
  try {
    const empresaId = req.user.empresaId || req.user.empresa?.id;
    if (!empresaId) return res.status(400).json({ error: 'Empresa não identificada' });
    
    const subscription = await subscriptionService.cancelSubscription(empresaId);
    res.json({ message: 'Assinatura cancelada', subscription });
  } catch (e) {
    console.error('Subscription cancel error:', e);
    res.status(500).json({ error: 'Erro ao cancelar assinatura' });
  }
}

async function listAllSubscriptionsController(req, res) {
  try {
    const subscriptions = await require('../config/prisma.js').subscription.findMany({
      include: { empresa: { select: { id: true, nome: true, slug: true } } },
      orderBy: { createdAt: 'desc' }
    });
    res.json(subscriptions);
  } catch (e) {
    console.error('Subscription list error:', e);
    res.status(500).json({ error: 'Erro ao listar assinaturas' });
  }
}

async function listMyPaymentsController(req, res) {
  try {
    const empresaId = req.user.empresaId || req.user.empresa?.id;
    if (!empresaId) return res.status(400).json({ error: 'Empresa não identificada' });
    const invoice = await subscriptionPaymentService.getCurrentInvoice(empresaId);
    if (!invoice.aplicavel) return res.status(403).json({ error: 'nao_aplicavel' });
    const page = parseInt(req.query.page, 10) || 1;
    res.json(await subscriptionPaymentService.listPayments(empresaId, { page, mesRef: req.query.mesRef }));
  } catch (e) {
    console.error('Subscription payments error:', e);
    res.status(500).json({ error: 'Erro ao listar faturas' });
  }
}

async function receiptController(req, res) {
  try {
    const empresaId = req.user.empresaId || req.user.empresa?.id;
    if (!empresaId) return res.status(400).json({ error: 'Empresa não identificada' });

    const row = await subscriptionPaymentService.getOwnedPaidPayment(empresaId, req.params.id);
    if (!row) return res.status(404).json({ error: 'Comprovante indisponível' });

    const empresa = await prisma.empresa.findUnique({
      where: { id: empresaId }, select: { nome: true },
    });
    const brl = (v) => 'R$ ' + Number(v).toFixed(2).replace('.', ',');

    // Cache em receiptPath (spec §5.4): gera uma vez, reusa o arquivo
    let pdf;
    if (row.receiptPath && fs.existsSync(row.receiptPath)) {
      pdf = fs.readFileSync(row.receiptPath);
    } else {
      pdf = buildSimplePdf([
        'Comprovante de pagamento',
        `Loja: ${empresa?.nome || empresaId}`,
        `Fatura: ${row.mesRef}`,
        `Vencimento: ${row.dueDate.toISOString().slice(0, 10)}`,
        `Base: ${brl(row.base)}`,
        `Juros: ${brl(row.interest)}`,
        `Total: ${brl(row.total)}`,
        `Pago em: ${row.paidAt ? row.paidAt.toISOString().slice(0, 10) : '-'}`,
      ], { title: `Fatura ${row.mesRef}` });
      try {
        const dir = path.join(__dirname, '..', '..', 'uploads', 'receipts');
        fs.mkdirSync(dir, { recursive: true });
        const file = path.join(dir, `fatura-${row.id}.pdf`);
        fs.writeFileSync(file, pdf);
        await prisma.subscriptionPayment.update({ where: { id: row.id }, data: { receiptPath: file } });
      } catch (cacheErr) {
        console.error('Subscription receipt cache error:', cacheErr.message);
      }
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="fatura-${row.mesRef}.pdf"`);
    res.send(pdf);
  } catch (e) {
    console.error('Subscription receipt error:', e);
    res.status(500).json({ error: 'Erro ao gerar comprovante' });
  }
}

module.exports = {
  getSubscriptionController,
  getMySubscriptionController,
  createSubscriptionController,
  updateStatusController,
  payController,
  cancelController,
  listAllSubscriptionsController,
  listMyPaymentsController,
  receiptController
};
