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
      const { colaboradores, departamentos, cargos, empresa } = req.body;

      db.exec('BEGIN');
      try {
        // 0. Atualiza dados da empresa se fornecidos pelo cache do cliente
        if (empresa && (empresa.nome_fantasia || empresa.razao_social)) {
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
            empresa.nome_fantasia || null,
            empresa.razao_social || null,
            empresa.cnpj || null,
            empresa.email_contato || null,
            empresa.telefone_contato || null,
            empresa.logo_url || null,
            empresa.cor_primaria || null,
            req.empresaId
          );
        }

        // 1. Departamentos - Pass 1: Inserção e Mapeamento de IDs
        const deptMap = {};
        const deptOldIdMap = {};
        if (Array.isArray(departamentos)) {
          for (const d of departamentos) {
            if (!d || !d.nome || !String(d.nome).trim()) continue;
            const nomeTrim = String(d.nome).trim();
            const existing = db.prepare('SELECT id FROM departamentos WHERE empresa_id = ? AND LOWER(nome) = LOWER(?)').get(req.empresaId, nomeTrim);
            let dId;
            if (!existing) {
              const r = db.prepare(`
                INSERT INTO departamentos (empresa_id, nome, sigla, ramal, cor, ordem)
                VALUES (?, ?, ?, ?, ?, ?)
              `).run(req.empresaId, nomeTrim, d.sigla || null, d.ramal || null, d.cor || '#2563eb', d.ordem || 1);
              dId = r.lastInsertRowid;
            } else {
              dId = existing.id;
              db.prepare(`
                UPDATE departamentos
                SET sigla = COALESCE(?, sigla),
                    ramal = COALESCE(?, ramal),
                    cor = COALESCE(?, cor),
                    ordem = COALESCE(?, ordem)
                WHERE id = ? AND empresa_id = ?
              `).run(d.sigla || null, d.ramal || null, d.cor || null, d.ordem || null, dId, req.empresaId);
            }
            deptMap[nomeTrim.toLowerCase()] = dId;
            if (d.id) deptOldIdMap[d.id] = dId;
          }
        }

        // 2. Cargos - Pass 1: Inserção e Mapeamento de IDs
        const cargoMap = {};
        const cargoOldIdMap = {};
        if (Array.isArray(cargos)) {
          for (const cg of cargos) {
            const cargoNome = cg.nome_cargo || cg.nome;
            if (!cg || !cargoNome || !String(cargoNome).trim()) continue;
            const cargoTrim = String(cargoNome).trim();
            const existing = db.prepare('SELECT id FROM cargos WHERE empresa_id = ? AND LOWER(nome_cargo) = LOWER(?)').get(req.empresaId, cargoTrim);
            let cgId;
            if (!existing) {
              const r = db.prepare(`
                INSERT INTO cargos (empresa_id, nome_cargo, nivel, cbo, descricao)
                VALUES (?, ?, ?, ?, ?)
              `).run(req.empresaId, cargoTrim, cg.nivel || 'Pleno', cg.cbo || null, cg.descricao || null);
              cgId = r.lastInsertRowid;
            } else {
              cgId = existing.id;
              db.prepare(`
                UPDATE cargos
                SET nivel = COALESCE(?, nivel),
                    cbo = COALESCE(?, cbo),
                    descricao = COALESCE(?, descricao)
                WHERE id = ? AND empresa_id = ?
              `).run(cg.nivel || null, cg.cbo || null, cg.descricao || null, cgId, req.empresaId);
            }
            cargoMap[cargoTrim.toLowerCase()] = cgId;
            if (cg.id) cargoOldIdMap[cg.id] = cgId;
          }
        }

        // 3. Departamentos - Pass 2: Vinculação Hierárquica de Setores (parent_id)
        if (Array.isArray(departamentos)) {
          for (const d of departamentos) {
            if (!d || !d.nome) continue;
            const currentDeptId = deptMap[d.nome.trim().toLowerCase()];
            if (!currentDeptId) continue;

            let parentId = null;
            if (d.parent_nome) {
              parentId = deptMap[d.parent_nome.trim().toLowerCase()] || null;
            } else if (d.parent_id) {
              parentId = deptOldIdMap[d.parent_id] || (db.prepare('SELECT id FROM departamentos WHERE id = ? AND empresa_id = ?').get(d.parent_id, req.empresaId)?.id) || null;
            }

            if (parentId && parentId === currentDeptId) {
              parentId = null;
            }

            db.prepare('UPDATE departamentos SET parent_id = ? WHERE id = ? AND empresa_id = ?').run(parentId, currentDeptId, req.empresaId);
          }
        }

        // 4. Colaboradores - Pass 1: Inserção e Atualização Básica
        const colabMap = {};
        const colabOldIdMap = {};
        if (Array.isArray(colaboradores)) {
          for (const c of colaboradores) {
            if (!c || !c.nome || !String(c.nome).trim()) continue;
            const nomeTrim = String(c.nome).trim();

            // 1. Resolução segura de Departamento (garante integridade referencial)
            let deptId = null;
            const deptNome = (c.departamento_nome || (c.departamento && c.departamento.nome) || '').trim();
            if (deptNome) {
              if (deptMap[deptNome.toLowerCase()]) {
                deptId = deptMap[deptNome.toLowerCase()];
              } else {
                const existing = db.prepare('SELECT id FROM departamentos WHERE empresa_id = ? AND LOWER(nome) = LOWER(?)').get(req.empresaId, deptNome);
                if (existing) {
                  deptId = existing.id;
                } else {
                  const r = db.prepare('INSERT INTO departamentos (empresa_id, nome, cor) VALUES (?, ?, ?)').run(req.empresaId, deptNome, c.departamento_cor || '#2563eb');
                  deptId = r.lastInsertRowid;
                }
                deptMap[deptNome.toLowerCase()] = deptId;
              }
            } else if (c.departamento_id) {
              deptId = deptOldIdMap[c.departamento_id] || (db.prepare('SELECT id FROM departamentos WHERE id = ? AND empresa_id = ?').get(c.departamento_id, req.empresaId)?.id) || null;
            }

            // 2. Resolução segura de Cargo (garante integridade referencial)
            let cargoId = null;
            const cargoNome = (c.nome_cargo || (c.cargo && c.cargo.nome_cargo) || '').trim();
            if (cargoNome) {
              if (cargoMap[cargoNome.toLowerCase()]) {
                cargoId = cargoMap[cargoNome.toLowerCase()];
              } else {
                const existing = db.prepare('SELECT id FROM cargos WHERE empresa_id = ? AND LOWER(nome_cargo) = LOWER(?)').get(req.empresaId, cargoNome);
                if (existing) {
                  cargoId = existing.id;
                } else {
                  const r = db.prepare("INSERT INTO cargos (empresa_id, nome_cargo, nivel) VALUES (?, ?, ?)").run(req.empresaId, cargoNome, c.cargo_nivel || 'Pleno');
                  cargoId = r.lastInsertRowid;
                }
                cargoMap[cargoNome.toLowerCase()] = cargoId;
              }
            } else if (c.cargo_id) {
              cargoId = cargoOldIdMap[c.cargo_id] || (db.prepare('SELECT id FROM cargos WHERE id = ? AND empresa_id = ?').get(c.cargo_id, req.empresaId)?.id) || null;
            }

            // 3. Verificação de colaborador existente
            let existingColab = null;
            const matriculaClean = c.matricula && String(c.matricula).trim() ? String(c.matricula).trim() : null;
            if (matriculaClean) {
              existingColab = db.prepare('SELECT id FROM colaboradores WHERE empresa_id = ? AND matricula = ?').get(req.empresaId, matriculaClean);
            }
            if (!existingColab) {
              existingColab = db.prepare('SELECT id FROM colaboradores WHERE empresa_id = ? AND LOWER(nome) = LOWER(?)').get(req.empresaId, nomeTrim);
            }

            let colabId = null;
            if (!existingColab) {
              const r = db.prepare(`
                INSERT INTO colaboradores (empresa_id, matricula, nome, email, telefone, cargo_id, departamento_id, data_admissao, status, foto)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              `).run(
                req.empresaId,
                matriculaClean,
                nomeTrim,
                c.email || null,
                c.telefone || null,
                cargoId,
                deptId,
                c.data_admissao || new Date().toISOString().split('T')[0],
                c.status || 'ativo',
                c.foto || null
              );
              colabId = r.lastInsertRowid;
            } else {
              colabId = existingColab.id;
              db.prepare(`
                UPDATE colaboradores 
                SET cargo_id = COALESCE(?, cargo_id),
                    departamento_id = COALESCE(?, departamento_id),
                    foto = COALESCE(?, foto),
                    status = COALESCE(?, status)
                WHERE id = ? AND empresa_id = ?
              `).run(cargoId, deptId, c.foto || null, c.status || null, colabId, req.empresaId);
            }

            colabMap[nomeTrim.toLowerCase()] = colabId;
            if (c.id) colabOldIdMap[c.id] = colabId;

            // 4. Crachá e dados complementares
            if (colabId && (c.cpf || c.rg || c.pis_pasep || c.tipo_sanguineo)) {
              const hasCracha = db.prepare('SELECT id FROM crachas_dados WHERE colaborador_id = ? AND empresa_id = ?').get(colabId, req.empresaId);
              if (!hasCracha) {
                try {
                  db.prepare(`
                    INSERT INTO crachas_dados (colaborador_id, empresa_id, tipo_sanguineo, rg, cpf, pis_pasep, data_emissao)
                    VALUES (?, ?, ?, ?, ?, ?, date('now'))
                  `).run(colabId, req.empresaId, c.tipo_sanguineo || 'O+', c.rg || null, c.cpf || null, c.pis_pasep || null);
                } catch (errCracha) {
                  console.warn('Aviso: cracha_dados ignorado na re-hidratação:', errCracha.message);
                }
              }
            }
          }
        }

        // 5. Colaboradores - Pass 2: Vinculação Hierárquica de Líderes (gestor_id)
        if (Array.isArray(colaboradores)) {
          for (const c of colaboradores) {
            if (!c || !c.nome) continue;
            const currentColabId = colabMap[c.nome.trim().toLowerCase()];
            if (!currentColabId) continue;

            let gestorId = null;
            if (c.gestor_nome) {
              gestorId = colabMap[c.gestor_nome.trim().toLowerCase()] || null;
            } else if (c.gestor_id) {
              gestorId = colabOldIdMap[c.gestor_id] || (db.prepare('SELECT id FROM colaboradores WHERE id = ? AND empresa_id = ?').get(c.gestor_id, req.empresaId)?.id) || null;
            }

            if (gestorId && gestorId !== currentColabId) {
              db.prepare('UPDATE colaboradores SET gestor_id = ? WHERE id = ? AND empresa_id = ?').run(gestorId, currentColabId, req.empresaId);
            }
          }
        }

        // 6. Departamentos - Pass 3: Vinculação de Responsável / Líder (responsavel_id)
        if (Array.isArray(departamentos)) {
          for (const d of departamentos) {
            if (!d || !d.nome) continue;
            const currentDeptId = deptMap[d.nome.trim().toLowerCase()];
            if (!currentDeptId) continue;

            let respId = null;
            if (d.responsavel_nome) {
              respId = colabMap[d.responsavel_nome.trim().toLowerCase()] || null;
            } else if (d.responsavel_id) {
              respId = colabOldIdMap[d.responsavel_id] || (db.prepare('SELECT id FROM colaboradores WHERE id = ? AND empresa_id = ?').get(d.responsavel_id, req.empresaId)?.id) || null;
            }

            if (respId) {
              db.prepare('UPDATE departamentos SET responsavel_id = ? WHERE id = ? AND empresa_id = ?').run(respId, currentDeptId, req.empresaId);
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
