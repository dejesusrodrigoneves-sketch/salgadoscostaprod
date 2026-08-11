const tokenService = require('../services/tokenService');
const auditService = require('../services/auditService');

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token não fornecido' });
  }
  try {
    const token = authHeader.split(' ')[1];
    const decoded = tokenService.verificarToken(token);
    if (!decoded.role || !['superadmin', 'admin', 'user'].includes(decoded.role)) {
      return res.status(401).json({ error: 'Token inválido' });
    }
    if (!decoded.empresaId || decoded.empresaId < 1) {
      return res.status(401).json({ error: 'Token inválido' });
    }
    if (!decoded.id) {
      return res.status(401).json({ error: 'Token inválido' });
    }
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido' });
  }
}

function authorize(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      auditService.audit({
        requestId: req.context?.requestId,
        ip: req.context?.ip,
        userAgent: req.context?.userAgent,
        action: 'auth.access_denied',
        module: 'auth',
        actorType: 'admin',
        actorId: Number(req.user.id),
        actorUsername: req.user.username,
        actorRole: req.user.role,
        targetType: 'rota',
        targetId: `${req.method} ${req.originalUrl || req.url}`,
        severity: 'warning',
        reason: `role_requerida_${roles.join('|')}`,
        metadata: { url: req.originalUrl || req.url },
      });
      return res.status(403).json({ error: 'Acesso negado' });
    }
    next();
  };
}

module.exports = { authenticate, authorize };
