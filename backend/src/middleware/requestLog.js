// backend/src/middleware/requestLog.js
const logger = require('../config/logger');

function requestLog(req, res, next) {
  res.on('finish', () => {
    const durationMs = req.context?.startedAt ? Date.now() - req.context.startedAt : null;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    logger[level](`${req.method} ${req.originalUrl} ${res.statusCode} ${durationMs}ms`, {
      requestId: req.context?.requestId,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs,
      empresaId: req.ctx?.empresaId || req.user?.empresaId || null,
      userId: req.user?.id || null,
    });
  });
  next();
}

module.exports = { requestLog };
