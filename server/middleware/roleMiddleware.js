const roleMiddleware = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required before checking role authorization'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: Access requires [${allowedRoles.join(' or ')}] role. Current role is '${req.user.role}'`
      });
    }

    next();
  };
};

module.exports = roleMiddleware;
