/**
 * Request validation middleware
 * Generic middleware for validating request data using validation schemas
 */
const validateRequest = (schema, property = 'body') => {
  return (req, res, next) => {
    const { error } = schema.validate(req[property]);

    if (error) {
      const errorMessage = error.details
        .map((detail) => detail.message)
        .join(', ');

      return res.status(400).json({
        success: false,
        error: 'Validation Error',
        message: errorMessage,
      });
    }

    next();
  };
};

export default validateRequest;
