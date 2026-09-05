// backend/src/services/whatsappNotifyService.js (ESM)
import prisma from '../config/prisma.js';

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;

/**
 * Get platform support WhatsApp number from PlatformSettings.
 * Used as fallback on 404 page and for platform-level notifications.
 */
export async function getSupportWhatsApp() {
  const setting = await prisma.platformSettings.findUnique({
    where: { key: 'support_whatsapp' }
  });
  return setting?.value || null;
}

/**
 * Get empresa-specific WhatsApp number.
 * Falls back to PlatformSettings.support_whatsapp if empresa has none.
 */
export async function getEmpresaWhatsApp(empresaId) {
  const empresa = await prisma.empresa.findUnique({
    where: { id: empresaId },
    select: { telefone: true, whatsappNumber: true }
  });
  
  if (empresa?.whatsappNumber) return empresa.whatsappNumber;
  if (empresa?.telefone) return empresa.telefone;
  
  return getSupportWhatsApp();
}

export async function enviarWhatsApp(telefone, mensagem) {
  if (!telefone || !mensagem) return false;
  
  // Find active WhatsApp instance
  const instance = await prisma.whatsappInstance.findFirst({
    where: { connectionStatus: 'open' }
  });
  
  if (!instance) {
    console.warn('[WhatsApp] Nenhuma instância ativa encontrada');
    return false;
  }

  try {
    const cleanPhone = telefone.replace(/\D/g, '');
    const response = await fetch(`${EVOLUTION_API_URL}/message/sendText/${instance.instanceName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': EVOLUTION_API_KEY
      },
      body: JSON.stringify({
        number: cleanPhone,
        text: mensagem
      })
    });
    
    if (!response.ok) {
      console.error('[WhatsApp] Erro ao enviar:', response.status);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('[WhatsApp] Erro:', error.message);
    return false;
  }
}

export async function enviarWhatsAppLote(telefones, mensagem, delayMs = 4000, loteSize = 5) {
  let enviados = 0;
  
  for (let i = 0; i < telefones.length; i += loteSize) {
    const lote = telefones.slice(i, i + loteSize);
    
    await Promise.allSettled(
      lote.map(async (tel) => {
        const success = await enviarWhatsApp(tel, mensagem);
        if (success) enviados++;
      })
    );
    
    // Wait between batches
    if (i + loteSize < telefones.length) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  return enviados;
}
