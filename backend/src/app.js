const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { errorHandler } = require('./middleware/errorHandler');
const { apiLimiter } = require('./middleware/rateLimit');

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
const path = require('path');
const logger = require('./config/logger');

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
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
app.use('/img', express.static(path.resolve(__dirname, '../../img')));

app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.get('/', (req, res) => res.json({ status: 'online', sistema: 'Backend SalgadosCosta' }));
app.get('/api/config', (req, res) => res.json({
  mapboxToken: process.env.MAPBOX_TOKEN || '',
  graphhopperKey: process.env.GRAPHHOPPER_KEY || '',
}));

app.use(errorHandler);

module.exports = app;
