const { Router } = require('express');
const controller = require('../controllers/publicController');
const { registerLimiter, orderLimiter, authLimiter } = require('../middleware/rateLimit');
const prisma = require('../config/prisma.js').default;

const router = Router();

router.get('/produtos', controller.listarProdutos);
router.get('/categorias', controller.listarCategorias);
router.get('/loja/status', controller.statusLoja);
router.get('/loja/settings', controller.settingsLoja);
router.post('/clientes/register', registerLimiter, controller.registrarCliente);
router.post('/clientes/login', authLimiter, controller.loginCliente);
router.get('/clientes/me', controller.clientePerfil);
router.put('/clientes/me', controller.atualizarCliente);
router.delete('/clientes/me', controller.excluirConta);
router.post('/clientes/consent/revogar', controller.revogarConsentimento);
router.get('/pedidos', controller.listarPedidosCliente);
router.post('/pedidos', orderLimiter, controller.criarPedido);
router.get('/pedidos/:id', controller.buscarPedido);
router.get('/cupons/:codigo', controller.validarCupom);

// Public endpoint for 404 page — get empresa contact info by slug
router.get('/empresa/:slug/contact', async (req, res) => {
  try {
    const empresa = await prisma.empresa.findUnique({
      where: { slug: req.params.slug },
      select: { nome: true, telefone: true, whatsappNumber: true }
    });
    
    // Fallback: get platform support WhatsApp from PlatformSettings
    let supportWhatsApp = null;
    try {
      const setting = await prisma.platformSettings.findUnique({
        where: { key: 'support_whatsapp' }
      });
      supportWhatsApp = setting?.value || null;
    } catch (e) {}
    
    res.json({
      nome: empresa?.nome || null,
      telefone: empresa?.whatsappNumber || empresa?.telefone || null,
      supportWhatsApp
    });
  } catch (e) {
    res.json({});
  }
});

module.exports = router;
