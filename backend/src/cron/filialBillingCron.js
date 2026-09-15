// backend/src/cron/filialBillingCron.js (ESM)
import prisma from '../config/prisma.js';
import { calculateBillingSnapshot } from '../services/filialBillingService.js';
import { enviarWhatsAppLote } from '../services/whatsappNotifyService.js';

export async function runFilialBillingCron() {
  console.log('[Filial Billing Cron] Iniciando verificação...');

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const pendingConfigs = await prisma.pricingFilialConfig.findMany({
    where: {
      status: 'PENDING',
      effectiveDate: { lte: today }
    }
  });

  for (const config of pendingConfigs) {
    console.log(`[Filial Billing Cron] Processando versão ${config.versao}...`);

    // Find matrizes that need processing
    const matrizes = await prisma.empresa.findMany({
      where: {
        parentEmpresaId: null,
        status: 'active',
        deletedAt: null
      }
    });

    for (const matriz of matrizes) {
      // Idempotência: skip se já tem snapshot desta versão
      const existingSnapshot = await prisma.billingSnapshot.findUnique({
        where: {
          empresaId_pricingVersion: {
            empresaId: matriz.id,
            pricingVersion: config.versao
          }
        }
      });

      if (existingSnapshot) continue;

      // Check if matriz accepted the price adjustment
      const consent = await prisma.termoConsent.findFirst({
        where: {
          empresaId: matriz.id,
          tipo: 'alteracao_preco_x',
          status: 'accepted',
          termosVersao: config.versao
        }
      });

      // If increase and not accepted, suspend active filiais
      if (!consent) {
        const x = await prisma.pricingFilialConfig.findFirst({
          where: { status: 'ACTIVE' },
          orderBy: { versao: 'desc' }
        });

        if (x && Number(config.valorX) > Number(x.valorX)) {
          await prisma.empresa.updateMany({
            where: {
              parentEmpresaId: matriz.id,
              status: 'active',
              deletedAt: null
            },
            data: {
              status: 'suspended',
              statusReason: 'PRICE_ADJUSTMENT_REJECTED',
              suspendedAt: new Date(),
              suspendedByPricingVersion: config.versao
            }
          });

          // M11: Notificar matriz via WhatsApp quando filiais forem suspensas
          const matrizContato = await prisma.empresa.findUnique({
            where: { id: matriz.id },
            select: { telefone: true, whatsappNumber: true, nome: true }
          });
          const matrizTelefone = matrizContato?.whatsappNumber || matrizContato?.telefone;
          if (matrizTelefone) {
            await enviarWhatsAppLote(
              [matrizTelefone],
              'Uma ou mais filiais foram suspensas por pendência de aceite de reajuste. Acesse o painel para regularizar.',
              4000,
              5
            );
          }
        }
      }

      // Recalcular com Y explícito (não re-consultar ACTIVE — evita X obsoleto)
      const snapshotData = await calculateBillingSnapshot(matriz.id, {
        valorPorFilial: config.valorX,
        pricingVersion: config.versao
      });

      // Congelar cálculo + outbox — atomicamente (P2: vincular billingSnapshotId)
      await prisma.$transaction(async (tx) => {
        const created = await tx.billingSnapshot.create({ data: snapshotData });

        await tx.billingOperation.create({
          data: {
            empresaId: matriz.id,
            billingSnapshotId: created.id,
            status: 'PENDING',
            idempotencyKey: `filial-pricing-v${config.versao}-m${matriz.id}`,
            attempts: 0
          }
        });
      });
    }

    // Mark config as ACTIVE
    await prisma.pricingFilialConfig.update({
      where: { id: config.id },
      data: {
        status: 'ACTIVE',
        appliedAt: new Date()
      }
    });

    // Mark previous configs as EXPIRED
    await prisma.pricingFilialConfig.updateMany({
      where: {
        id: { not: config.id },
        status: 'ACTIVE'
      },
      data: { status: 'EXPIRED' }
    });

    console.log(`[Filial Billing Cron] Versão ${config.versao} aplicada com sucesso`);
  }

  console.log('[Filial Billing Cron] Verificação concluída');
}