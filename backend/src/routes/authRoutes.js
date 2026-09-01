const { Router } = require('express');
const controller = require('../controllers/authController');
const { authenticate, authorize } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimit');

const router = Router();

router.post('/login', authLimiter, controller.login);
router.post('/register', authenticate, authorize('superadmin'), controller.criarUsuario);
router.post('/register-public', authLimiter, controller.criarConta);
router.put('/change-password', authenticate, controller.alterarSenha);
router.post('/refresh', controller.refreshToken);
router.post('/logout', authenticate, controller.logout);

module.exports = router;
