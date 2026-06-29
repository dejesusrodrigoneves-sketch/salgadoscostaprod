const app = require('./src/app');
const config = require('./src/config/env');
const logger = require('./src/config/logger');

app.listen(config.port, () => {
  logger.info(`Servidor iniciado na porta ${config.port}`);
});
