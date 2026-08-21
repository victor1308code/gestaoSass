const db = require('../config/database');

const colaboradorController = {
  // Lista colaboradores com busca e filtros
  async list(req, res) {
    try {
      const { search, departamento_id, cargo_id, status } = req.query;

      let sql = `
        SELECT c.*,
               d.nome as departamento_nome, d.sigla as departamento_sigla, d.cor as departamento_cor,
               cg.nome_cargo, cg.nivel as cargo_nivel,
               g.nome as gestor_nome,
               cr.tipo_sanguineo, cr.rg, cr.cpf
        FROM colaboradores c
        LEFT JOIN departamentos d ON c.departamento_id = d.id
        LEFT JOIN cargos cg ON c.cargo_id = cg.id
        LEFT JOIN colaboradores g ON c.gestor_id = g.id
        LEFT JOIN crachas_dados cr ON cr.colaborador_id = c.id
        WHERE c.empresa_id = ?
      `;

      const params = [req.empresaId];

      if (search && search.trim()) {
        sql += ` AND (c.nome LIKE ? OR c.matricula LIKE ? OR c.email LIKE ? OR cg.nome_cargo LIKE ?)`;
        const s = `%${search.trim()}%`;
        params.push(s, s, s, s);
      }

      if (departamento_id) {
        sql += ` AND c.departamento_id = ?`;
        params.push(parseInt(departamento_id, 10));
      }

      if (cargo_id) {
        sql += ` AND c.cargo_id = ?`;
        params.push(parseInt(cargo_id, 10));
      }

      if (status) {
        sql += ` AND c.status = ?`;
        params.push(status);
      } else {
        // Por padrão oculta desligados a menos que explicitamente solicitado
        sql += ` AND c.status != 'desligado'`;
      }

      sql += ` ORDER BY c.nome ASC`;

      const colaboradores = db.prepare(sql).all(...params);
      return res.json(colaboradores);
    } catch (err) {
      console.error('Erro ao listar colaboradores:', err);
      return res.status(500).json({ error: 'Erro interno ao listar colaboradores.' });
    }
  },

  // Retorna detalhes de um colaborador
  async getById(req, res) {
    try {
      const id = parseInt(req.params.id, 10);
      const colaborador = db.prepare(`
        SELECT c.*,
               d.nome as departamento_nome, d.sigla as departamento_sigla, d.ramal as departamento_ramal,
               cg.nome_cargo, cg.nivel as cargo_nivel,
               g.nome as gestor_nome,
               cr.tipo_sanguineo, cr.numero_via, cr.filiacao_pai, cr.filiacao_mae,
               cr.naturalidade_cidade, cr.naturalidade_uf, cr.data_nascimento, cr.rg, cr.cpf, cr.pis_pasep, cr.data_emissao
        FROM colaboradores c
        LEFT JOIN departamentos d ON c.departamento_id = d.id
        LEFT JOIN cargos cg ON c.cargo_id = cg.id
        LEFT JOIN colaboradores g ON c.gestor_id = g.id
        LEFT JOIN crachas_dados cr ON cr.colaborador_id = c.id
        WHERE c.id = ? AND c.empresa_id = ?
      `).get(id, req.empresaId);

      if (!colaborador) {
        return res.status(404).json({ error: 'Colaborador não encontrado.' });
      }

      const historico = db.prepare(`
        SELECT * FROM historico_movimentacoes
        WHERE colaborador_id = ? AND empresa_id = ?
        ORDER BY created_at DESC
      `).all(id, req.empresaId);

      return res.json({
        ...colaborador,
        historico
      });
    } catch (err) {
      console.error('Erro ao buscar colaborador:', err);
      return res.status(500).json({ error: 'Erro interno ao buscar colaborador.' });
    }
  },

  // Cria novo colaborador
  async create(req, res) {
    try {
      const {
        matricula, nome, email, telefone, cargo_id, departamento_id,
        gestor_id, data_admissao, status, foto,
        // Dados do crachá
        tipo_sanguineo, rg, cpf, data_nascimento, filiacao_pai, filiacao_mae,
        naturalidade_cidade, naturalidade_uf, pis_pasep
      } = req.body;

      if (!nome) {
        return res.status(400).json({ error: 'O nome do colaborador é obrigatório.' });
      }

      // Validação de limite do plano do SaaS
      const plano = db.prepare(`
        SELECT p.limite_colaboradores, p.nome as plano_nome
        FROM empresas e
        JOIN planos p ON e.plano_id = p.id
        WHERE e.id = ?
      `).get(req.empresaId);

      const totalAtivos = db.prepare(`
        SELECT COUNT(*) as total FROM colaboradores
        WHERE empresa_id = ? AND status != 'desligado'
      `).get(req.empresaId).total;

      if (plano && totalAtivos >= plano.limite_colaboradores) {
        return res.status(403).json({
          error: `Limite de colaboradores atingido para o plano ${plano.plano_nome} (${plano.limite_colaboradores} colaboradores). Faça upgrade do seu plano para continuar cadastrando.`
        });
      }

      db.exec('BEGIN');
      try {
        const result = db.prepare(`
          INSERT INTO colaboradores (
            empresa_id, matricula, nome, email, telefone,
            cargo_id, departamento_id, gestor_id, data_admissao, status, foto
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          req.empresaId,
          matricula ? matricula.trim() : null,
          nome.trim(),
          email ? email.trim().toLowerCase() : null,
          telefone ? telefone.trim() : null,
          cargo_id ? parseInt(cargo_id, 10) : null,
          departamento_id ? parseInt(departamento_id, 10) : null,
          gestor_id ? parseInt(gestor_id, 10) : null,
          data_admissao || new Date().toISOString().split('T')[0],
          status || 'ativo',
          foto || null
        );

        const colaboradorId = result.lastInsertRowid;

        // Cria registro de crachá
        db.prepare(`
          INSERT INTO crachas_dados (
            colaborador_id, empresa_id, tipo_sanguineo, rg, cpf,
            data_nascimento, filiacao_pai, filiacao_mae,
            naturalidade_cidade, naturalidade_uf, pis_pasep, data_emissao
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          colaboradorId,
          req.empresaId,
          tipo_sanguineo || null,
          rg || null,
          cpf || null,
          data_nascimento || null,
          filiacao_pai || null,
          filiacao_mae || null,
          naturalidade_cidade || null,
          naturalidade_uf || null,
          pis_pasep || null,
          new Date().toISOString().split('T')[0]
        );

        // Registra histórico
        db.prepare(`
          INSERT INTO historico_movimentacoes (
            empresa_id, colaborador_id, colaborador_nome, usuario_id, usuario_nome, tipo, descricao
          ) VALUES (?, ?, ?, ?, ?, 'admissao', ?)
        `).run(
          req.empresaId,
          colaboradorId,
          nome.trim(),
          req.user.id,
          req.user.nome,
          `Admissão cadastrada por ${req.user.nome}`
        );

        db.exec('COMMIT');

        return res.status(201).json({
          success: true,
          message: 'Colaborador cadastrado com sucesso!',
          id: colaboradorId
        });
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    } catch (err) {
      console.error('Erro ao cadastrar colaborador:', err);
      return res.status(500).json({ error: 'Erro interno ao cadastrar colaborador.' });
    }
  },

  // Atualiza dados do colaborador
  async update(req, res) {
    try {
      const id = parseInt(req.params.id, 10);
      const {
        matricula, nome, email, telefone, cargo_id, departamento_id,
        gestor_id, data_admissao, status, foto,
        tipo_sanguineo, rg, cpf, data_nascimento, filiacao_pai, filiacao_mae,
        naturalidade_cidade, naturalidade_uf, pis_pasep
      } = req.body;

      const atual = db.prepare(`
        SELECT c.*, d.nome as dept_nome, cg.nome_cargo
        FROM colaboradores c
        LEFT JOIN departamentos d ON c.departamento_id = d.id
        LEFT JOIN cargos cg ON c.cargo_id = cg.id
        WHERE c.id = ? AND c.empresa_id = ?
      `).get(id, req.empresaId);

      if (!atual) {
        return res.status(404).json({ error: 'Colaborador não encontrado.' });
      }

      db.exec('BEGIN');
      try {
        db.prepare(`
          UPDATE colaboradores
          SET matricula = ?,
              nome = ?,
              email = ?,
              telefone = ?,
              cargo_id = ?,
              departamento_id = ?,
              gestor_id = ?,
              data_admissao = ?,
              status = ?,
              foto = COALESCE(?, foto)
          WHERE id = ? AND empresa_id = ?
        `).run(
          matricula || null,
          nome.trim(),
          email || null,
          telefone || null,
          cargo_id ? parseInt(cargo_id, 10) : null,
          departamento_id ? parseInt(departamento_id, 10) : null,
          gestor_id ? parseInt(gestor_id, 10) : null,
          data_admissao || atual.data_admissao,
          status || atual.status,
          foto || null,
          id,
          req.empresaId
        );

        // Atualiza crachá
        db.prepare(`
          INSERT INTO crachas_dados (
            colaborador_id, empresa_id, tipo_sanguineo, rg, cpf,
            data_nascimento, filiacao_pai, filiacao_mae,
            naturalidade_cidade, naturalidade_uf, pis_pasep, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(colaborador_id) DO UPDATE SET
            tipo_sanguineo = excluded.tipo_sanguineo,
            rg = excluded.rg,
            cpf = excluded.cpf,
            data_nascimento = excluded.data_nascimento,
            filiacao_pai = excluded.filiacao_pai,
            filiacao_mae = excluded.filiacao_mae,
            naturalidade_cidade = excluded.naturalidade_cidade,
            naturalidade_uf = excluded.naturalidade_uf,
            pis_pasep = excluded.pis_pasep,
            updated_at = CURRENT_TIMESTAMP
        `).run(
          id,
          req.empresaId,
          tipo_sanguineo || null,
          rg || null,
          cpf || null,
          data_nascimento || null,
          filiacao_pai || null,
          filiacao_mae || null,
          naturalidade_cidade || null,
          naturalidade_uf || null,
          pis_pasep || null
        );

        // Verifica se houve mudança de cargo ou departamento para auditoria
        const novoCargoId = cargo_id ? parseInt(cargo_id, 10) : null;
        const novoDeptId = departamento_id ? parseInt(departamento_id, 10) : null;

        if (atual.cargo_id !== novoCargoId || atual.departamento_id !== novoDeptId) {
          const novoDept = novoDeptId ? db.prepare('SELECT nome FROM departamentos WHERE id = ?').get(novoDeptId)?.nome : 'Nenhum';
          const novoCargo = novoCargoId ? db.prepare('SELECT nome_cargo FROM cargos WHERE id = ?').get(novoCargoId)?.nome_cargo : 'Nenhum';

          let desc = `Atualização de cadastro: `;
          if (atual.departamento_id !== novoDeptId) desc += `Setor (${atual.dept_nome || 'Nenhum'} ➔ ${novoDept}). `;
          if (atual.cargo_id !== novoCargoId) desc += `Cargo (${atual.nome_cargo || 'Nenhum'} ➔ ${novoCargo}).`;

          db.prepare(`
            INSERT INTO historico_movimentacoes (
              empresa_id, colaborador_id, colaborador_nome, usuario_id, usuario_nome, tipo, descricao
            ) VALUES (?, ?, ?, ?, ?, 'promocao', ?)
          `).run(req.empresaId, id, nome.trim(), req.user.id, req.user.nome, desc);
        }

        db.exec('COMMIT');
        return res.json({ success: true, message: 'Colaborador atualizado com sucesso!' });
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    } catch (err) {
      console.error('Erro ao atualizar colaborador:', err);
      return res.status(500).json({ error: 'Erro interno ao atualizar colaborador.' });
    }
  },

  // Movimentação Rápida de Setor
  async mover(req, res) {
    try {
      const id = parseInt(req.params.id, 10);
      const { departamento_id } = req.body;

      const colab = db.prepare(`
        SELECT c.*, d.nome as dept_origem
        FROM colaboradores c
        LEFT JOIN departamentos d ON c.departamento_id = d.id
        WHERE c.id = ? AND c.empresa_id = ?
      `).get(id, req.empresaId);

      if (!colab) {
        return res.status(404).json({ error: 'Colaborador não encontrado.' });
      }

      const novoDept = departamento_id ? db.prepare('SELECT nome FROM departamentos WHERE id = ? AND empresa_id = ?').get(departamento_id, req.empresaId) : null;
      const novoDeptNome = novoDept ? novoDept.nome : 'Sem departamento';

      db.prepare(`
        UPDATE colaboradores SET departamento_id = ? WHERE id = ? AND empresa_id = ?
      `).run(departamento_id ? parseInt(departamento_id, 10) : null, id, req.empresaId);

      // Registra no histórico
      db.prepare(`
        INSERT INTO historico_movimentacoes (
          empresa_id, colaborador_id, colaborador_nome, usuario_id, usuario_nome, tipo, descricao
        ) VALUES (?, ?, ?, ?, ?, 'transferencia', ?)
      `).run(
        req.empresaId,
        id,
        colab.nome,
        req.user.id,
        req.user.nome,
        `Transferência de setor: de "${colab.dept_origem || 'Sem setor'}" para "${novoDeptNome}"`
      );

      return res.json({ success: true, message: `Colaborador movido para ${novoDeptNome}!` });
    } catch (err) {
      console.error('Erro ao mover colaborador:', err);
      return res.status(500).json({ error: 'Erro interno ao mover colaborador.' });
    }
  },

  // Atualizar Foto
  async updatePhoto(req, res) {
    try {
      const id = parseInt(req.params.id, 10);
      const { foto } = req.body;

      db.prepare('UPDATE colaboradores SET foto = ? WHERE id = ? AND empresa_id = ?').run(foto || null, id, req.empresaId);
      return res.json({ success: true, message: 'Foto atualizada com sucesso!' });
    } catch (err) {
      console.error('Erro ao atualizar foto:', err);
      return res.status(500).json({ error: 'Erro interno ao atualizar foto.' });
    }
  },

  // Remover Colaborador
  async delete(req, res) {
    try {
      const id = parseInt(req.params.id, 10);
      const colab = db.prepare('SELECT nome FROM colaboradores WHERE id = ? AND empresa_id = ?').get(id, req.empresaId);
      if (!colab) {
        return res.status(404).json({ error: 'Colaborador não encontrado.' });
      }

      db.prepare(`
        INSERT INTO historico_movimentacoes (
          empresa_id, colaborador_id, colaborador_nome, usuario_id, usuario_nome, tipo, descricao
        ) VALUES (?, ?, ?, ?, ?, 'desligamento', ?)
      `).run(req.empresaId, id, colab.nome, req.user.id, req.user.nome, `Desligamento realizado por ${req.user.nome}`);

      db.prepare('DELETE FROM colaboradores WHERE id = ? AND empresa_id = ?').run(id, req.empresaId);
      return res.json({ success: true, message: 'Colaborador removido com sucesso.' });
    } catch (err) {
      console.error('Erro ao remover colaborador:', err);
      return res.status(500).json({ error: 'Erro interno ao remover colaborador.' });
    }
  },

  // Importação em Massa (CSV / Array de Objetos)
  async importBatch(req, res) {
    try {
      const { colaboradores } = req.body; // Array de { nome, email, departamento, cargo, matricula, telefone, ... }

      if (!Array.isArray(colaboradores) || colaboradores.length === 0) {
        return res.status(400).json({ error: 'Nenhum colaborador enviado para importação.' });
      }

      // Validação de Limite de Plano
      const plano = db.prepare(`
        SELECT p.limite_colaboradores, p.nome as plano_nome
        FROM empresas e
        JOIN planos p ON e.plano_id = p.id
        WHERE e.id = ?
      `).get(req.empresaId);

      const totalAtivos = db.prepare(`
        SELECT COUNT(*) as total FROM colaboradores
        WHERE empresa_id = ? AND status != 'desligado'
      `).get(req.empresaId).total;

      if (plano && (totalAtivos + colaboradores.length) > plano.limite_colaboradores) {
        return res.status(403).json({
          error: `A importação de ${colaboradores.length} pessoas ultrapassará o limite do plano ${plano.plano_nome} (máximo ${plano.limite_colaboradores} colaboradores). Atualmente você já possui ${totalAtivos}.`
        });
      }

      let inseridos = 0;
      db.exec('BEGIN');
      try {
        for (const item of colaboradores) {
          if (!item.nome || !item.nome.trim()) continue;

          // Resolve ou cria departamento
          let deptId = null;
          if (item.departamento && item.departamento.trim()) {
            const deptExistente = db.prepare('SELECT id FROM departamentos WHERE empresa_id = ? AND LOWER(nome) = LOWER(?)').get(req.empresaId, item.departamento.trim());
            if (deptExistente) {
              deptId = deptExistente.id;
            } else {
              const novoDept = db.prepare('INSERT INTO departamentos (empresa_id, nome, ordem) VALUES (?, ?, 10)').run(req.empresaId, item.departamento.trim());
              deptId = novoDept.lastInsertRowid;
            }
          }

          // Resolve ou cria cargo
          let cargoId = null;
          if (item.cargo && item.cargo.trim()) {
            const cargoExistente = db.prepare('SELECT id FROM cargos WHERE empresa_id = ? AND LOWER(nome_cargo) = LOWER(?)').get(req.empresaId, item.cargo.trim());
            if (cargoExistente) {
              cargoId = cargoExistente.id;
            } else {
              const novoCargo = db.prepare('INSERT INTO cargos (empresa_id, nome_cargo, nivel) VALUES (?, ?, "Geral")').run(req.empresaId, item.cargo.trim());
              cargoId = novoCargo.lastInsertRowid;
            }
          }

          const result = db.prepare(`
            INSERT INTO colaboradores (
              empresa_id, matricula, nome, email, telefone,
              cargo_id, departamento_id, data_admissao, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ativo')
          `).run(
            req.empresaId,
            item.matricula || null,
            item.nome.trim(),
            item.email || null,
            item.telefone || null,
            cargoId,
            deptId,
            item.data_admissao || new Date().toISOString().split('T')[0]
          );

          const colabId = result.lastInsertRowid;

          // Cria crachá
          db.prepare(`
            INSERT INTO crachas_dados (colaborador_id, empresa_id, tipo_sanguineo, rg, cpf, data_emissao)
            VALUES (?, ?, ?, ?, ?, ?)
          `).run(
            colabId,
            req.empresaId,
            item.tipo_sanguineo || null,
            item.rg || null,
            item.cpf || null,
            new Date().toISOString().split('T')[0]
          );

          inseridos++;
        }

        db.prepare(`
          INSERT INTO historico_movimentacoes (
            empresa_id, colaborador_nome, usuario_id, usuario_nome, tipo, descricao
          ) VALUES (?, 'Importação em Lote', ?, ?, 'admissao', ?)
        `).run(req.empresaId, req.user.id, req.user.nome, `Importação em massa de ${inseridos} colaboradores via planilha`);

        db.exec('COMMIT');
        return res.json({ success: true, message: `${inseridos} colaboradores importados com sucesso!` });
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    } catch (err) {
      console.error('Erro na importação em massa:', err);
      return res.status(500).json({ error: 'Erro interno ao processar importação.' });
    }
  },

  // Exportação CSV
  async exportCsv(req, res) {
    try {
      const colaboradores = db.prepare(`
        SELECT c.matricula, c.nome, c.email, c.telefone,
               d.nome as departamento, cg.nome_cargo as cargo, c.data_admissao, c.status,
               cr.tipo_sanguineo, cr.rg, cr.cpf
        FROM colaboradores c
        LEFT JOIN departamentos d ON c.departamento_id = d.id
        LEFT JOIN cargos cg ON c.cargo_id = cg.id
        LEFT JOIN crachas_dados cr ON cr.colaborador_id = c.id
        WHERE c.empresa_id = ?
        ORDER BY c.nome ASC
      `).all(req.empresaId);

      const header = ['Matrícula', 'Nome Completo', 'E-mail', 'Telefone', 'Departamento', 'Cargo', 'Data Admissão', 'Status', 'Tipo Sanguíneo', 'RG', 'CPF'];
      const rows = [header.join(';')];

      colaboradores.forEach(c => {
        rows.push([
          `"${c.matricula || ''}"`,
          `"${c.nome || ''}"`,
          `"${c.email || ''}"`,
          `"${c.telefone || ''}"`,
          `"${c.departamento || ''}"`,
          `"${c.cargo || ''}"`,
          `"${c.data_admissao || ''}"`,
          `"${c.status || ''}"`,
          `"${c.tipo_sanguineo || ''}"`,
          `"${c.rg || ''}"`,
          `"${c.cpf || ''}"`
        ].join(';'));
      });

      const csvContent = '\uFEFF' + rows.join('\r\n');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="colaboradores_${Date.now()}.csv"`);
      return res.send(csvContent);
    } catch (err) {
      console.error('Erro ao exportar CSV:', err);
      return res.status(500).json({ error: 'Erro interno ao exportar CSV.' });
    }
  }
};

module.exports = colaboradorController;
