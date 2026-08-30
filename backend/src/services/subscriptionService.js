// backend/src/services/subscriptionService.js (ESM)
import prisma from '../config/prisma.js';
import { enviarWhatsApp, getEmpresaWhatsApp } from './whatsappNotifyService.js';

const TRIAL_DAYS = 14;
const INTEREST_RATE_DAILY = 0.0002; // 0.02%
const READ_ONLY_AFTER_DAYS = 5;
const BLOCK_AFTER_DAYS = 10;

export async function createTrialSubscription(empresaId) {
  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + TRIAL_DAYS);
  
  return prisma.subscription.create({
    data: {
      empresaId,
      status: 'TRIAL',
      value: 100,
      billingType: 'PIX',
      nextDueDate: trialEndsAt,
      trialEndsAt
    }
  });
}

export async function getSubscriptionByEmpresaId(empresaId) {
  return prisma.subscription.findUnique({
    where: { empresaId }
  });
}

export async function updateSubscriptionStatus(empresaId, status) {
  return prisma.subscription.update({
    where: { empresaId },
    data: { status }
  });
}

export async function processPayment(empresaId) {
  const subscription = await getSubscriptionByEmpresaId(empresaId);
  if (!subscription) return null;
  
  const nextDueDate = new Date();
  nextDueDate.setDate(nextDueDate.getDate() + 30);
  
  const updated = await prisma.subscription.update({
    where: { empresaId },
    data: {
      status: 'ACTIVE',
      lastPaymentAt: new Date(),
      nextDueDate
    }
  });
  
  // Notify via WhatsApp
  const phone = await getEmpresaWhatsApp(empresaId);
  if (phone) {
    await enviarWhatsApp(
      phone,
      'Pagamento confirmado! Sua assinatura foi ativada. Próxima cobrança em 30 dias.'
    );
  }
  
  return updated;
}

export async function cancelSubscription(empresaId) {
  const subscription = await getSubscriptionByEmpresaId(empresaId);
  if (!subscription) return null;
  
  const updated = await prisma.subscription.update({
    where: { empresaId },
    data: {
      status: 'CANCELED',
      canceledAt: new Date()
    }
  });
  
  // Notify via WhatsApp
  const phone = await getEmpresaWhatsApp(empresaId);
  if (phone) {
    await enviarWhatsApp(
      phone,
      'Sua assinatura foi cancelada. O acesso será encerrado no final do período pago.'
    );
  }
  
  return updated;
}

export function calculateInterest(amount, daysOverdue) {
  return amount * INTEREST_RATE_DAILY * daysOverdue;
}

export function getDaysOverdue(nextDueDate) {
  if (!nextDueDate) return 0;
  const now = new Date();
  const due = new Date(nextDueDate);
  if (now <= due) return 0;
  return Math.floor((now - due) / (1000 * 60 * 60 * 24));
}

export function getAccessLevel(subscription) {
  if (!subscription) return 'BLOCKED';
  
  const daysOverdue = getDaysOverdue(subscription.nextDueDate);
  
  switch (subscription.status) {
    case 'TRIAL':
      return subscription.trialEndsAt && subscription.trialEndsAt > new Date() ? 'FULL' : 'BLOCKED';
    case 'ACTIVE':
      return 'FULL';
    case 'PAST_DUE':
      return daysOverdue >= READ_ONLY_AFTER_DAYS ? 'READ_ONLY' : 'FULL';
    case 'SUSPENDED':
      return 'BLOCKED';
    case 'CANCELED':
      return 'BLOCKED';
    default:
      return 'BLOCKED';
  }
}
