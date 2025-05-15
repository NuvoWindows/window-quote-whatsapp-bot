const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./config/config');
const whatsappRoutes = require('./routes/whatsappRoutes');
const adminRoutes = require('./routes/adminRoutes');
const quoteRoutes = require('./routes/quoteRoutes');
const logger = require('./utils/logger');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files
app.use(express.static(path.join(__dirname, '..', 'public')));

// Routes
app.use('/api', whatsappRoutes);
app.use('/admin', adminRoutes);
app.use('/api/quotes', quoteRoutes);

// Health check route
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Start server
app.listen(config.port, () => {
  logger.info(`Server running on port ${config.port}`);
  logger.info(`Admin interface available at /admin/conversations`);
});