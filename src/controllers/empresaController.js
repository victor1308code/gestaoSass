const db = require('../config/database');
const bcrypt = require('bcrypt');

const empresaController = {
  // Retorna informações da empresa ativa
  async getDetails(req, res) {
    try {
      const empresa = db.prepare(`
        SELECT e.*, p.nome as plano_nome, p.slug as plano_slug, p.limite_colaboradores, p.limite_usuarios, p.recursos as plano_recursos
        FROM empresas e
        JOIN planos p ON e.plano_id = p.id
        WHERE e.id = ?
      `).get(req.empresaId);

      if (!empresa) {
        return res.status(404).json({ error: 'Empresa não encontrada.' });
      }

      const totalColaboradores = db.prepare('SELECT COUNT(*) as total FROM colaboradores WHERE empresa_id = ?').get(req.empresaId).total;
      const totalUsuarios = db.prepare('SELECT COUNT(*) as total FROM usuarios WHERE empresa_id = ?').get(req.empresaId).total;

      return res.json({
        empresa,
        stats: {
          totalColaboradores,
          totalUsuarios
        }
      });
    } catch (err) {
      console.error('Erro ao buscar detalhes da empresa:', err);
      return res.status(500).json({ error: 'Erro interno ao buscar dados da empresa.' });
    }
  },

  // Atualiza dados e personalização visual da empresa
  async update(req, res) {
    try {
      const { nome_fantasia, razao_social, cnpj, email_contato, telefone_contato, logo_url, cor_primaria } = req.body;

      db.prepare(`
        UPDATE empresas
        SET nome_fantasia = COALESCE(?, nome_fantasia),
            razao_social = COALESCE(?, razao_social),
            cnpj = COALESCE(?, cnpj),
            email_contato = COALESCE(?, email_contato),
            telefone_contato = COALESCE(?, telefone_contato),
            logo_url = COALESCE(?, logo_url),
            cor_primaria = COALESCE(?, cor_primaria)
        WHERE id = ?
      `).run(
        nome_fantasia || null,
        razao_social || null,
        cnpj || null,
        email_contato || null,
        telefone_contato || null,
        logo_url || null,
        cor_primaria || null,
        req.empresaId
      );

      return res.json({ success: true, message: 'Dados da empresa atualizados com sucesso!' });
    } catch (err) {
      console.error('Erro ao atualizar empresa:', err);
      return res.status(500).json({ error: 'Erro interno ao atualizar empresa.' });
    }
  },

  // Lista usuários vinculados à empresa
  async listUsers(req, res) {
    try {
      const users = db.prepare(`
        SELECT id, nome, email, role, status, created_at
        FROM usuarios
        WHERE empresa_id = ?
        ORDER BY id ASC
      `).all(req.empresaId);

      return res.json(users);
    } catch (err) {
      console.error('Erro ao listar usuários:', err);
      return res.status(500).json({ error: 'Erro interno ao listar usuários.' });
    }
  },

  // Cria / Convida novo usuário para a empresa
  async createUser(req, res) {
    try {
      const { nome, email, senha, role } = req.body;

      if (!nome || !email || !senha || !role) {
        return res.status(400).json({ error: 'Preencha todos os campos obrigatórios.' });
      }

      // Verifica limite de usuários do plano
      const plano = db.prepare(`
        SELECT p.limite_usuarios
        FROM empresas e
        JOIN planos p ON e.plano_id = p.id
        WHERE e.id = ?
      `).get(req.empresaId);

      const totalUsuarios = db.prepare('SELECT COUNT(*) as total FROM usuarios WHERE empresa_id = ?').get(req.empresaId).total;
      if (plano && totalUsuarios >= plano.limite_usuarios) {
        return res.status(400).json({
          error: `Limite de usuários atingido para seu plano (${plano.limite_usuarios} usuários). Faça upgrade para adicionar mais.`
        });
      }

      const existingUser = db.prepare('SELECT id FROM usuarios WHERE LOWER(email) = LOWER(?)').get(email.trim());
      if (existingUser) {
        return res.status(409).json({ error: 'Este e-mail já está cadastrado no sistema.' });
      }

      const senhaHash = await bcrypt.hash(senha, 10);
      const result = db.prepare(`
        INSERT INTO usuarios (empresa_id, nome, email, senha_hash, role, status)
        VALUES (?, ?, ?, ?, ?, 'ativo')
      `).run(req.empresaId, nome.trim(), email.trim().toLowerCase(), senhaHash, role);

      return res.status(201).json({
        success: true,
        message: 'Usuário adicionado com sucesso!',
        id: result.lastInsertRowid
      });
    } catch (err) {
      console.error('Erro ao criar usuário:', err);
      return res.status(500).json({ error: 'Erro interno ao criar usuário.' });
    }
  },

  // Remove ou desativa usuário
  async deleteUser(req, res) {
    try {
      const userId = parseInt(req.params.id, 10);
      if (userId === req.user.id) {
        return res.status(400).json({ error: 'Você não pode remover seu próprio usuário.' });
      }

      db.prepare('DELETE FROM usuarios WHERE id = ? AND empresa_id = ?').run(userId, req.empresaId);
      return res.json({ success: true, message: 'Usuário removido com sucesso.' });
    } catch (err) {
      console.error('Erro ao remover usuário:', err);
      return res.status(500).json({ error: 'Erro interno ao remover usuário.' });
    }
  }
};

module.exports = empresaController;
