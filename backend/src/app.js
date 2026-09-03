const express = require('express');
const path = require('path');
const compression = require('compression');
const cors = require('cors');
const helmet = require('helmet');
const prisma = require('./config/prisma');
const { errorHandler } = require('./middleware/errorHandler');
const { apiLimiter } = require('./middleware/rateLimit');
const { authenticate, authorize } = require('./middleware/auth');
const contextMiddleware = require('./middleware/context');
const resolveEmpresa = require('./middleware/resolveEmpresa').resolveEmpresa;

const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const orderRoutes = require('./routes/orderRoutes');
const driverRoutes = require('./routes/driverRoutes');
const cashierRoutes = require('./routes/cashierRoutes');
const scheduleRoutes = require('./routes/scheduleRoutes');
const proxyRoutes = require('./routes/proxyRoutes');
const adminRoutes = require('./routes/adminRoutes');
const categoriaRoutes = require('./routes/categoriaRoutes');
const whatsappRoutes = require('./routes/whatsappRoutes');
const lojaRoutes = require('./routes/lojaRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const publicRoutes = require('./routes/publicRoutes');
const userRoutes = require('./routes/userRoutes');
const entregaRoutes = require('./routes/entregaRoutes');
const auditRoutes = require('./routes/auditRoutes');
const { paymentRouter } = require('./routes/paymentRoutes');
const { webhookRouter } = require('./routes/webhookRoutes');
const settlementRoutes = require('./routes/settlementRoutes');
const paymentSetupRoutes = require('./routes/paymentSetupRoutes');
const financeiroRoutes = require('./routes/financeiroRoutes');
const adminIntegracoesRoutes = require('./routes/adminIntegracoesRoutes');
const marketplaceWebhookRoutes = require('./routes/marketplaceWebhookRoutes');
const superadminDashboardRoutes = require('./routes/superadminDashboardRoutes');
const subscriptionRoutes = require('./routes/subscriptionRoutes');
const pricingRoutes = require('./routes/pricingRoutes');
const entregadorAuthRoutes = require('./routes/entregadorAuthRoutes');
const entregadorAppRoutes = require('./routes/entregadorAppRoutes');

const app = express();

// HTTPS enforcement in production
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (req.headers['x-forwarded-proto'] !== 'https' && !req.path.startsWith('/health')) {
      return res.redirect(301, 'https://' + req.headers.host + req.url);
    }
    next();
  });
}

const { registerAllProviders } = require('./integrations/index');
registerAllProviders();

app.use(resolveEmpresa);
app.use(contextMiddleware);
app.use(compression({ threshold: 1024 }));
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com", "https://cdn.tailwindcss.com"],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com", "https://cdn.jsdelivr.net"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  crossOriginEmbedderPolicy: false,
}));
var corsOrigin = process.env.CORS_ORIGIN;
if (!corsOrigin) {
  // Production: require explicit CORS_ORIGIN env var
  if (process.env.NODE_ENV === 'production') {
    console.error('CORS_ORIGIN must be set in production');
    corsOrigin = 'https://placeholder.example.com';
  } else {
    corsOrigin = '*';
  }
}
if (typeof corsOrigin === 'string' && corsOrigin.includes(',')) {
  corsOrigin = corsOrigin.split(',').map(function(s) { return s.trim(); });
}
app.use(cors({ origin: corsOrigin }));
app.use(express.json({ type: ['application/json', 'application/json;charset=utf-8'] }));
app.use('/api', apiLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/produtos', productRoutes);
app.use('/api/pedidos', orderRoutes);
app.use('/api/entregadores', driverRoutes);
app.use('/api/caixa', cashierRoutes);
app.use('/api/horarios', scheduleRoutes);
app.use('/api/proxy', proxyRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/categorias', categoriaRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/loja', lojaRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/usuarios', userRoutes);
app.use('/api/entregas', entregaRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/payment', paymentRouter);
app.use('/webhooks', webhookRouter);
app.use('/api/empresa/settlement', settlementRoutes);
app.use('/api/empresa/payment', paymentSetupRoutes);
app.use('/api/financeiro', financeiroRoutes);
app.use('/api/admin/integracoes', adminIntegracoesRoutes);
app.use('/api/webhooks', marketplaceWebhookRoutes);
app.use('/api/admin/dashboard', superadminDashboardRoutes);
app.use('/api', subscriptionRoutes);
app.use('/api', pricingRoutes);
app.use('/api/entregador/auth', entregadorAuthRoutes);
app.use('/api/entregador', authenticate, authorize('entregador'), entregadorAppRoutes);

app.get('/health', async (req, res) => {
  try {
    const metrics = await prisma.$metrics.json();
    const pool = metrics.find(m => m.key === 'prisma_pool_connections_open');
    res.json({
      status: 'ok',
      pool: pool ? { active: pool.labels?.value || 'unknown' } : null,
    });
  } catch (e) {
    res.json({ status: 'ok' });
  }
});
app.get('/', (req, res) => res.json({ status: 'online', sistema: 'Backend SalgadosCosta' }));
app.get('/api/config', authenticate, (req, res) => {
  res.set('Cache-Control', 'public, max-age=300, s-maxage=300');
  res.json({
    mapboxToken: process.env.MAPBOX_TOKEN || '',
    graphhopperKey: process.env.GRAPHHOPPER_KEY || '',
  });
});

if (!process.env.VERCEL) {
  app.use(express.static(path.join(__dirname, '..', '..', 'public'), { maxAge: '1d', index: false }));
  app.use(express.static(path.join(__dirname, '..', '..'), {
    index: false,
    extensions: ['html'],
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.html')) {
        res.set('Cache-Control', 'no-cache');
      } else if (filePath.match(/\.[a-f0-9]{8,}\./)) {
        res.set('Cache-Control', 'public, max-age=31536000, immutable');
      } else {
        res.set('Cache-Control', 'public, max-age=604800');
      }
    }
  }));
}

app.use(errorHandler);

module.exports = app;
