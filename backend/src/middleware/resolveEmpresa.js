import { getEmpresaFromCache } from '../config/empresaCache.js';

const IGNORED = ['www', 'api', 'admin', 'mail', 'ftp'];

export async function resolveEmpresa(req, res, next) {
  // Fallback: ?slug= parametro (dev/teste local e domínio raiz — fetch não permite Host header custom)
  const querySlug = (req.query && typeof req.query.slug === 'string' && req.query.slug.trim())
    ? req.query.slug.trim().toLowerCase()
    : '';
  if (querySlug) {
    let empresa;
    try {
      empresa = await getEmpresaFromCache(querySlug);
    } catch (err) {
      return next(err);
    }
    if (!empresa) {
      return res.status(404).json({ error: 'Loja não encontrada' });
    }
    if (empresa.deletedAt) {
      return res.status(404).json({ error: 'Loja não encontrada' });
    }
    req.ctx = req.ctx || {};
    req.ctx.empresaId = empresa.id;
    req.ctx.empresa = empresa;
    return next();
  }
  const host = (req.headers.host || '').split(':')[0]; // remove porta
  // localhost / sem ponto => sem tenant
  if (!host || !host.includes('.')) {
    return next();
  }
  const labels = host.split('.');
  const subdomain = labels[0];
  // sem subdomínio real (domínio raiz), IP (primeiro label numérico) ou subdomínio reservado => sem tenant
  if (labels.length < 3 || /^\d+$/.test(subdomain) || IGNORED.includes(subdomain)) {
    return next();
  }
  let empresa;
  try {
    empresa = await getEmpresaFromCache(subdomain);
  } catch (err) {
    return next(err); // não deixa request pendurada em erro de DB/cache
  }
  if (!empresa) {
    return res.status(404).json({ error: 'Loja não encontrada' });
  }
  if (empresa.deletedAt) {
    return res.status(404).json({ error: 'Loja não encontrada' });
  }
  req.ctx = req.ctx || {};
  req.ctx.empresaId = empresa.id;
  req.ctx.empresa = empresa;
  next();
}

export default resolveEmpresa;
