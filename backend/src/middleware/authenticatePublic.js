// backend/src/middleware/authenticatePublic.js
// Auth para rotas publicas (cliente final): Authorization: Bearer OU ?token= (SSE/EventSource)

const sql = require('../repositories/sqlRepository');
const tokenService = require('../services/tokenService');

async function authenticatePublic(req, res, next) {
  const authHeader = req.headers.authorization;
  let token = null;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.query && req.query.token) {
    token = String(req.query.token);
  }
  if (!token) {
    return res.status(401).json({ error: 'Token não fornecido' });
  }
  try {
    const decoded = await tokenService.verificarToken(token);
    // Cross-tenant: token cunhado em empresa A nao vale em empresa B
    if (decoded.empresaId && req.ctx?.empresaId && decoded.empresaId !== req.ctx.empresaId) {
      return res.status(403).json({ error: 'Acesso negado: empresa não corresponde' });
    }
    const cliente = await sql.buscarClientePorId(decoded.id);
    if (!cliente) {
      return res.status(401).json({ error: 'Conta não encontrada ou removida' });
    }
    if (cliente.consentimentoRevogadoAt) {
      return res.status(401).json({ error: 'Consentimento revogado. Reautorize os dados para continuar' });
    }
    req.cliente = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }
}

module.exports = authenticatePublic;
module.exports.authenticatePublic = authenticatePublic;
