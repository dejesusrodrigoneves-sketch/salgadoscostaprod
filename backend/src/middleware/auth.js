const tokenService = require('../services/tokenService');
const auditService = require('../services/auditService');
const sql = require('../repositories/sqlRepository');

// empresaCache — CJS module, requires prisma
const empresaCache = require('../config/empresaCache.js');

// JWT decode cache — avoids repeated verify for same token within TTL
const TOKEN_CACHE_TTL = 60 * 1000; // 1 minute
const tokenDecodeCache = new Map();

function cachedVerify(token) {
  const entry = tokenDecodeCache.get(token);
  if (entry && Date.now() - entry.ts < TOKEN_CACHE_TTL) {
    return entry.decoded;
  }
  const decoded = tokenService.verificarToken(token);
  // Evict if cache grows too large (>500 entries)
  if (tokenDecodeCache.size > 500) {
    tokenDecodeCache.clear();
  }
  tokenDecodeCache.set(token, { decoded, ts: Date.now() });
  return decoded;
}

async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token não fornecido' });
  }
  try {
    const token = authHeader.split(' ')[1];
    const decoded = cachedVerify(token);
    if (!decoded.role || !['superadmin', 'admin', 'user', 'entregador'].includes(decoded.role)) {
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
    if (req.ctx?.empresaId && Number(decoded.empresaId) !== Number(req.ctx.empresaId)) {
      auditService.audit({
        requestId: req.context?.requestId,
        ip: req.context?.ip,
        userAgent: req.context?.userAgent,
        action: 'auth.cross_tenant_denied',
        module: 'auth',
        actorType: 'admin',
        actorId: Number(decoded.id),
        actorUsername: decoded.username,
        actorRole: decoded.role,
        targetType: 'empresa',
        targetId: String(req.ctx.empresaId),
        severity: 'warning',
        metadata: { jwtEmpresaId: decoded.empresaId, ctxEmpresaId: req.ctx.empresaId },
      });
      return res.status(403).json({ error: 'Acesso negado: empresa não corresponde' });
    }

    req.user = decoded;

    // Verificar se empresa está ativa (usando regra central)
    if (decoded.empresaId) {
      const empresa = await empresaCache.getEmpresaFromIdCache(decoded.empresaId);
      if (empresa && !empresaCache.isEmpresaDisponivel(empresa)) {
        return res.status(403).json({ error: 'Empresa inativa' });
      }
    }

    // Suspensão de filial por pendência de aceite de reajuste
    const { filialSuspendedCheck } = require('./filialSuspended.js');
    await filialSuspendedCheck(req, res, next);
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
