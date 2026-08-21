const db = require('../config/database');

const departamentoController = {
  // Lista todos os departamentos da empresa
  async list(req, res) {
    try {
      const departamentos = db.prepare(`
        SELECT d.*, 
               p.nome as parent_nome,
               c.nome as responsavel_nome,
               (SELECT COUNT(*) FROM colaboradores col WHERE col.departamento_id = d.id AND col.status != 'desligado') as total_colaboradores
        FROM departamentos d
        LEFT JOIN departamentos p ON d.parent_id = p.id
        LEFT JOIN colaboradores c ON d.responsavel_id = c.id
        WHERE d.empresa_id = ?
        ORDER BY d.ordem ASC, d.nome ASC
      `).all(req.empresaId);

      return res.json(departamentos);
    } catch (err) {
      console.error('Erro ao listar departamentos:', err);
      return res.status(500).json({ error: 'Erro interno ao listar departamentos.' });
    }
  },

  // Retorna a árvore hierárquica completa de departamentos com seus colaboradores
  async getTree(req, res) {
    try {
      const departamentos = db.prepare(`
        SELECT d.id, d.parent_id, d.nome, d.sigla, d.ramal, d.cor, d.responsavel_id,
               c.nome as responsavel_nome, c.foto as responsavel_foto, cg.nome_cargo as responsavel_cargo
        FROM departamentos d
        LEFT JOIN colaboradores c ON d.responsavel_id = c.id
        LEFT JOIN cargos cg ON c.cargo_id = cg.id
        WHERE d.empresa_id = ?
        ORDER BY d.ordem ASC, d.nome ASC
      `).all(req.empresaId);

      const colaboradores = db.prepare(`
        SELECT col.id, col.nome, col.matricula, col.foto, col.departamento_id, col.status,
               cg.nome_cargo, cg.nivel as cargo_nivel
        FROM colaboradores col
        LEFT JOIN cargos cg ON col.cargo_id = cg.id
        WHERE col.empresa_id = ? AND col.status != 'desligado'
        ORDER BY col.nome ASC
      `).all(req.empresaId);

      // Agrupa colaboradores por departamento
      const colabPorDept = {};
      colaboradores.forEach(c => {
        if (!colabPorDept[c.departamento_id]) {
          colabPorDept[c.departamento_id] = [];
        }
        colabPorDept[c.departamento_id].push(c);
      });

      // Monta a árvore recursiva
      const deptMap = {};
      const roots = [];

      departamentos.forEach(d => {
        deptMap[d.id] = {
          ...d,
          colaboradores: colabPorDept[d.id] || [],
          total_colaboradores: (colabPorDept[d.id] || []).length,
          children: []
        };
      });

      departamentos.forEach(d => {
        if (d.parent_id && deptMap[d.parent_id]) {
          deptMap[d.parent_id].children.push(deptMap[d.id]);
        } else {
          roots.push(deptMap[d.id]);
        }
      });

      return res.json({
        tree: roots,
        total_departamentos: departamentos.length,
        total_colaboradores: colaboradores.length
      });
    } catch (err) {
      console.error('Erro ao gerar árvore de departamentos:', err);
      return res.status(500).json({ error: 'Erro interno ao gerar organograma.' });
    }
  },

  // Cria novo departamento
  async create(req, res) {
    try {
      const { parent_id, nome, sigla, ramal, cor, responsavel_id, ordem } = req.body;

      if (!nome) {
        return res.status(400).json({ error: 'O nome do departamento é obrigatório.' });
      }

      const result = db.prepare(`
        INSERT INTO departamentos (empresa_id, parent_id, nome, sigla, ramal, cor, responsavel_id, ordem)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        req.empresaId,
        parent_id ? parseInt(parent_id, 10) : null,
        nome.trim(),
        sigla ? sigla.trim().toUpperCase() : null,
        ramal ? ramal.trim() : null,
        cor || '#3b82f6',
        responsavel_id ? parseInt(responsavel_id, 10) : null,
        ordem ? parseInt(ordem, 10) : 0
      );

      return res.status(201).json({
        success: true,
        message: 'Departamento criado com sucesso!',
        id: result.lastInsertRowid
      });
    } catch (err) {
      console.error('Erro ao criar departamento:', err);
      return res.status(500).json({ error: 'Erro interno ao criar departamento.' });
    }
  },

  // Atualiza departamento
  async update(req, res) {
    try {
      const deptId = parseInt(req.params.id, 10);
      const { parent_id, nome, sigla, ramal, cor, responsavel_id, ordem } = req.body;

      if (!nome) {
        return res.status(400).json({ error: 'O nome do departamento é obrigatório.' });
      }

      // Evita loop de parentesco (não pode ser pai de si mesmo)
      if (parent_id && parseInt(parent_id, 10) === deptId) {
        return res.status(400).json({ error: 'Um departamento não pode ser subordinado a si mesmo.' });
      }

      db.prepare(`
        UPDATE departamentos
        SET parent_id = ?,
            nome = ?,
            sigla = ?,
            ramal = ?,
            cor = ?,
            responsavel_id = ?,
            ordem = ?
        WHERE id = ? AND empresa_id = ?
      `).run(
        parent_id ? parseInt(parent_id, 10) : null,
        nome.trim(),
        sigla ? sigla.trim().toUpperCase() : null,
        ramal ? ramal.trim() : null,
        cor || '#3b82f6',
        responsavel_id ? parseInt(responsavel_id, 10) : null,
        ordem ? parseInt(ordem, 10) : 0,
        deptId,
        req.empresaId
      );

      return res.json({ success: true, message: 'Departamento atualizado com sucesso!' });
    } catch (err) {
      console.error('Erro ao atualizar departamento:', err);
      return res.status(500).json({ error: 'Erro interno ao atualizar departamento.' });
    }
  },

  // Remove departamento
  async delete(req, res) {
    try {
      const deptId = parseInt(req.params.id, 10);

      // Repassa filhos para o pai do departamento excluído
      const dept = db.prepare('SELECT parent_id FROM departamentos WHERE id = ? AND empresa_id = ?').get(deptId, req.empresaId);
      if (!dept) {
        return res.status(404).json({ error: 'Departamento não encontrado.' });
      }

      db.prepare('UPDATE departamentos SET parent_id = ? WHERE parent_id = ? AND empresa_id = ?').run(dept.parent_id, deptId, req.empresaId);
      db.prepare('UPDATE colaboradores SET departamento_id = NULL WHERE departamento_id = ? AND empresa_id = ?').run(deptId, req.empresaId);
      db.prepare('DELETE FROM departamentos WHERE id = ? AND empresa_id = ?').run(deptId, req.empresaId);

      return res.json({ success: true, message: 'Departamento excluído com sucesso.' });
    } catch (err) {
      console.error('Erro ao remover departamento:', err);
      return res.status(500).json({ error: 'Erro interno ao excluir departamento.' });
    }
  }
};

module.exports = departamentoController;
