const app = require('./src/app');
const config = require('./src/config/env');
const logger = require('./src/config/logger');

let pixJob, settlementJob, filialBillingWorker;

app.listen(config.port, async () => {
  logger.info(`Servidor iniciado na porta ${config.port}`);

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

  // Audit cleanup: purge client logs + enforce 90-day retention
  try {
    const { deleteClienteLogs, deleteOldLogs } = require('./src/repositories/auditRepository');
    const deletedClientes = await deleteClienteLogs();
    const deletedOld = await deleteOldLogs(90);
    if (deletedClientes > 0) logger.info(`Audit cleanup: ${deletedClientes} logs de clientes removidos`);
    if (deletedOld > 0) logger.info(`Audit cleanup: ${deletedOld} logs com 90+ dias removidos`);
    if (deletedClientes === 0 && deletedOld === 0) logger.info('Audit cleanup: nenhum log para remover');
  } catch (err) {
    logger.error('Audit cleanup falhou:', err.message);
  }
});

// Graceful shutdown
async function shutdown(signal) {
  logger.info(`${signal} recebido. Encerrando jobs...`);
  try { if (pixJob) pixJob.stop(); } catch {}
  try { if (settlementJob) settlementJob.stop(); } catch {}
  try { if (filialBillingWorker && filialBillingWorker.stop) filialBillingWorker.stop(); } catch {}
  try { if (filialBillingWorker && filialBillingWorker.stopBillingWorker) filialBillingWorker.stopBillingWorker(); } catch {}

  try {
    const prisma = require('./src/config/prisma');
    await prisma.$disconnect();
    logger.info('Prisma desconectado');
  } catch {}

  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
