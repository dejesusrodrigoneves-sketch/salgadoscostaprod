const { Router } = require('express');
const sql = require('../repositories/sqlRepository');
const authService = require('../services/authService');
const { authenticate, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const clientAdminController = require('../controllers/clientAdminController');

const router = Router();

router.use(authenticate, authorize('superadmin'));

router.get('/', asyncHandler(async (req, res) => {
  const empresas = await sql.listarEmpresas();
  res.json(empresas);
}));

router.post('/', asyncHandler(async (req, res) => {
  res.status(400).json({ error: 'Criação de novas empresas desabilitada em modo single-tenant' });
}));

router.get('/clientes', clientAdminController.listar);
router.put('/clientes/:id', clientAdminController.atualizar);
router.put('/clientes/:id/password', clientAdminController.resetarSenha);
router.delete('/clientes/:id', clientAdminController.deletar);

module.exports = router;
