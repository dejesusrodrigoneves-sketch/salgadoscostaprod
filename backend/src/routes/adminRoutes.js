const { Router } = require('express');
const sql = require('../repositories/sqlRepository');
const authService = require('../services/authService');
const { authenticate, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

const router = Router();

router.use(authenticate, authorize('superadmin'));

router.get('/', asyncHandler(async (req, res) => {
  const empresas = await sql.listarEmpresas();
  res.json(empresas);
}));

router.post('/', asyncHandler(async (req, res) => {
  const { nome, slug, username, password, lojaNome } = req.body;
  if (!nome || !slug || !username || !password) {
    return res.status(400).json({ error: 'nome, slug, username e password obrigatórios' });
  }

  const empresa = await sql.criarEmpresa({ nome, slug });
  await authService.criarUsuario({
    empresaId: empresa.id,
    username,
    password,
    lojaNome: lojaNome || nome,
    role: 'admin',
  });

  res.status(201).json(empresa);
}));

module.exports = router;
