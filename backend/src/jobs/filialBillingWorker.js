// backend/src/jobs/filialBillingWorker.js (CJS)
const cron = require('node-cron');

const MAX_ATTEMPTS = 5;
const BASE_RETRY_MS = 60_000; // 1 min

function backoffMs(attempts) {
  return BASE_RETRY_MS * Math.pow(2, attempts); // 1m, 2m, 4m, 8m, 16m
}

async function processarOperacoesPendentes() {
  const { default: prisma } = await import('../config/prisma.js');
  const { default: auditService } = await import('../services/auditService.js');
  const { updateSubscriptionValue } = await import('../services/subscriptionService.js');

  const now = new Date();
  const ops = await prisma.billingOperation.findMany({
    where: {
      status: { in: ['PENDING', 'RETRYING'] },
      OR: [
        { nextRetryAt: null },
        { nextRetryAt: { lte: now } }
      ]
    },
    include: { billingSnapshot: true },
    orderBy: { createdAt: 'asc' },
    take: 50
  });

  let processados = 0;
  let erros = 0;

  for (const op of ops) {
    try {
      // Idempotência: pular se snapshot não tem valor (never happens, guard)
      const valorTotal = op.billingSnapshot?.valorTotal;
      if (!valorTotal) throw new Error('billingSnapshot.valorTotal ausente');

      // Marcar PROCESSING
      await prisma.billingOperation.update({
        where: { id: op.id },
        data: { status: 'PROCESSING', lastAttemptAt: new Date() }
      });

      // Chamar Asaas + DB
      await updateSubscriptionValue(op.empresaId, valorTotal);

      // Sucesso
      await prisma.billingOperation.update({
        where: { id: op.id },
        data: { status: 'COMPLETED', errorCode: null, errorMessage: null }
      });
      processados++;

    } catch (err) {
      erros++;
      const attempts = op.attempts + 1;
      const permanente = attempts >= MAX_ATTEMPTS;

      await prisma.billingOperation.update({
        where: { id: op.id },
        data: permanente
          ? { status: 'FAILED', attempts, lastAttemptAt: new Date(), errorMessage: err.message, errorCode: 'MAX_RETRIES_EXCEEDED' }
          : { status: 'RETRYING', attempts, lastAttemptAt: new Date(), nextRetryAt: new Date(Date.now() + backoffMs(attempts)), errorMessage: err.message }
      });

      auditService.audit({
        action: permanente ? 'filial_billing.operation.failed' : 'filial_billing.operation.retry',
        module: 'filial_billing_worker',
        targetType: 'billing_operation',
        targetId: op.id,
        severity: permanente ? 'error' : 'warning',
        reason: err.message
      });
    }
  }

  if (ops.length > 0) {
    auditService.audit({
      action: 'filial_billing.worker_batch_complete',
      module: 'filial_billing_worker',
      severity: 'info',
      metadata: { processados, erros, total: ops.length }
    });
  }

  return { processados, erros };
}

let cronTask = null;

function start() {
  cronTask = cron.schedule('*/5 * * * *', async () => {
    console.log('[FILIAL BILLING WORKER] Processando outbox...');
    const result = await processarOperacoesPendentes();
    console.log(`[FILIAL BILLING WORKER] Concluido: ${result.processados} ok, ${result.erros} erros`);
  });

  console.log('[FILIAL BILLING WORKER] Cron job registrado (a cada 5 min)');
}

function stop() {
  if (cronTask) { cronTask.stop(); cronTask = null; console.log('[FILIAL BILLING WORKER] Cron job parado'); }
}

module.exports = { start, stop, processarOperacoesPendentes };