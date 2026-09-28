const express = require('express');
const mongoose = require('mongoose');
const requestLogger = require('./middleware/requestLogger');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');
const urlRoutes = require('./routes/url.routes');

const DATABASE_STATES = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
};

const app = express();

app.use(express.json());
app.use(requestLogger);

app.get('/health', (req, res) => {
  const database = DATABASE_STATES[mongoose.connection.readyState] || 'disconnected';
  const connected = database === 'connected';

  res.status(connected ? 200 : 503).json({
    success: connected,
    data: {
      status: connected ? 'ok' : 'error',
      database,
    },
  });
});

app.use('/api/urls', urlRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
