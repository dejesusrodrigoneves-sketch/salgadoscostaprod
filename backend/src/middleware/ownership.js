const sql = require('../repositories/sqlRepository');

const fetchers = {
  pedido: (id) => sql.buscarPedido(id),
  produto: (id) => sql.buscarProduto(id),
  cliente: (id) => sql.buscarClientePorId(id),
  entregador: (id) => sql.buscarEntregador(id),
};

function requireOwnership(resourceType, idParam = 'id') {
  return async (req, res, next) => {
    const fetcher = fetchers[resourceType];
    if (!fetcher) return res.status(500).json({ error: 'Tipo de recurso inválido' });

    const id = req.params[idParam];
    const resource = await fetcher(id);
    if (!resource) return res.status(404).json({ error: 'Recurso não encontrado' });

    if (Number(resource.empresaId) !== Number(req.user.empresaId)) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    req.resource = resource;
    next();
  };
}

module.exports = { requireOwnership };
