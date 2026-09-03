const prisma = require('../config/prisma');

/**
 * Defense-in-depth middleware for entregador routes.
 * Verifies the entregador still exists, is active, and belongs to the empresa in their JWT.
 * Must run AFTER authenticate middleware (req.user must be set).
 */
async function validateEntregadorEmpresa(req, res, next) {
  // Skip for non-entregador roles (admin/superadmin may share routes)
  if (req.user?.role !== 'entregador') {
    return next();
  }

  const { id, empresaId } = req.user;

  if (!id || !empresaId) {
    return res.status(401).json({ error: 'Token inválido: dados incompletos' });
  }

  const entregador = await prisma.entregador.findFirst({
    where: {
      id: Number(id),
      empresaId: Number(empresaId),
    },
    select: {
      id: true,
      empresaId: true,
      ativo: true,
      nome: true,
    },
  });

  if (!entregador) {
    return res.status(401).json({ error: 'Entregador não encontrado' });
  }

  if (!entregador.ativo) {
    return res.status(403).json({ error: 'Conta de entregador desativada' });
  }

  // Attach verified entregador data for downstream use
  req.entregador = entregador;
  next();
}

module.exports = validateEntregadorEmpresa;
