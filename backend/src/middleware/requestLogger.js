/**
 * Request logging middleware using pino
 */
const requestLogger = (logger) => {
  return (req, res, next) => {
    const start = Date.now();

    // Log incoming request
    logger.info(
      {
        method: req.method,
        url: req.url,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
      },
      'Incoming request',
    );

    // Override res.end to log response
    const originalEnd = res.end;
    res.end = function (...args) {
      const duration = Date.now() - start;

      logger.info(
        {
          method: req.method,
          url: req.url,
          statusCode: res.statusCode,
          duration: `${duration}ms`,
          contentLength: res.get('Content-Length'),
        },
        'Request completed',
      );

      originalEnd.apply(this, args);
    };

    next();
  };
};

export default requestLogger;
