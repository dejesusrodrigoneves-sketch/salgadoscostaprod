// backend/src/cron/subscriptionCron.js (ESM)
import prisma from '../config/prisma.js';
import { enviarWhatsApp, getEmpresaWhatsApp } from '../services/whatsappNotifyService.js';

const NOTIFICATION_TYPES = {
  '7_before': '7d_antes',
  '4_before': '4d_antes',
  '0_due': 'vencimento',
  '3_after': '3d_apos',
  '5_after': '5d_apos',
  '7_after': '7d_apos',
  '9_after': '9d_apos',
  '10_after': '10d_apos'
};

const MESSAGES = {
  '7_before': (nome) => `Olá ${nome}! Faltam 7 dias para vencimento da sua assinatura. Mantenha seu pagamento em dia.`,
  '4_before': (nome) => `Olá ${nome}! Faltam 4 dias para vencimento da sua assinatura. Não esqueça de regularizar.`,
  '0_due': (nome) => `Olá ${nome}! Sua assinatura vence hoje. O não pagamento acarretará juros de 0,02% ao dia.`,
  '3_after': (nome) => `Olá ${nome}! Sua assinatura está com 3 dias de atraso. Regularize para evitar juros.`,
  '5_after': (nome) => `Olá ${nome}! Sua assinatura está com 5 dias de atraso. Acesso será limitado a leitura.`,
  '7_after': (nome) => `Olá ${nome}! Sua assinatura está com 7 dias de atraso. Acesso foi restringido.`,
  '9_after': (nome) => `Olá ${nome}! Sua assinatura está com 9 dias de atraso. Último aviso antes do bloqueio.`,
  '10_after': (nome) => `Olá ${nome}! Sua assinatura está com 10 dias de atraso. Acesso foi bloqueado. Regularize para reativar.`
};

export async function runSubscriptionCron() {
  console.log('[Subscription Cron] Iniciando verificação...');
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Find subscriptions that need notifications
  const subscriptions = await prisma.subscription.findMany({
    where: {
      status: { in: ['ACTIVE', 'PAST_DUE'] },
      nextDueDate: { not: null }
    },
    include: { empresa: true }
  });
  
  let notificationsSent = 0;
  
  for (const sub of subscriptions) {
    const phone = await getEmpresaWhatsApp(sub.empresaId);
    if (!phone) continue;
    
    const dueDate = new Date(sub.nextDueDate);
    dueDate.setHours(0, 0, 0, 0);
    
    const diffDays = Math.floor((dueDate - today) / (1000 * 60 * 60 * 24));
    
    // Check if should notify
    let notificationDay = null;
    if (diffDays === 7) notificationDay = '7_before';
    else if (diffDays === 4) notificationDay = '4_before';
    else if (diffDays === 0) notificationDay = '0_due';
    else if (diffDays === -3) notificationDay = '3_after';
    else if (diffDays === -5) notificationDay = '5_after';
    else if (diffDays === -7) notificationDay = '7_after';
    else if (diffDays === -9) notificationDay = '9_after';
    else if (diffDays === -10) notificationDay = '10_after';
    
    if (notificationDay === null) continue;
    
    // Check if already notified today
    const alreadyNotified = await prisma.subscriptionNotification.findFirst({
      where: {
        empresaId: sub.empresaId,
        tipo: NOTIFICATION_TYPES[notificationDay],
        sentAt: {
          gte: new Date(today.toISOString().split('T')[0])
        }
      }
    });
    
    if (alreadyNotified) continue;
    
    // Check if paid after last notification
    if (sub.lastPaymentAt && sub.lastPaymentAt > sub.nextDueDate) continue;
    
    // Send notification
    const message = MESSAGES[notificationDay](sub.empresa.nome);
    const sent = await enviarWhatsApp(phone, message);
    
    if (sent) {
      await prisma.subscriptionNotification.create({
        data: {
          empresaId: sub.empresaId,
          tipo: NOTIFICATION_TYPES[notificationDay]
        }
      });
      notificationsSent++;
    }
    
    // Update status to PAST_DUE if overdue
    if (diffDays < 0 && sub.status === 'ACTIVE') {
      await prisma.subscription.update({
        where: { id: sub.id },
        data: { status: 'PAST_DUE' }
      });
    }
    
    // Block after 10 days
    if (diffDays <= -10 && sub.status !== 'SUSPENDED') {
      await prisma.subscription.update({
        where: { id: sub.id },
        data: { status: 'SUSPENDED' }
      });
    }
  }
  
  console.log(`[Subscription Cron] ${notificationsSent} notificações enviadas`);
}

export async function runPricingCron() {
  console.log('[Pricing Cron] Verificando efetivação de preços...');
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const pendingConfigs = await prisma.pricingConfig.findMany({
    where: {
      status: 'PENDING',
      effectiveDate: { lte: today }
    }
  });
  
  for (const config of pendingConfigs) {
    // Update all subscriptions
    await prisma.subscription.updateMany({
      where: { status: { in: ['ACTIVE', 'TRIAL'] } },
      data: { value: config.value }
    });
    
    // Mark config as active
    await prisma.pricingConfig.update({
      where: { id: config.id },
      data: { status: 'ACTIVE' }
    });
    
    // Mark previous configs as expired
    await prisma.pricingConfig.updateMany({
      where: {
        id: { not: config.id },
        status: 'ACTIVE'
      },
      data: { status: 'EXPIRED' }
    });
    
    console.log(`[Pricing Cron] Preço atualizado para R$ ${config.value}`);
  }
}
