import { getEmpresaFromCache, isEmpresaDisponivel } from '../config/empresaCache.js';

const IGNORED = ['www', 'api', 'admin', 'admin-sicia', 'login-sicia', 'mail', 'ftp'];

function hostOf(origin) {
  if (!origin) return null;
  try {
    const u = new URL(origin);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    return u.hostname.toLowerCase();
  } catch { return null; }
}

// extrai slug se host pertence ao domínio-base (com fronteira de domínio)
function slugForBase(host, base) {
  if (!host || !base) return null;
  const suffix = '.' + base.toLowerCase();
  if (!host.endsWith(suffix)) return null;
  const slug = host.slice(0, -suffix.length);
  if (!slug || slug.includes('.')) return null; // somente 1 label
  return slug.toLowerCase();
}

function trustedHost(host) {
  const list = (process.env.TRUSTED_HOSTS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  return list.includes(host);
}

async function aplicar(req, res, next, slug) {
  let empresa;
  try { empresa = await getEmpresaFromCache(slug); } catch (err) { return next(err); }
  if (!isEmpresaDisponivel(empresa)) return res.status(404).json({ error: 'Loja não encontrada' });
  req.ctx = req.ctx || {};
  req.ctx.empresaId = empresa.id;
  req.ctx.empresa = empresa;
  return next();
}

export async function resolveEmpresa(req, res, next) {
  const base = (process.env.CORS_BASE_DOMAIN || '').toLowerCase();
  const apiHost = (process.env.API_HOST || process.env.RAILWAY_PUBLIC_DOMAIN || '').toLowerCase();

  // 1) Origin canônico (frontend <loja>.<base>)
  const originSlug = slugForBase(hostOf(req.headers.origin), base);
  if (originSlug && !IGNORED.includes(originSlug)) return aplicar(req, res, next, originSlug);

  // 2) Host: somente se for host confiável e não for o host da API
  const host = (req.headers.host || '').split(':')[0].toLowerCase();
  if (host && host !== apiHost && trustedHost(host)) {
    const hostSlug = slugForBase(host, base);
    if (hostSlug && !IGNORED.includes(hostSlug)) return aplicar(req, res, next, hostSlug);
  }

  // 3) ?slug= somente em dev
  if (process.env.NODE_ENV !== 'production') {
    const p = req.query?.slug;
    if (p) return aplicar(req, res, next, String(p).trim().toLowerCase());
  }

  return next();
}

export default resolveEmpresa;
