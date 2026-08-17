const app = require('./src/app');
const config = require('./src/config/env');
const logger = require('./src/config/logger');

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
