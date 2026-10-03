const flags = require('../repositories/systemFlagsRepository');

// 503 em escrita PII enquanto rotation_in_progress='1'
module.exports = async function rotationGate(req, res, next) {
  try {
    const on = await flags.getFlag('rotation_in_progress');
    if (on === '1' && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      return res.status(503).set('Retry-After', '60').json({ error: 'manutencao_rotacao' });
    }
    return next();
  } catch (e) {
    return next(e);
  }
};
