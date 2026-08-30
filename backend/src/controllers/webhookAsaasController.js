// backend/src/controllers/webhookAsaasController.js (CJS)
const subscriptionService = require('../services/subscriptionService.js');
const prisma = require('../config/prisma.js').default;

async function webhookAsaasController(req, res) {
  try {
    const { event, payment } = req.body;
    
    console.log('[Asaas Webhook] Evento recebido:', event);
    
    if (event === 'PAYMENT_RECEIVED') {
      const subscription = await prisma.subscription.findFirst({
        where: { asaasSubscriptionId: payment.subscription }
      });
      
      if (subscription) {
        await subscriptionService.processPayment(subscription.empresaId);
        console.log('[Asaas Webhook] Pagamento processado para empresa:', subscription.empresaId);
      }
    }
    
    if (event === 'SUBSCRIPTION_DELETED') {
      const subscription = await prisma.subscription.findFirst({
        where: { asaasSubscriptionId: req.body.subscription?.id }
      });
      
      if (subscription) {
        await prisma.subscription.update({
          where: { id: subscription.id },
          data: { status: 'CANCELED', canceledAt: new Date() }
        });
        console.log('[Asaas Webhook] Assinatura cancelada:', subscription.empresaId);
      }
    }
    
    res.status(200).json({ received: true });
  } catch (error) {
    console.error('[Asaas Webhook] Erro:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
}

module.exports = { webhookAsaasController };
