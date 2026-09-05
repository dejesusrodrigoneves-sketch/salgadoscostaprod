// backend/src/controllers/webhookAsaasController.js (CJS)
const subscriptionService = require('../services/subscriptionService.js');
const prisma = require('../config/prisma.js').default;
const logger = require('../config/logger');

async function webhookAsaasController(req, res) {
  try {
    const { event, payment } = req.body;
    
    logger.info('[Asaas Webhook] Evento recebido');
    
    if (event === 'PAYMENT_RECEIVED') {
      const subscription = await prisma.subscription.findFirst({
        where: { asaasSubscriptionId: payment.subscription }
      });
      
      if (subscription) {
        // Validar se o valor pago bate com o valor esperado (valor + juros)
        const valorPago = Number(payment.value);
        const daysOverdue = subscriptionService.getDaysOverdue(subscription.nextDueDate);
        const interest = subscriptionService.calculateInterest(subscription.value, daysOverdue);
        const valorEsperado = Number(subscription.value) + interest;
        
        if (Math.abs(valorPago - valorEsperado) > 0.01) {
          logger.info('[Asaas Webhook] Valor divergente');
          return res.status(200).json({ received: true, ignored: 'valor_divergente' });
        }
        
        await subscriptionService.processPayment(subscription.empresaId);
        logger.info('[Asaas Webhook] Pagamento processado');
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
        logger.info('[Asaas Webhook] Assinatura cancelada');
      }
    }
    
    res.status(200).json({ received: true });
  } catch (error) {
    logger.error('[Asaas Webhook] Erro:', error.message);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
}

module.exports = { webhookAsaasController };
