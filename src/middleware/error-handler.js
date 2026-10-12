export function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || (err.status ? Number(err.status) : 500);
  const message = err.message || 'Internal Server Error';

  if (statusCode >= 500) {
    console.error('Unhandled Server Error:', err);
  }

  // Handle unique constraint violation in PostgreSQL (code 23505)
  if (err.code === '23505') {
    return res.status(409).json({
      success: false,
      message: 'A duplicate record already exists with these unique values.',
      detail: err.detail,
    });
  }

  // Foreign key violation (code 23503)
  if (err.code === '23503') {
    return res.status(400).json({
      success: false,
      message: 'Referenced entity does not exist or cannot be deleted due to dependencies.',
      detail: err.detail,
    });
  }

  res.status(statusCode).json({
    success: false,
    message,
    errors: err.details || null,
    ...(process.env.NODE_ENV === 'development' && statusCode >= 500 ? { stack: err.stack } : {}),
  });
}
