function requireEmpresa(req, res, next) {
  if (req.user && req.user.role === 'superadmin') {
    return next(); // superadmin acessa global sem empresaId
  }
  if (!req.ctx || !req.ctx.empresaId) {
    return res.status(403).json({ error: 'Escopo de empresa obrigatório' });
  }
  next();
}

module.exports = requireEmpresa;
