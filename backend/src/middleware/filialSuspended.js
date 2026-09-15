// backend/src/middleware/filialSuspended.js (CJS)
const prisma = require('../config/prisma.js');

async function filialSuspendedCheck(req, res, next) {
  // Skip for superadmin
  if (req.user.role === 'superadmin') return next();

  // Skip if no empresaId
  if (!req.user.empresaId) return next();

  const empresa = await prisma.empresa.findUnique({
    where: { id: req.user.empresaId },
    select: { status: true, parentEmpresaId: true }
  });

  // Only check filiais (not matriz)
  if (!empresa || empresa.parentEmpresaId === null) return next();

  if (empresa.status === 'suspended') {
    // M11: Mensagem reescrita — evita culpar o lojista da filial.
    // A suspensão é responsabilidade da MATRIZ, não da filial.
    return res.status(403).json({
      error: 'Filial temporariamente indisponível. Aguardando regularização da matriz.',
      message: 'Esta filial está temporariamente indisponível. Entre em contato com o restaurante responsável (matriz).',
      code: 'FILIAL_SUSPENSA'
    });
  }

  next();
}

module.exports = { filialSuspendedCheck };