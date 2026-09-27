function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || 500;
  const isServerError = statusCode >= 500;

  if (isServerError) {
    console.error(err);
  }

  const message =
    isServerError && !err.isOperational ? 'Internal server error' : err.message;

  res.status(statusCode).json({
    success: false,
    message,
    errors: err.errors || [],
  });
}

module.exports = errorHandler;
