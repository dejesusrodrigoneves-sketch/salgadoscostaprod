import { getEmpresaFromCache } from '../config/empresaCache.js';

const IGNORED = ['www', 'api', 'admin', 'mail', 'ftp', 'login-sicia'];

export async function resolveEmpresa(req, res, next) {
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
