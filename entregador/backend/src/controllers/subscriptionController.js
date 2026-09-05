// backend/src/controllers/subscriptionController.js (CJS)
const subscriptionService = require('../services/subscriptionService.js');

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
    
    const subscription = await subscriptionService.getSubscriptionByEmpresaId(empresaId);
    if (!subscription) return res.status(404).json({ error: 'Assinatura não encontrada' });
    
    const daysOverdue = subscriptionService.getDaysOverdue(subscription.nextDueDate);
    const interest = subscriptionService.calculateInterest(subscription.value, daysOverdue);
    const accessLevel = subscriptionService.getAccessLevel(subscription);
    
    res.json({
      ...subscription,
      daysOverdue,
      interest,
      accessLevel,
      totalDue: Number(subscription.value) + interest
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
    
    const empresa = await require('../config/prisma.js').default.empresa.findUnique({
      where: { id: empresaId }
    });
    
    if (!empresa?.asaasSubcontaId) {
      return res.status(400).json({ error: 'Cliente Asaas não cadastrado' });
    }
    
    const subscription = await subscriptionService.getSubscriptionByEmpresaId(empresaId);
    if (!subscription) return res.status(404).json({ error: 'Assinatura não encontrada' });
    
    // Calcular valor total com juros
    const daysOverdue = subscriptionService.getDaysOverdue(subscription.nextDueDate);
    const interest = subscriptionService.calculateInterest(subscription.value, daysOverdue);
    const totalDue = Number(subscription.value) + interest;
    
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
    
    res.json({ 
      pixCode: pix.pixCode,
      pixQrCode: pix.pixQrCode,
      expiresAt: pix.expiresAt,
      value: Number(subscription.value),
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
    const subscriptions = await require('../config/prisma.js').default.subscription.findMany({
      include: { empresa: { select: { id: true, nome: true, slug: true } } },
      orderBy: { createdAt: 'desc' }
    });
    res.json(subscriptions);
  } catch (e) {
    console.error('Subscription list error:', e);
    res.status(500).json({ error: 'Erro ao listar assinaturas' });
  }
}

module.exports = {
  getSubscriptionController,
  getMySubscriptionController,
  createSubscriptionController,
  updateStatusController,
  payController,
  cancelController,
  listAllSubscriptionsController
};
