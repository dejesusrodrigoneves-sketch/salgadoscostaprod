const logger = require('../config/logger');

function errorHandler(err, req, res, _next) {
  const requestId = req.context?.requestId || 'no-request';
  const loggerCtx = { requestId, usuarioId: req.user?.id || req.cliente?.id || null };
  logger.error(`[requestId=${requestId}]`, err.stack || err.message, loggerCtx);
  const status = err.status || 500;
  res.status(status).json({
    error: err.message || 'Erro interno do servidor',
    ...(status === 500 && { requestId }),
  });
}

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

module.exports = { errorHandler, asyncHandler };
