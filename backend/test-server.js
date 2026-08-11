const express = require('express');
const adminRoutes = require('./src/routes/adminRoutes');
const { errorHandler } = require('./src/middleware/errorHandler');
const app = express();
app.use(express.json());
app.use('/api/admin', adminRoutes);
app.use(errorHandler);
app.listen(3001, () => console.log('Test server on 3001'));