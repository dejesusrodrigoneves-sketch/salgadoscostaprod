const logger = require('../config/logger');

function errorHandler(err, req, res, _next) {
  const requestId = req.context?.requestId || 'no-request';
  const loggerCtx = { requestId, usuarioId: req.user?.id || req.cliente?.id || null };
  logger.error(`[requestId=${requestId}]`, err.stack || err.message, loggerCtx);
  const status = err.status || err.http || 500;
  const cryptoLeak = ['CryptoIntegrityError', 'CryptoConfigError', 'CryptoUnavailableError'].includes(err.name);
  if (status === 503 && !res.getHeader('Retry-After')) res.set('Retry-After', '60');
  res.status(status).json({
    error: cryptoLeak
      ? (status === 503 ? 'Serviço temporariamente indisponível' : 'Erro interno do servidor')
      : (err.message || 'Erro interno do servidor'),
    ...(err.code && { code: err.code }),
    ...((status >= 500) && process.env.NODE_ENV !== 'production' && { requestId }),
  });
}

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

module.exports = { errorHandler, asyncHandler };
