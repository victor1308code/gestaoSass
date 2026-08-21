const db = require('../config/database');

const historicoController = {
  async list(req, res) {
    try {
      const { tipo, search, limit } = req.query;

      let sql = `
        SELECT h.*, c.foto as colaborador_foto
        FROM historico_movimentacoes h
        LEFT JOIN colaboradores c ON h.colaborador_id = c.id
        WHERE h.empresa_id = ?
      `;

      const params = [req.empresaId];

      if (tipo && tipo !== 'todos') {
        sql += ` AND h.tipo = ?`;
        params.push(tipo);
      }

      if (search && search.trim()) {
        sql += ` AND (h.colaborador_nome LIKE ? OR h.descricao LIKE ? OR h.usuario_nome LIKE ?)`;
        const s = `%${search.trim()}%`;
        params.push(s, s, s);
      }

      sql += ` ORDER BY h.created_at DESC LIMIT ?`;
      params.push(limit ? parseInt(limit, 10) : 100);

      const items = db.prepare(sql).all(...params);
      return res.json(items);
    } catch (err) {
      console.error('Erro ao buscar histórico:', err);
      return res.status(500).json({ error: 'Erro interno ao buscar histórico.' });
    }
  }
};

module.exports = historicoController;
