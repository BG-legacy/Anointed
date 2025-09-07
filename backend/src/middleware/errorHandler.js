/**
 * Global error handling middleware
 */
const errorHandler = (logger) => {
  return (err, req, res, _next) => {
    let error = { ...err };
    error.message = err.message;

    // Log error
    logger.error(
      {
        err: error,
        req: {
          method: req.method,
          url: req.url,
          headers: req.headers,
          body: req.body,
        },
      },
      'Request error'
    );

    // Default error
    let message = 'Server Error';
    let statusCode = res.statusCode !== 200 ? res.statusCode : 500;

    // If status code is already set (like 404 from notFound middleware), use the error message
    if (statusCode === 404) {
      message = err.message || 'Not Found';
    }

    // Mongoose bad ObjectId
    if (err.name === 'CastError') {
      message = 'Resource not found';
      statusCode = 404;
    }

    // Mongoose duplicate key
    if (err.code === 11000) {
      message = 'Duplicate field value entered';
      statusCode = 400;
    }

    // Mongoose validation error
    if (err.name === 'ValidationError') {
      message = Object.values(err.errors)
        .map((val) => val.message)
        .join(', ');
      statusCode = 400;
    }

    // JWT errors
    if (err.name === 'JsonWebTokenError') {
      message = 'Invalid token';
      statusCode = 401;
    }

    if (err.name === 'TokenExpiredError') {
      message = 'Token expired';
      statusCode = 401;
    }

    res.status(statusCode).json({
      success: false,
      error: message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
  };
};

export default errorHandler;
