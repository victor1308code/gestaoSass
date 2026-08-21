function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Não autenticado.' });
    }

    if (req.user.role === 'superadmin') {
      return next(); // SuperAdmin can access any route
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Acesso negado: permissão insuficiente.' });
    }

    next();
  };
}

module.exports = { requireRole };
