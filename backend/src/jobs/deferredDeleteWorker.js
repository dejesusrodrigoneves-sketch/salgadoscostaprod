// backend/src/jobs/deferredDeleteWorker.js (CJS)
const cron = require('node-cron');

const BATCH_LIMIT = 50;

let cronTask = null;

function start() {
  cronTask = cron.schedule('0 3 * * *', async () => {
    console.log('[DEFERRED DELETE WORKER] Processando exclusões pendentes...');
    try {
      const result = await executarDeletes();
      console.log(`[DEFERRED DELETE WORKER] Concluído: ${result.processadas} ok, ${result.erros} erros`);
    } catch (err) {
      console.error('[DEFERRED DELETE WORKER] Erro fatal:', err.message);
    }
  });
  console.log('[DEFERRED DELETE WORKER] Cron job registrado (diário 03:00)');
}

function stop() {
  if (cronTask) {
    cronTask.stop();
    cronTask = null;
    console.log('[DEFERRED DELETE WORKER] Cron job parado');
  }
}

async function executarDeletes() {
  const { default: prisma } = await import('../config/prisma.js');
  const { default: auditService } = await import('../services/auditService.js');
  const { invalidateEmpresaCache } = require('../config/empresaCache');

  const now = new Date();
  let processadas = 0;
  let erros = 0;

  // Find filiais pending delete
  const filiais = await prisma.empresa.findMany({
    where: {
      pendingDeleteAt: { not: null },
      status: { not: 'deleted' },
      empresaTipo: 'filial'
    },
    include: { subscription: true },
    take: BATCH_LIMIT
  });

  console.log(`[DEFERRED DELETE WORKER] ${filiais.length} filiais pendentes encontradas`);

  for (const filial of filiais) {
    try {
      // Check if billing cycle has passed
      if (filial.subscription && filial.subscription.nextDueDate) {
        const nextDue = new Date(filial.subscription.nextDueDate);
        if (nextDue > now) {
          console.log(`[DEFERRED DELETE WORKER] Filial ${filial.id}: ciclo ainda não concluído (${nextDue.toISOString()})`);
          continue;
        }
      }

      // Execute soft delete
      await softDeleteFilial(filial.id, filial, prisma);

      // Audit trail
      auditService.audit({
        action: 'filial.deferred_delete.executed',
        module: 'deferred_delete_worker',
        targetType: 'empresa',
        targetId: filial.id,
        severity: 'info',
        reason: 'Exclusão diferida - ciclo de billing concluído',
        metadata: {
          parentEmpresaId: filial.parentEmpresaId,
          pendingDeleteAt: filial.pendingDeleteAt,
          nextDueDate: filial.subscription?.nextDueDate
        }
      });

      // Invalidate cache
      try { invalidateEmpresaCache(filial.slug); } catch (e) {}

      processadas++;
      console.log(`[DEFERRED DELETE WORKER] Filial ${filial.id} (${filial.slug}) excluída com sucesso`);

    } catch (err) {
      erros++;
      console.error(`[DEFERRED DELETE WORKER] Filial ${filial.id} erro: ${err.message}`);
    }
  }

  return { processadas, erros };
}

async function softDeleteFilial(id, filial, prisma) {
  await prisma.$transaction(async (tx) => {
    // 1. Unlink from parent + mark deleted
    await tx.empresa.update({
      where: { id },
      data: {
        parentEmpresaId: null,
        status: 'deleted',
        statusReason: 'deferred_delete',
        deletedAt: new Date()
      }
    });

    // 2. Clear sensitive fields
    await tx.empresa.update({
      where: { id },
      data: {
        telefone: null,
        whatsappNumber: null,
        cpfCnpj: null,
        pixKey: null,
        endereco: null,
        numero: null,
        bairro: null,
        cep: null,
        logo: null,
        capa: null
      }
    });

    // 3. Cancel subscription
    if (filial.subscription) {
      await tx.subscription.update({
        where: { empresaId: id },
        data: {
          status: 'CANCELLED',
          canceledAt: new Date()
        }
      });
    }

    // 4. Record consent for LGPD audit trail
    await tx.termoConsent.create({
      data: {
        empresaId: id,
        filialId: id,
        tipo: 'exclusao_deferred',
        status: 'executed',
        agreedAt: new Date()
      }
    });
  });
}

module.exports = { start, stop, executarDeletes, softDeleteFilial };
