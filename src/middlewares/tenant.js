function requireTenant(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Não autenticado.' });
  }

  // Se for superadmin, pode especificar empresa_id no header ou query params
  if (req.user.role === 'superadmin') {
    const overrideEmpresaId = req.headers['x-empresa-id'] || req.query.empresa_id;
    if (overrideEmpresaId) {
      req.empresaId = parseInt(overrideEmpresaId, 10);
      return next();
    }
  }

  if (!req.user.empresa_id) {
    return res.status(400).json({ error: 'Nenhuma empresa associada a esta conta.' });
  }

  req.empresaId = req.user.empresa_id;
  next();
}

module.exports = { requireTenant };
