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
  },

  // Re-hidrata dados a partir do cache do cliente (resiliência para Serverless na Vercel)
  async rehydrate(req, res) {
    try {
      const { colaboradores, departamentos, cargos } = req.body;

      db.exec('BEGIN');
      try {
        const deptMap = {};
        if (Array.isArray(departamentos)) {
          for (const d of departamentos) {
            if (!d.nome) continue;
            const existing = db.prepare('SELECT id FROM departamentos WHERE empresa_id = ? AND LOWER(nome) = LOWER(?)').get(req.empresaId, d.nome.trim());
            if (!existing) {
              const r = db.prepare(`
                INSERT INTO departamentos (empresa_id, nome, sigla, ramal, cor, ordem)
                VALUES (?, ?, ?, ?, ?, ?)
              `).run(req.empresaId, d.nome.trim(), d.sigla || null, d.ramal || null, d.cor || '#2563eb', d.ordem || 1);
              deptMap[d.nome.toLowerCase()] = r.lastInsertRowid;
            } else {
              deptMap[d.nome.toLowerCase()] = existing.id;
            }
          }
        }

        const cargoMap = {};
        if (Array.isArray(cargos)) {
          for (const cg of cargos) {
            if (!cg.nome_cargo) continue;
            const existing = db.prepare('SELECT id FROM cargos WHERE empresa_id = ? AND LOWER(nome_cargo) = LOWER(?)').get(req.empresaId, cg.nome_cargo.trim());
            if (!existing) {
              const r = db.prepare(`
                INSERT INTO cargos (empresa_id, nome_cargo, nivel, cbo, descricao)
                VALUES (?, ?, ?, ?, ?)
              `).run(req.empresaId, cg.nome_cargo.trim(), cg.nivel || 'Pleno', cg.cbo || null, cg.descricao || null);
              cargoMap[cg.nome_cargo.toLowerCase()] = r.lastInsertRowid;
            } else {
              cargoMap[cg.nome_cargo.toLowerCase()] = existing.id;
            }
          }
        }

        if (Array.isArray(colaboradores)) {
          for (const c of colaboradores) {
            if (!c.nome) continue;

            let deptId = c.departamento_id;
            if (!deptId && c.departamento_nome) {
              deptId = deptMap[c.departamento_nome.toLowerCase()];
              if (!deptId) {
                const existing = db.prepare('SELECT id FROM departamentos WHERE empresa_id = ? AND LOWER(nome) = LOWER(?)').get(req.empresaId, c.departamento_nome.trim());
                deptId = existing ? existing.id : db.prepare('INSERT INTO departamentos (empresa_id, nome) VALUES (?, ?)').run(req.empresaId, c.departamento_nome.trim()).lastInsertRowid;
                deptMap[c.departamento_nome.toLowerCase()] = deptId;
              }
            }

            let cargoId = c.cargo_id;
            if (!cargoId && c.nome_cargo) {
              cargoId = cargoMap[c.nome_cargo.toLowerCase()];
              if (!cargoId) {
                const existing = db.prepare('SELECT id FROM cargos WHERE empresa_id = ? AND LOWER(nome_cargo) = LOWER(?)').get(req.empresaId, c.nome_cargo.trim());
                cargoId = existing ? existing.id : db.prepare("INSERT INTO cargos (empresa_id, nome_cargo, nivel) VALUES (?, ?, 'Pleno')").run(req.empresaId, c.nome_cargo.trim()).lastInsertRowid;
                cargoMap[c.nome_cargo.toLowerCase()] = cargoId;
              }
            }

            const existing = db.prepare('SELECT id FROM colaboradores WHERE empresa_id = ? AND (nome = ? OR (matricula IS NOT NULL AND matricula = ?))').get(req.empresaId, c.nome.trim(), c.matricula || '');
            let colabId = existing ? existing.id : null;

            if (!existing) {
              const r = db.prepare(`
                INSERT INTO colaboradores (empresa_id, matricula, nome, email, telefone, cargo_id, departamento_id, data_admissao, status, foto)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              `).run(
                req.empresaId,
                c.matricula || null,
                c.nome.trim(),
                c.email || null,
                c.telefone || null,
                cargoId || null,
                deptId || null,
                c.data_admissao || new Date().toISOString().split('T')[0],
                c.status || 'ativo',
                c.foto || null
              );
              colabId = r.lastInsertRowid;
            }

            if (colabId && (c.cpf || c.rg || c.pis_pasep || c.tipo_sanguineo)) {
              const hasCracha = db.prepare('SELECT id FROM crachas_dados WHERE colaborador_id = ? AND empresa_id = ?').get(colabId, req.empresaId);
              if (!hasCracha) {
                db.prepare(`
                  INSERT INTO crachas_dados (colaborador_id, empresa_id, tipo_sanguineo, rg, cpf, pis_pasep, data_emissao)
                  VALUES (?, ?, ?, ?, ?, ?, CURRENT_DATE)
                `).run(colabId, req.empresaId, c.tipo_sanguineo || 'O+', c.rg || null, c.cpf || null, c.pis_pasep || null);
              }
            }
          }
        }

        db.exec('COMMIT');
        return res.json({ success: true, message: 'Dados re-hidratados com sucesso!' });
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }
    } catch (err) {
      console.error('Erro na re-hidratação:', err);
      return res.status(500).json({ error: 'Erro interno na re-hidratação.' });
    }
  },

  // Reset total dos dados de teste da empresa
  async resetTestData(req, res) {
    try {
      db.exec('BEGIN');
      try {
        db.prepare('DELETE FROM crachas_dados WHERE empresa_id = ?').run(req.empresaId);
        db.prepare('DELETE FROM historico_movimentacoes WHERE empresa_id = ?').run(req.empresaId);
        db.prepare('DELETE FROM colaboradores WHERE empresa_id = ?').run(req.empresaId);
        db.prepare('DELETE FROM cargos WHERE empresa_id = ?').run(req.empresaId);
        db.prepare('DELETE FROM departamentos WHERE empresa_id = ?').run(req.empresaId);
        db.prepare('DELETE FROM dispositivos_controlid WHERE empresa_id = ?').run(req.empresaId);
        db.exec('COMMIT');
        return res.json({ success: true, message: 'Dados da empresa resetados com sucesso para 0.' });
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    } catch (err) {
      console.error('Erro ao resetar dados:', err);
      return res.status(500).json({ error: 'Erro interno ao resetar dados.' });
    }
  }
};

module.exports = empresaController;
