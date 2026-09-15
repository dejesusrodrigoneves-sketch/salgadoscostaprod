function requireEmpresa(req, res, next) {
  if (req.user && req.user.role === 'superadmin') return next();
  const empresaId = req.ctx?.empresaId || req.user?.empresaId;
  if (!empresaId) return res.status(403).json({ error: 'Escopo de empresa obrigatório' });
  if (!req.ctx) req.ctx = {};
  if (!req.ctx.empresaId) req.ctx.empresaId = empresaId;
  next();
}

module.exports = requireEmpresa;
