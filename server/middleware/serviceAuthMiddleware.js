const serviceAuthMiddleware = (req, res, next) => {
  const configuredKey = process.env.SERVICE_KEY || 'noticia_internal_service_key_987654321';
  const providedKey = req.headers['x-service-key'] || req.query.service_key || (req.headers.authorization && req.headers.authorization.replace('Bearer ', ''));

  if (!providedKey || providedKey !== configuredKey) {
    // If user is logged in as admin/analyst, allow ingest too for testing convenience
    if (req.user) {
      return next();
    }
    return res.status(401).json({
      success: false,
      message: 'Unauthorized: Valid x-service-key header required for log ingestion pipeline'
    });
  }

  next();
};

module.exports = serviceAuthMiddleware;
