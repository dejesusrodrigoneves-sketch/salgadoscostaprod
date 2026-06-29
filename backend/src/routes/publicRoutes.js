const { Router } = require('express');
const controller = require('../controllers/publicController');

const router = Router();

router.get('/produtos', controller.listarProdutos);
router.get('/categorias', controller.listarCategorias);
router.get('/loja/status', controller.statusLoja);
router.get('/loja/settings', controller.settingsLoja);
router.post('/clientes/register', controller.registrarCliente);
router.post('/clientes/login', controller.loginCliente);
router.get('/clientes/me', controller.clientePerfil);
router.put('/clientes/me', controller.atualizarCliente);
router.get('/pedidos', controller.listarPedidosCliente);
router.post('/pedidos', controller.criarPedido); // authenticatePublic aplicado dentro do controller
router.get('/pedidos/:id', controller.buscarPedido);
router.get('/cupons/:codigo', controller.validarCupom);

module.exports = router;
