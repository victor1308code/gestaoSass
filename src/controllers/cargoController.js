const db = require('../config/database');

const cargoController = {
  // Lista todos os cargos da empresa
  async list(req, res) {
    try {
      const cargos = db.prepare(`
        SELECT c.*,
               (SELECT COUNT(*) FROM colaboradores col WHERE col.cargo_id = c.id AND col.status != 'desligado') as total_colaboradores
        FROM cargos c
        WHERE c.empresa_id = ?
        ORDER BY c.nome_cargo ASC
      `).all(req.empresaId);

      return res.json(cargos);
    } catch (err) {
      console.error('Erro ao listar cargos:', err);
      return res.status(500).json({ error: 'Erro interno ao listar cargos.' });
    }
  },

  // Cria novo cargo
  async create(req, res) {
    try {
      const { nome_cargo, nivel, cbo, descricao } = req.body;

      if (!nome_cargo) {
        return res.status(400).json({ error: 'O nome do cargo é obrigatório.' });
      }

      const result = db.prepare(`
        INSERT INTO cargos (empresa_id, nome_cargo, nivel, cbo, descricao)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        req.empresaId,
        nome_cargo.trim(),
        nivel || 'Pleno',
        cbo ? cbo.trim() : null,
        descricao ? descricao.trim() : null
      );

      return res.status(201).json({
        success: true,
        message: 'Cargo criado com sucesso!',
        id: result.lastInsertRowid
      });
    } catch (err) {
      console.error('Erro ao criar cargo:', err);
      return res.status(500).json({ error: 'Erro interno ao criar cargo.' });
    }
  },

  // Atualiza cargo
  async update(req, res) {
    try {
      const cargoId = parseInt(req.params.id, 10);
      const { nome_cargo, nivel, cbo, descricao } = req.body;

      if (!nome_cargo) {
        return res.status(400).json({ error: 'O nome do cargo é obrigatório.' });
      }

      db.prepare(`
        UPDATE cargos
        SET nome_cargo = ?,
            nivel = ?,
            cbo = ?,
            descricao = ?
        WHERE id = ? AND empresa_id = ?
      `).run(
        nome_cargo.trim(),
        nivel || 'Pleno',
        cbo ? cbo.trim() : null,
        descricao ? descricao.trim() : null,
        cargoId,
        req.empresaId
      );

      return res.json({ success: true, message: 'Cargo atualizado com sucesso!' });
    } catch (err) {
      console.error('Erro ao atualizar cargo:', err);
      return res.status(500).json({ error: 'Erro interno ao atualizar cargo.' });
    }
  },

  // Exclui cargo
  async delete(req, res) {
    try {
      const cargoId = parseInt(req.params.id, 10);

      db.prepare('UPDATE colaboradores SET cargo_id = NULL WHERE cargo_id = ? AND empresa_id = ?').run(cargoId, req.empresaId);
      db.prepare('DELETE FROM cargos WHERE id = ? AND empresa_id = ?').run(cargoId, req.empresaId);

      return res.json({ success: true, message: 'Cargo removido com sucesso.' });
    } catch (err) {
      console.error('Erro ao remover cargo:', err);
      return res.status(500).json({ error: 'Erro interno ao remover cargo.' });
    }
  }
};

module.exports = cargoController;
