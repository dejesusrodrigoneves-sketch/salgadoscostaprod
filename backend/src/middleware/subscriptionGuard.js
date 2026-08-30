// backend/src/middleware/subscriptionGuard.js (CJS)
const subscriptionService = require('../services/subscriptionService.js');

async function subscriptionGuard(req, res, next) {
  try {
    // Skip for superadmin
    if (req.user?.role === 'superadmin') return next();
    
    const empresaId = req.user?.empresaId || req.user?.empresa?.id;
    if (!empresaId) return next();
    
    const subscription = await subscriptionService.getSubscriptionByEmpresaId(empresaId);
    if (!subscription) return next();
    
    const accessLevel = subscriptionService.getAccessLevel(subscription);
    
    if (accessLevel === 'BLOCKED') {
      return res.status(403).json({ 
        error: 'Assinatura inativa',
        message: 'Sua empresa está com pagamento pendente. Regularize para ter acesso.',
        subscriptionStatus: subscription.status
      });
    }
    
    if (accessLevel === 'READ_ONLY') {
      // Allow only GET requests
      if (req.method !== 'GET') {
        return res.status(403).json({ 
          error: 'Acesso somente leitura',
          message: 'Sua empresa está com pagamento pendente. Acesso limitado a consulta.',
          subscriptionStatus: subscription.status
        });
      }
    }
    
    // Add subscription info to request
    req.subscription = subscription;
    req.accessLevel = accessLevel;
    
    next();
  } catch (error) {
    console.error('Subscription guard error:', error);
    next(); // Don't block on error
  }
}

module.exports = { subscriptionGuard };
