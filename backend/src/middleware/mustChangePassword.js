// Gate: token com claim mcp (mustChangePassword) só acessa ALLOW (troca de senha + logout).
// Montado dentro de middleware/auth.js (após req.user setado — sync, next() síncrono).
const ALLOW = new Set([
  'PUT /api/auth/change-password',
  'POST /api/auth/logout',
  'POST /api/entregador/auth/change-password',
]);

module.exports = function mustChangePasswordGate(req, res, next) {
  if (!req.user?.mcp) return next();
  const route = `${req.method} ${req.baseUrl}${req.path}`;
  if (ALLOW.has(route)) return next();
  return res.status(403).json({ error: 'must_change_password' });
};
