// backend/src/services/pricingFilialConfigService.js (ESM)
import prisma from '../config/prisma.js';
import { enviarWhatsAppLote } from './whatsappNotifyService.js';

export async function createConfig(valorX, effectiveDate, createdById, termosTexto = null) {
  const lastConfig = await prisma.pricingFilialConfig.findFirst({
    orderBy: { versao: 'desc' }
  });

  const versao = lastConfig ? lastConfig.versao + 1 : 1;

  return prisma.pricingFilialConfig.create({
    data: {
      versao,
      valorX,
      effectiveDate: new Date(effectiveDate),
      status: 'PENDING',
      createdById,
      termosTexto: termosTexto || null
    }
  });
}

export async function getCurrent() {
  return prisma.pricingFilialConfig.findFirst({
    where: { status: 'ACTIVE' },
    orderBy: { versao: 'desc' }
  });
}

export async function getPending() {
  return prisma.pricingFilialConfig.findFirst({
    where: { status: 'PENDING' },
    orderBy: { versao: 'desc' }
  });
}

export async function cancelPending(id) {
  return prisma.pricingFilialConfig.update({
    where: { id },
    data: {
      status: 'CANCELLED',
      cancelledAt: new Date()
    }
  });
}

export async function getHistory() {
  return prisma.pricingFilialConfig.findMany({
    orderBy: { versao: 'desc' },
    take: 10
  });
}

export async function notificarMatrizesWhatsApp(config) {
  const matrizes = await prisma.empresa.findMany({
    where: {
      parentEmpresaId: null,
      status: 'active',
      deletedAt: null,
      filiais: {
        some: { status: 'active', deletedAt: null }
      }
    },
    select: { telefone: true, whatsappNumber: true, nome: true }
  });

  const telefones = matrizes
    .map(e => e.whatsappNumber || e.telefone)
    .filter(Boolean);

  const effectiveDate = new Date(config.effectiveDate).toLocaleDateString('pt-BR');

  // M7: Usar termosTexto customizado se informado; fallback para template genérico
  const consequencia = 'Se rejeitar ou não responder até a vigência, filiais ativas poderão ser suspensas; acesso ficará bloqueado; dados serão preservados; matriz continuará pagando apenas a Base.';

  let message;
  if (config.termosTexto) {
    message = `${config.termosTexto}\n\nVigência: ${effectiveDate}\n\n${consequencia}`;
  } else {
    message = `Olá! Há uma alteração importante no valor por filial. A partir de ${effectiveDate}, o valor será R$ ${config.valorX}. Consulte seu painel para mais detalhes.\n\n${consequencia}`;
  }

  const enviados = await enviarWhatsAppLote(telefones, message, 4000, 5);

  return { total: telefones.length, enviados };
}