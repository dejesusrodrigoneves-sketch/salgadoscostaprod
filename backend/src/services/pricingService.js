// backend/src/services/pricingService.js (ESM)
import prisma from '../config/prisma.js';
import { enviarWhatsAppLote } from './whatsappNotifyService.js';

export async function createPricingConfig(value, effectiveDate) {
  return prisma.pricingConfig.create({
    data: {
      value,
      effectiveDate: new Date(effectiveDate),
      status: 'PENDING'
    }
  });
}

export async function getCurrentPricing() {
  return prisma.pricingConfig.findFirst({
    where: { status: 'ACTIVE' },
    orderBy: { createdAt: 'desc' }
  });
}

export async function getPricingHistory() {
  return prisma.pricingConfig.findMany({
    orderBy: { createdAt: 'desc' }
  });
}

export async function notifyPriceChange(pricingConfig) {
  const empresas = await prisma.empresa.findMany({
    where: { deletedAt: null },
    select: { telefone: true, whatsappNumber: true, nome: true }
  });
  
  const telefones = empresas
    .map(e => e.whatsappNumber || e.telefone)
    .filter(Boolean);
  
  const effectiveDate = new Date(pricingConfig.effectiveDate).toLocaleDateString('pt-BR');
  const message = `Olá! Informamos que haverá alteração no valor da mensalidade do sistema. A partir de ${effectiveDate}, o valor será R$ ${pricingConfig.value}. Qualquer dúvida, entre em contato.`;
  
  const enviados = await enviarWhatsAppLote(telefones, message, 4000, 5);
  
  await prisma.pricingConfig.update({
    where: { id: pricingConfig.id },
    data: { notifiedAt: new Date() }
  });
  
  return { total: telefones.length, enviados };
}

export async function applyPricing(pricingConfigId) {
  const config = await prisma.pricingConfig.findUnique({
    where: { id: pricingConfigId }
  });
  
  if (!config || config.status !== 'PENDING') return null;
  
  // Update all subscriptions
  await prisma.subscription.updateMany({
    where: { status: { in: ['ACTIVE', 'TRIAL'] } },
    data: { value: config.value }
  });
  
  // Mark config as active
  await prisma.pricingConfig.update({
    where: { id: pricingConfigId },
    data: { status: 'ACTIVE' }
  });
  
  // Mark previous configs as expired
  await prisma.pricingConfig.updateMany({
    where: {
      id: { not: pricingConfigId },
      status: 'ACTIVE'
    },
    data: { status: 'EXPIRED' }
  });
  
  return config;
}
