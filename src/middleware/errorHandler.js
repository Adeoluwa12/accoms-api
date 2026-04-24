// Central error handler
const errorHandler = (err, req, res, next) => {
  console.error(err.stack);

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(422).json({ success: false, message: 'Validation error', errors: messages });
  }

  // Mongoose cast error (bad ObjectId)
  if (err.name === 'CastError') {
    return res.status(400).json({ success: false, message: `Invalid ${err.path}: ${err.value}` });
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(409).json({ success: false, message: `Duplicate value for field: ${field}` });
  }

  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
  });
};

// 404 handler
const notFound = (req, res) => {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.path}` });
};

module.exports = { errorHandler, notFound };
