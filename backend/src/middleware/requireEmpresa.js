function requireEmpresa(req, res, next) {
  if (req.user && req.user.role === 'superadmin') {
    return next(); // superadmin acessa global sem empresaId
  }
  // Fallback: sem subdomínio de loja (ex: login-sicia.vercel.app), usa empresaId do JWT
  const empresaId = req.ctx?.empresaId || req.user?.empresaId;
  if (!empresaId) {
    return res.status(403).json({ error: 'Escopo de empresa obrigatório' });
  }
  // Garante que ctx.empresaId exista para o controller
  if (!req.ctx) req.ctx = {};
  if (!req.ctx.empresaId) req.ctx.empresaId = empresaId;
  next();
}

module.exports = requireEmpresa;
