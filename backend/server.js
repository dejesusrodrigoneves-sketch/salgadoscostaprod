const app = require('./src/app');
const config = require('./src/config/env');
const logger = require('./src/config/logger');
const { validateAtBoot } = require('./src/config/cryptoKeys');
validateAtBoot();

let pixJob, settlementJob, filialBillingWorker, deferredDeleteWorker;

const server = app.listen(config.port, async () => {
  logger.info(`Servidor iniciado na porta ${config.port}`);

  // Connect Redis (fallback memória se indisponível)
  try {
    const { connectRedis } = require('./src/config/redis');
    await connectRedis();
  } catch (err) {
    logger.error('Redis connect falhou:', err.message);
  }

  // Ensure PIX/Asaas columns + tables (idempotent)
  try {
    const prisma = require('./src/config/prisma');
    const ensureColumns = require('./prisma/ensureColumns');
    await ensureColumns(prisma);
    logger.info('Schema ensure: colunas/tabelas PIX garantidas');
  } catch (err) {
    logger.error('Schema ensure falhou:', err.message);
  }

  // PIX expiration job: checks pending payments every 2 min
  try {
    const pixExpirationJob = require('./src/jobs/pixExpirationJob');
    pixExpirationJob.iniciarPixExpirationJob();
    pixJob = pixExpirationJob;
  } catch (err) {
    logger.error('PIX sync job falhou:', err.message);
  }

  // Weekly settlement job: processes all empresas every Saturday 00:00
  try {
    settlementJob = require('./src/jobs/weeklySettlement');
    settlementJob.start();
  } catch (err) {
    logger.error('Settlement job falhou:', err.message);
  }

  // Filial billing cron: applies pending filial pricing daily at 00:01
  try {
    const cron = require('node-cron');
    const cronTask = cron.schedule('1 0 * * *', async () => {
      try {
        const { runFilialBillingCron } = await import('./src/cron/filialBillingCron.js');
        await runFilialBillingCron();
      } catch (e) {
        logger.error('Filial billing cron falhou:', e.message);
      }
    });
    logger.info('Filial billing cron registrado (diário 00:01)');
    // Expose stop for shutdown
    filialBillingWorker = { stop: () => { cronTask.stop(); logger.info('Filial billing cron parado'); } };
  } catch (err) {
    logger.error('Filial billing cron falhou ao registrar:', err.message);
  }

  // Filial billing worker: processes BillingOperation outbox every 5 min (Asaas updates)
  try {
    const billingWorker = require('./src/jobs/filialBillingWorker');
    billingWorker.start();
    filialBillingWorker = filialBillingWorker || {};
    filialBillingWorker.stopBillingWorker = billingWorker.stop;
  } catch (err) {
    logger.error('Filial billing worker falhou ao registrar:', err.message);
  }

  // Deferred delete worker: processes pending filial deletes daily at 03:00
  try {
    deferredDeleteWorker = require('./src/jobs/deferredDeleteWorker');
    deferredDeleteWorker.start();
  } catch (err) {
    logger.error('Deferred delete worker falhou:', err.message);
  }

  // BullMQ workers (audit, whatsapp, fcm, webhook, financial-sync)
  try {
    const { startAllWorkers } = require('./src/workers/index');
    startAllWorkers();
  } catch (err) {
    logger.error('BullMQ workers falhou:', err.message);
  }

  // Audit cleanup: purge client logs + enforce 90-day retention + webhook event cleanup
  try {
    const { deleteClienteLogs, deleteOldLogs } = require('./src/repositories/auditRepository');
    const sql = require('./src/repositories/sqlRepository');
    const deletedClientes = await deleteClienteLogs();
    const deletedOld = await deleteOldLogs(90);
    const deletedWebhooks = await sql.cleanupOldWebhookEvents(7);
    if (deletedClientes > 0) logger.info(`Audit cleanup: ${deletedClientes} logs de clientes removidos`);
    if (deletedOld > 0) logger.info(`Audit cleanup: ${deletedOld} logs com 90+ dias removidos`);
    if (deletedWebhooks > 0) logger.info(`Audit cleanup: ${deletedWebhooks} webhook events com 7+ dias removidos`);
    if (deletedClientes === 0 && deletedOld === 0 && deletedWebhooks === 0) logger.info('Audit cleanup: nenhum registro para remover');
  } catch (err) {
    logger.error('Audit cleanup falhou:', err.message);
  }
});

// Graceful shutdown
let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`${signal} recebido. Iniciando shutdown graceful...`);

  // 1. parar de aceitar novas conexões + drenar in-flight
  server.close(() => logger.info('HTTP server fechado'));

  // 2. parar jobs/workers
  try { if (pixJob) pixJob.stop(); } catch {}
  try { if (settlementJob) settlementJob.stop(); } catch {}
  try { if (filialBillingWorker && filialBillingWorker.stop) filialBillingWorker.stop(); } catch {}
  try { if (filialBillingWorker && filialBillingWorker.stopBillingWorker) filialBillingWorker.stopBillingWorker(); } catch {}
  try { if (deferredDeleteWorker) deferredDeleteWorker.stop(); } catch {}
  try {
    const { stopAllWorkers } = require('./src/workers/index');
    await stopAllWorkers();
    logger.info('BullMQ workers parados');
  } catch {}
  try {
    const { closeQueues } = require('./src/queue/index');
    await closeQueues();
    logger.info('BullMQ queues fechadas');
  } catch {}

  // 3. flush audit queue (evita perda de logs)
  try {
    const { flushNow } = require('./src/services/auditQueue');
    await flushNow();
    logger.info('Audit queue flushed');
  } catch (e) { logger.error('Falha flush audit:', e.message); }

  // 4. fechar Prisma + Redis
  try {
    const prisma = require('./src/config/prisma');
    await prisma.$disconnect();
    logger.info('Prisma desconectado');
  } catch {}
  try {
    const { disconnectRedis } = require('./src/config/redis');
    await disconnectRedis();
    logger.info('Redis desconectado');
  } catch {}

  // 5. timeout de segurança (força saída se algo travar)
  setTimeout(() => process.exit(0), 10000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
