const { randomUUID } = require('crypto');

function getIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (fwd && typeof fwd === 'string') return fwd.split(',')[0].trim();
  return req.socket?.remoteAddress || null;
}

function getUserAgent(req) {
  return req.headers['user-agent'] || null;
}

function getActor(req) {
  if (req.user && req.user.id) {
    return {
      actorType: 'admin',
      actorId: Number(req.user.id),
      actorUsername: req.user.username,
      actorRole: req.user.role,
    };
  }
  if (req.cliente && req.cliente.id) {
    return {
      actorType: 'cliente',
      actorId: Number(req.cliente.id),
      actorUsername: req.cliente.telefone || req.cliente.nome || null,
      actorRole: null,
    };
  }
  return { actorType: 'anon', actorId: null, actorUsername: null, actorRole: null };
}

function contextMiddleware(req, res, next) {
  req.context = {
    requestId: randomUUID(),
    ip: getIp(req),
    userAgent: getUserAgent(req),
    method: req.method,
    path: req.originalUrl || req.url,
    startedAt: Date.now(),
  };
  req.actor = getActor(req);
  next();
}

function getCtx(req) {
  const actor = getActor(req);
  return {
    requestId: req.context?.requestId,
    ip: req.context?.ip,
    userAgent: req.context?.userAgent,
    path: req.context?.path,
    actorType: actor.actorType,
    actorId: actor.actorId,
    actorUsername: actor.actorUsername,
    actorRole: actor.actorRole,
    empresaId: req.ctx?.empresaId || req.user?.empresaId || null,
    role: req.user?.role || null,
  };
}

module.exports = contextMiddleware;
module.exports.getCtx = getCtx;
