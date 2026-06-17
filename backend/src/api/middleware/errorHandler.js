// backend/src/api/middleware/errorHandler.js
// Express error-handling middleware (must declare all four args).
export const errorHandler = (err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error('[errorHandler]', err.stack || err.message);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    error: err.name || 'InternalServerError',
    message: err.message || 'An unexpected error occurred',
  });
};

export default errorHandler;
