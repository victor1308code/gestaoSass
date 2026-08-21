const db = require('../config/database');

const dashboardController = {
  async getMetrics(req, res) {
    try {
      const empresaId = req.empresaId;

      // 1. Contagens gerais
      const totalColaboradores = db.prepare(`
        SELECT COUNT(*) as total FROM colaboradores
        WHERE empresa_id = ? AND status != 'desligado'
      `).get(empresaId).total;

      const totalDepartamentos = db.prepare(`
        SELECT COUNT(*) as total FROM departamentos WHERE empresa_id = ?
      `).get(empresaId).total;

      const totalCargos = db.prepare(`
        SELECT COUNT(*) as total FROM cargos WHERE empresa_id = ?
      `).get(empresaId).total;

      const totalUsuarios = db.prepare(`
        SELECT COUNT(*) as total FROM usuarios WHERE empresa_id = ?
      `).get(empresaId).total;

      // 2. Distribuição por departamento
      const distribuicaoDept = db.prepare(`
        SELECT d.id, d.nome, d.sigla, d.cor, COUNT(c.id) as total
        FROM departamentos d
        LEFT JOIN colaboradores c ON c.departamento_id = d.id AND c.status != 'desligado'
        WHERE d.empresa_id = ?
        GROUP BY d.id
        ORDER BY total DESC, d.nome ASC
      `).all(empresaId);

      // 3. Colaboradores admitidos recentemente (últimos 5)
      const recentes = db.prepare(`
        SELECT c.id, c.nome, c.foto, c.data_admissao,
               d.nome as departamento_nome, cg.nome_cargo
        FROM colaboradores c
        LEFT JOIN departamentos d ON c.departamento_id = d.id
        LEFT JOIN cargos cg ON c.cargo_id = cg.id
        WHERE c.empresa_id = ? AND c.status != 'desligado'
        ORDER BY c.data_admissao DESC, c.id DESC
        LIMIT 5
      `).all(empresaId);

      // 4. Últimas movimentações do histórico
      const ultimasMovimentacoes = db.prepare(`
        SELECT * FROM historico_movimentacoes
        WHERE empresa_id = ?
        ORDER BY created_at DESC
        LIMIT 6
      `).all(empresaId);

      return res.json({
        kpis: {
          totalColaboradores,
          totalDepartamentos,
          totalCargos,
          totalUsuarios
        },
        distribuicaoDept,
        recentes,
        ultimasMovimentacoes
      });
    } catch (err) {
      console.error('Erro ao carregar métricas do dashboard:', err);
      return res.status(500).json({ error: 'Erro interno ao carregar dados do dashboard.' });
    }
  }
};

module.exports = dashboardController;
