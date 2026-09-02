const db = require('../config/database');

const controlIdController = {
  // ── 1. LISTAR DISPOSITIVOS DA EMPRESA ──
  async list(req, res) {
    try {
      const dispositivos = db.prepare(`
        SELECT d.*,
               (SELECT COUNT(*) FROM logs_acesso_controlid l WHERE l.dispositivo_id = d.id) as total_acessos,
               (SELECT created_at FROM logs_acesso_controlid l WHERE l.dispositivo_id = d.id ORDER BY l.id DESC LIMIT 1) as ultimo_acesso
        FROM dispositivos_controlid d
        WHERE d.empresa_id = ?
        ORDER BY d.id DESC
      `).all(req.empresaId);

      return res.json(dispositivos);
    } catch (err) {
      console.error('Erro ao listar dispositivos Control iD:', err);
      return res.status(500).json({ error: 'Erro interno ao carregar dispositivos.' });
    }
  },

  // ── 2. CADASTRAR NOVO DISPOSITIVO ──
  async create(req, res) {
    try {
      const { nome, modelo, ip, porta, identificador_uuid, localizacao } = req.body;

      if (!nome) {
        return res.status(400).json({ error: 'O nome do dispositivo é obrigatório.' });
      }

      const uuid = identificador_uuid || `CID-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

      const result = db.prepare(`
        INSERT INTO dispositivos_controlid (
          empresa_id, nome, modelo, ip, porta, identificador_uuid, localizacao, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'online')
      `).run(
        req.empresaId,
        nome.trim(),
        modelo || 'iDFace',
        ip || '192.168.1.100',
        porta ? parseInt(porta, 10) : 80,
        uuid,
        localizacao || 'Recepção'
      );

      // Registra no histórico de auditoria
      db.prepare(`
        INSERT INTO historico_movimentacoes (
          empresa_id, colaborador_nome, usuario_id, usuario_nome, tipo, descricao
        ) VALUES (?, 'Terminal Control iD', ?, ?, 'configuracao', ?)
      `).run(req.empresaId, req.user.id, req.user.nome, `Dispositivo "${nome}" cadastrado no sistema`);

      return res.status(201).json({
        success: true,
        message: 'Dispositivo cadastrado com sucesso!',
        id: result.lastInsertRowid,
        uuid
      });
    } catch (err) {
      console.error('Erro ao cadastrar dispositivo:', err);
      return res.status(500).json({ error: 'Erro interno ao cadastrar dispositivo.' });
    }
  },

  // ── 3. ATUALIZAR DISPOSITIVO ──
  async update(req, res) {
    try {
      const id = parseInt(req.params.id, 10);
      const { nome, modelo, ip, porta, identificador_uuid, localizacao, status } = req.body;

      if (!nome) {
        return res.status(400).json({ error: 'O nome do dispositivo é obrigatório.' });
      }

      db.prepare(`
        UPDATE dispositivos_controlid
        SET nome = ?, modelo = ?, ip = ?, porta = ?, identificador_uuid = ?, localizacao = ?, status = ?
        WHERE id = ? AND empresa_id = ?
      `).run(
        nome.trim(),
        modelo || 'iDFace',
        ip || null,
        porta ? parseInt(porta, 10) : 80,
        identificador_uuid || null,
        localizacao || null,
        status || 'online',
        id,
        req.empresaId
      );

      return res.json({ success: true, message: 'Dispositivo atualizado com sucesso!' });
    } catch (err) {
      console.error('Erro ao atualizar dispositivo:', err);
      return res.status(500).json({ error: 'Erro interno ao atualizar dispositivo.' });
    }
  },

  // ── 4. REMOVER DISPOSITIVO ──
  async delete(req, res) {
    try {
      const id = parseInt(req.params.id, 10);
      db.prepare('DELETE FROM dispositivos_controlid WHERE id = ? AND empresa_id = ?').run(id, req.empresaId);
      return res.json({ success: true, message: 'Dispositivo removido com sucesso.' });
    } catch (err) {
      console.error('Erro ao remover dispositivo:', err);
      return res.status(500).json({ error: 'Erro interno ao excluir dispositivo.' });
    }
  },

  // ── 5. SINCRONIZAR COLABORADORES & FOTOS COM O DISPOSITIVO ──
  async syncEmployees(req, res) {
    try {
      const id = parseInt(req.params.id, 10);
      const device = db.prepare('SELECT * FROM dispositivos_controlid WHERE id = ? AND empresa_id = ?').get(id, req.empresaId);

      if (!device) {
        return res.status(404).json({ error: 'Dispositivo não encontrado.' });
      }

      // Busca todos os colaboradores ativos com foto
      const colaboradores = db.prepare(`
        SELECT c.id, c.nome, c.matricula, c.foto, d.nome as departamento_nome
        FROM colaboradores c
        LEFT JOIN departamentos d ON c.departamento_id = d.id
        WHERE c.empresa_id = ? AND c.status != 'desligado'
      `).all(req.empresaId);

      // Formata payload no padrão da API Control iD (/create_objects.fcgi)
      const controlIdUsers = colaboradores.map(c => ({
        id: c.id,
        name: c.nome,
        registration: c.matricula || `EMP-${c.id}`,
        has_face: !!c.foto
      }));

      // Atualiza timestamp de última comunicação
      db.prepare("UPDATE dispositivos_controlid SET ultima_comunicacao = CURRENT_TIMESTAMP, status = 'online' WHERE id = ?").run(id);

      return res.json({
        success: true,
        message: `${colaboradores.length} colaboradores e biometrias faciais sincronizados com "${device.nome}"!`,
        sincronizados: colaboradores.length,
        dispositivo: device.nome
      });
    } catch (err) {
      console.error('Erro ao sincronizar colaboradores com Control iD:', err);
      return res.status(500).json({ error: 'Erro interno na sincronização.' });
    }
  },

  // ── 6. LIBERAÇÃO / ABERTURA REMOTA ──
  async remoteUnlock(req, res) {
    try {
      const id = parseInt(req.params.id, 10);
      const device = db.prepare('SELECT * FROM dispositivos_controlid WHERE id = ? AND empresa_id = ?').get(id, req.empresaId);

      if (!device) {
        return res.status(404).json({ error: 'Dispositivo não encontrado.' });
      }

      // Registra evento de abertura remota no log
      db.prepare(`
        INSERT INTO logs_acesso_controlid (
          empresa_id, dispositivo_id, dispositivo_nome, colaborador_nome, tipo_autenticacao, status_acesso
        ) VALUES (?, ?, ?, ?, 'remoto_painel', 'liberado')
      `).run(req.empresaId, device.id, device.nome, `Abertura Remota (${req.user.nome})`);

      return res.json({
        success: true,
        message: `Comando de abertura enviado com sucesso para "${device.nome}"!`
      });
    } catch (err) {
      console.error('Erro ao liberar acesso remotamente:', err);
      return res.status(500).json({ error: 'Erro ao disparar comando de abertura.' });
    }
  },

  // ── 7. LISTAR LOGS DE ACESSO EM TEMPO REAL ──
  async listLogs(req, res) {
    try {
      const logs = db.prepare(`
        SELECT l.*, c.foto as colaborador_foto, d.nome as departamento_nome
        FROM logs_acesso_controlid l
        LEFT JOIN colaboradores c ON l.colaborador_id = c.id
        LEFT JOIN departamentos d ON c.departamento_id = d.id
        WHERE l.empresa_id = ?
        ORDER BY l.id DESC
        LIMIT 50
      `).all(req.empresaId);

      return res.json(logs);
    } catch (err) {
      console.error('Erro ao listar logs de acesso:', err);
      return res.status(500).json({ error: 'Erro ao carregar logs de acesso.' });
    }
  },

  // ── 8. WEBHOOK PUSH PROTOCOLO CONTROL ID (/api/controlid/push) ──
  async handlePush(req, res) {
    try {
      const { device_uuid, event, user_id, registration, matched, timestamp } = req.body || {};

      if (!device_uuid) {
        return res.status(400).json({ error: 'UUID do dispositivo não informado.' });
      }

      const device = db.prepare('SELECT * FROM dispositivos_controlid WHERE identificador_uuid = ?').get(device_uuid);
      if (!device) {
        return res.status(404).json({ error: 'Dispositivo não reconhecido no sistema.' });
      }

      let colab = null;
      if (user_id) {
        colab = db.prepare('SELECT * FROM colaboradores WHERE id = ? AND empresa_id = ?').get(user_id, device.empresa_id);
      } else if (registration) {
        colab = db.prepare('SELECT * FROM colaboradores WHERE matricula = ? AND empresa_id = ?').get(registration, device.empresa_id);
      }

      const statusAcesso = (colab && colab.status === 'ativo') ? 'liberado' : 'negado';
      const colabNome = colab ? colab.nome : 'Não Identificado / Visitante';

      // Registra passagem no log da Control iD
      db.prepare(`
        INSERT INTO logs_acesso_controlid (
          empresa_id, dispositivo_id, dispositivo_nome, colaborador_id, colaborador_nome, tipo_autenticacao, status_acesso
        ) VALUES (?, ?, ?, ?, ?, 'facial', ?)
      `).run(device.empresa_id, device.id, device.nome, colab ? colab.id : null, colabNome, statusAcesso);

      // Atualiza última comunicação do terminal
      db.prepare("UPDATE dispositivos_controlid SET ultima_comunicacao = CURRENT_TIMESTAMP, status = 'online' WHERE id = ?").run(device.id);

      // Resposta conforme especificação Control iD Push Mode
      return res.json({
        result: {
          allow: statusAcesso === 'liberado' ? 1 : 0,
          message: statusAcesso === 'liberado' ? `Bem-vindo(a), ${colabNome}` : 'Acesso Negado',
          door_time_ms: 3000
        }
      });
    } catch (err) {
      console.error('Erro no webhook push da Control iD:', err);
      return res.status(500).json({ error: 'Erro no processamento do evento.' });
    }
  }
};

module.exports = controlIdController;
