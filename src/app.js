const express = require('express');
const requestLogger = require('./middleware/requestLogger');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.use(express.json());
app.use(requestLogger);

app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      status: 'ok',
    },
  });
});

app.use(notFound);
app.use(errorHandler);

module.exports = app;
