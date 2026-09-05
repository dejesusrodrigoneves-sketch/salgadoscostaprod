/**
 * Entregador — Vercel serverless entrypoint (@vercel/node)
 * Serve exclusivamente as rotas do app do entregador.
 * NOTE: resolveEmpresa (multi-tenant por subdomínio) é intencionalmente omitido —
 * o tenant do entregador vem do JWT (login por username), não do subdomínio.
 */
const express = require('express');
const compression = require('compression');
const cors = require('cors');

const { errorHandler } = require('./src/middleware/errorHandler');
const { apiLimiter } = require('./src/middleware/rateLimit');
const { authenticate, authorize } = require('./src/middleware/auth');
const validateEntregadorEmpresa = require('./src/middleware/validateEntregadorEmpresa');
const contextMiddleware = require('./src/middleware/context');
const entregadorAuthRoutes = require('./src/routes/entregadorAuthRoutes');
const entregadorAppRoutes = require('./src/routes/entregadorAppRoutes');

const app = express();

app.use(compression({ threshold: 1024 }));

const corsOrigin = process.env.CORS_ORIGIN;
if (corsOrigin && typeof corsOrigin === 'string') {
  app.use(cors({ origin: corsOrigin.split(',').map((s) => s.trim()) }));
} else {
  app.use(cors({ origin: '*' }));
}

app.use(express.json());
app.use(contextMiddleware);
app.use('/api', apiLimiter);

app.use('/api/entregador/auth', entregadorAuthRoutes);
app.use('/api/entregador', authenticate, authorize('entregador'), validateEntregadorEmpresa, entregadorAppRoutes);

app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.get('/', (req, res) => res.json({ status: 'online', sistema: 'SIC.ia Entregador' }));

app.use(errorHandler);

module.exports = app;