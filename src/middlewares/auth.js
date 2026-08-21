const db = require('../config/database');

function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Não autenticado. Por favor, realize o login.' });
  }

  const user = db.prepare(`
    SELECT u.id, u.empresa_id, u.nome, u.email, u.role, u.status,
           e.nome_fantasia as empresa_nome, e.slug as empresa_slug, e.logo_url, e.cor_primaria, e.status as empresa_status,
           p.nome as plano_nome, p.limite_colaboradores, p.limite_usuarios
    FROM usuarios u
    LEFT JOIN empresas e ON u.empresa_id = e.id
    LEFT JOIN planos p ON e.plano_id = p.id
    WHERE u.id = ?
  `).get(req.session.userId);

  if (!user || user.status !== 'ativo') {
    req.session.destroy();
    return res.status(401).json({ error: 'Usuário inativo ou inexistente.' });
  }

  if (user.empresa_id && user.empresa_status === 'bloqueado' && user.role !== 'superadmin') {
    return res.status(403).json({ error: 'Acesso suspenso para esta empresa. Contate o suporte.' });
  }

  req.user = {
    id: user.id,
    empresa_id: user.empresa_id,
    nome: user.nome,
    email: user.email,
    role: user.role,
    empresa: user.empresa_id ? {
      id: user.empresa_id,
      nome: user.empresa_nome,
      slug: user.empresa_slug,
      logo_url: user.logo_url,
      cor_primaria: user.cor_primaria,
      status: user.empresa_status,
      plano: {
        nome: user.plano_nome,
        limite_colaboradores: user.limite_colaboradores,
        limite_usuarios: user.limite_usuarios
      }
    } : null
  };

  next();
}

module.exports = { requireAuth };
