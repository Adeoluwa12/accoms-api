require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');

const connectDB = require('./src/config/db');
const routes = require('./src/routes');
const { errorHandler, notFound } = require('./src/middleware/errorHandler');

const app = express();

// ── DB ───────────────────────────────────────────────────────────────────────
connectDB();

// ── MIDDLEWARE ────────────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json({ limit: '5mb' })); // 5mb for bulk CSV imports
app.use(express.urlencoded({ extended: true }));

// ── HEALTH CHECK ──────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── API ROUTES ────────────────────────────────────────────────────────────────
app.use('/api', routes);

// ── ERROR HANDLING ────────────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`ACCOMS API running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
});

module.exports = app;
