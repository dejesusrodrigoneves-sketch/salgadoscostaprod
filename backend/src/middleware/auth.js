const tokenService = require('../services/tokenService');
const auditService = require('../services/auditService');
const sql = require('../repositories/sqlRepository');

async function authenticate(req, res, next) {
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
    if (!decoded.id) {
      return res.status(401).json({ error: 'Token inválido' });
    }

    // Superadmin com empresaId null: acesso global
    if (decoded.role === 'superadmin' && decoded.empresaId === null) {
      req.user = decoded;
      return next();
    }

    // Admin/user: empresaId deve existir
    if (!decoded.empresaId || decoded.empresaId < 1) {
      return res.status(401).json({ error: 'Token inválido' });
    }

    // Se resolveEmpresa resolveu empresa, valida match (previne cross-tenant token)
    if (req.ctx?.empresaId && decoded.empresaId !== req.ctx.empresaId) {
      return res.status(403).json({ error: 'Acesso negado: empresa não corresponde' });
    }

    req.user = decoded;

    // Verificar se empresa está deletada
    if (decoded.empresaId) {
      const empresa = await sql.buscarEmpresa(decoded.empresaId);
      if (empresa && empresa.deletedAt) {
        return res.status(403).json({ error: 'Empresa inativa' });
      }
    }

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
