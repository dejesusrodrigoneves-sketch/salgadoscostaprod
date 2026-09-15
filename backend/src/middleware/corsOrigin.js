const empresaCache = require('../config/empresaCache.js');

function parse(origin) {
  if (!origin) return null;
  if (origin === 'null') return null;
  try {
    const u = new URL(origin);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    if (process.env.NODE_ENV === 'production' && u.protocol !== 'https:') return null;
    if (u.port && u.port !== '443' && u.port !== '80') return null;
    const host = u.hostname.toLowerCase();
    if (host.includes(':')) return null;
    return host;
  } catch { return null; }
}

// Origin completa normalizada: scheme://host[:port]
function normalizeOrigin(origin) {
  if (!origin) return null;
  if (origin === 'null') return null;
  try {
    const u = new URL(origin);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    if (process.env.NODE_ENV === 'production' && u.protocol !== 'https:') return null;
    const port = u.port ? ':' + u.port : '';
    return u.protocol + '//' + u.hostname.toLowerCase() + port;
  } catch { return null; }
}

function fixedOrigins() {
  return (process.env.CORS_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean)
    .map(normalizeOrigin).filter(Boolean);
}

async function corsOriginValidator(origin, callback) {
  if (!origin) return callback(null, true); // server-to-server/webhooks
  const norm = normalizeOrigin(origin);
  if (!norm) return callback(null, false);

  // 1) allowlist exata (scheme+host+porta)
  if (fixedOrigins().includes(norm)) return callback(null, true);

  // 2) caminho tenant via CORS_BASE_DOMAIN (estrito)
  const host = parse(origin);
  if (!host) return callback(null, false);

  const base = (process.env.CORS_BASE_DOMAIN || '').toLowerCase();
  if (!base) return callback(null, false);
  const suffix = '.' + base;
  if (!host.endsWith(suffix)) return callback(null, false);     // fronteira de domínio
  const slug = host.slice(0, -suffix.length);
  if (!slug || slug.includes('.')) return callback(null, false); // 1 label, sem preview/enganoso

  try {
    const empresa = await empresaCache.getEmpresaFromCache(slug);
    return callback(null, empresaCache.isEmpresaDisponivel(empresa));
  } catch {
    return callback(null, false); // fail-closed
  }
}

module.exports = { corsOriginValidator };
