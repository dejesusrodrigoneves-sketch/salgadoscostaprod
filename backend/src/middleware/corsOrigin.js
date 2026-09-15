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

function fixedHosts() {
  return (process.env.CORS_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean)
    .map((o) => { try { return new URL(o).hostname.toLowerCase(); } catch { return null; } }).filter(Boolean);
}

async function corsOriginValidator(origin, callback) {
  if (!origin) return callback(null, true); // server-to-server/webhooks
  const host = parse(origin);
  if (!host) return callback(null, false);

  if (fixedHosts().includes(host)) return callback(null, true);

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
