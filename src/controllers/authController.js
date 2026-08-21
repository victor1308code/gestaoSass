const bcrypt = require('bcrypt');
const db = require('../config/database');

function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-');
}

const authController = {
  // Login de Usuário (Admin, Gestor, Viewer ou SuperAdmin)
  async login(req, res) {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
      }

      const user = db.prepare(`
        SELECT u.*, e.status as empresa_status, e.nome_fantasia as empresa_nome
        FROM usuarios u
        LEFT JOIN empresas e ON u.empresa_id = e.id
        WHERE LOWER(u.email) = LOWER(?)
      `).get(email.trim());

      if (!user) {
        return res.status(401).json({ error: 'Credenciais inválidas. Verifique seu e-mail e senha.' });
      }

      const passwordMatch = await bcrypt.compare(password, user.senha_hash);
      if (!passwordMatch) {
        return res.status(401).json({ error: 'Credenciais inválidas. Verifique seu e-mail e senha.' });
      }

      if (user.status !== 'ativo') {
        return res.status(403).json({ error: 'Sua conta de usuário está desativada.' });
      }

      if (user.empresa_id && user.empresa_status === 'bloqueado' && user.role !== 'superadmin') {
        return res.status(403).json({ error: 'Acesso da empresa suspenso. Entre em contato com o suporte.' });
      }

      // Salva sessão
      req.session.userId = user.id;
      req.session.empresaId = user.empresa_id;
      req.session.role = user.role;

      return res.json({
        success: true,
        user: {
          id: user.id,
          nome: user.nome,
          email: user.email,
          role: user.role,
          empresa_id: user.empresa_id,
          empresa_nome: user.empresa_nome
        }
      });
    } catch (err) {
      console.error('Erro no login:', err);
      return res.status(500).json({ error: 'Erro interno ao realizar login.' });
    }
  },

  // Cadastro de Nova Empresa (Self-Service Onboarding do SaaS)
  async registerEmpresa(req, res) {
    try {
      const { nome_fantasia, razao_social, cnpj, email, senha, nome_responsavel, telefone } = req.body;

      if (!nome_fantasia || !email || !senha || !nome_responsavel) {
        return res.status(400).json({ error: 'Preencha todos os campos obrigatórios.' });
      }

      // Verifica se o e-mail já existe
      const existingUser = db.prepare('SELECT id FROM usuarios WHERE LOWER(email) = LOWER(?)').get(email.trim());
      if (existingUser) {
        return res.status(409).json({ error: 'Este e-mail já está cadastrado no sistema.' });
      }

      // Gera slug único para a empresa
      let baseSlug = slugify(nome_fantasia);
      let slug = baseSlug;
      let counter = 1;
      while (db.prepare('SELECT id FROM empresas WHERE slug = ?').get(slug)) {
        slug = `${baseSlug}-${counter++}`;
      }

      // Plano Free padrão
      const freePlano = db.prepare("SELECT id FROM planos WHERE slug = 'free'").get() || { id: 1 };

      const senhaHash = await bcrypt.hash(senha, 10);

      // Transação para criar empresa + departamento inicial + cargo padrão + usuário admin
      db.exec('BEGIN');
      try {
        const empresaResult = db.prepare(`
          INSERT INTO empresas (razao_social, nome_fantasia, cnpj, slug, email_contato, telefone_contato, plano_id, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'ativo')
        `).run(
          razao_social || nome_fantasia,
          nome_fantasia,
          cnpj || null,
          slug,
          email.trim(),
          telefone || null,
          freePlano.id
        );

        const empresaId = empresaResult.lastInsertRowid;

        // Cria departamento raiz
        const deptResult = db.prepare(`
          INSERT INTO departamentos (empresa_id, nome, sigla, ramal, cor, ordem)
          VALUES (?, 'Diretoria Geral', 'DIR', '100', '#2563eb', 1)
        `).run(empresaId);

        // Cria cargo padrão
        db.prepare(`
          INSERT INTO cargos (empresa_id, nome_cargo, nivel, descricao)
          VALUES (?, 'Diretor(a)', 'Diretoria', 'Direção Geral da Empresa')
        `).run(empresaId);

        // Cria usuário Admin da empresa
        const userResult = db.prepare(`
          INSERT INTO usuarios (empresa_id, nome, email, senha_hash, role, status)
          VALUES (?, ?, ?, ?, 'admin', 'ativo')
        `).run(empresaId, nome_responsavel.trim(), email.trim().toLowerCase(), senhaHash);

        db.exec('COMMIT');

        // Autentica o usuário imediatamente na sessão
        req.session.userId = userResult.lastInsertRowid;
        req.session.empresaId = empresaId;
        req.session.role = 'admin';

        return res.status(201).json({
          success: true,
          message: 'Empresa cadastrada com sucesso!',
          empresa: {
            id: empresaId,
            nome_fantasia,
            slug
          },
          user: {
            id: userResult.lastInsertRowid,
            nome: nome_responsavel,
            email: email.trim(),
            role: 'admin'
          }
        });
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    } catch (err) {
      console.error('Erro no cadastro de empresa:', err);
      return res.status(500).json({ error: 'Erro interno ao cadastrar empresa.' });
    }
  },

  // Retorna dados do usuário autenticado e status da empresa
  async me(req, res) {
    return res.json({
      user: req.user
    });
  },

  // Logout
  async logout(req, res) {
    req.session.destroy(err => {
      if (err) {
        return res.status(500).json({ error: 'Erro ao encerrar sessão.' });
      }
      res.clearCookie('connect.sid');
      return res.json({ success: true, message: 'Sessão encerrada com sucesso.' });
    });
  },

  // Alterar Senha
  async updatePassword(req, res) {
    try {
      const { senhaAtual, novaSenha } = req.body;
      if (!senhaAtual || !novaSenha) {
        return res.status(400).json({ error: 'Informe a senha atual e a nova senha.' });
      }

      if (novaSenha.length < 6) {
        return res.status(400).json({ error: 'A nova senha deve ter no mínimo 6 caracteres.' });
      }

      const user = db.prepare('SELECT senha_hash FROM usuarios WHERE id = ?').get(req.user.id);
      const match = await bcrypt.compare(senhaAtual, user.senha_hash);
      if (!match) {
        return res.status(400).json({ error: 'A senha atual informada está incorreta.' });
      }

      const newHash = await bcrypt.hash(novaSenha, 10);
      db.prepare('UPDATE usuarios SET senha_hash = ? WHERE id = ?').run(newHash, req.user.id);

      return res.json({ success: true, message: 'Senha alterada com sucesso!' });
    } catch (err) {
      console.error('Erro ao alterar senha:', err);
      return res.status(500).json({ error: 'Erro interno ao alterar senha.' });
    }
  }
};

module.exports = authController;
