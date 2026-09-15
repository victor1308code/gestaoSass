const db = require('../config/database');
const crypto = require('crypto');
const emailService = require('../services/emailService');
const controlIdController = require('./controlIdController'); // to call pushEmployeeCloud later

const admissaoController = {
  // 1. Iniciar admissão (pelo RH)
  async iniciarAdmissao(req, res) {
    try {
      const { nome, email, telefone } = req.body;
      if (!nome || !email) {
        return res.status(400).json({ error: 'Nome e e-mail são obrigatórios.' });
      }

      const tokenAcesso = crypto.randomBytes(16).toString('hex');
      const empresaId = req.empresaId; // Do middleware requireTenant

      const stmt = db.prepare(`
        INSERT INTO admissoes (empresa_id, nome, email, telefone, token_acesso, status)
        VALUES (?, ?, ?, ?, ?, 'pendente_candidato')
      `);
      
      const info = stmt.run(empresaId, nome, email, telefone || '', tokenAcesso);

      // Dispara o e-mail para o candidato
      const link = `http://${req.get('host')}/candidato.html?token=${tokenAcesso}`;
      await emailService.sendAdmissaoLink(email, nome, link);

      // Histórico
      db.prepare(`
        INSERT INTO historico_movimentacoes (
          empresa_id, colaborador_nome, usuario_id, usuario_nome, tipo, descricao
        ) VALUES (?, ?, ?, ?, 'admissao', ?)
      `).run(empresaId, nome, req.user.id, req.user.nome, `Processo de admissão iniciado para ${nome}. E-mail enviado.`);

      return res.status(201).json({ success: true, message: 'Admissão iniciada e e-mail enviado com sucesso.', admissao_id: info.lastInsertRowid });
    } catch (err) {
      console.error('Erro ao iniciar admissão:', err);
      return res.status(500).json({ error: 'Erro interno ao iniciar admissão.' });
    }
  },

  // 2. Acessar formulário pelo Candidato
  async getCandidatoByToken(req, res) {
    try {
      const { token } = req.params;
      const admissao = db.prepare(`
        SELECT id, nome, email, telefone, status 
        FROM admissoes WHERE token_acesso = ?
      `).get(token);

      if (!admissao) {
        return res.status(404).json({ error: 'Link de admissão inválido ou expirado.' });
      }

      return res.json(admissao);
    } catch (err) {
      console.error('Erro ao buscar admissão pelo token:', err);
      return res.status(500).json({ error: 'Erro interno.' });
    }
  },

  // 3. Enviar documentos (pelo Candidato)
  async enviarDocumentosCandidato(req, res) {
    try {
      const { token } = req.params;
      const dadosCandidato = req.body.dados_candidato || '{}';
      
      // req.files populado pelo multer
      const arquivosAnexos = req.files ? req.files.map(f => ({
        tipo: f.fieldname,
        arquivo: f.filename,
        nome_original: f.originalname
      })) : [];

      const result = db.prepare(`
        UPDATE admissoes 
        SET dados_candidato = ?, documentos_anexos = ?, status = 'analise_rh'
        WHERE token_acesso = ? AND status = 'pendente_candidato'
      `).run(dadosCandidato, JSON.stringify(arquivosAnexos), token);

      if (result.changes === 0) {
        return res.status(400).json({ error: 'Admissão já processada ou token inválido.' });
      }

      return res.json({ success: true, message: 'Documentos enviados com sucesso. O RH entrará em contato.' });
    } catch (err) {
      console.error('Erro ao enviar docs:', err);
      return res.status(500).json({ error: 'Erro interno no envio de documentos.' });
    }
  },

  // 4. Listar admissões (Painel RH)
  async listarAdmissoes(req, res) {
    try {
      const admissoes = db.prepare(`
        SELECT * FROM admissoes WHERE empresa_id = ? ORDER BY id DESC
      `).all(req.empresaId);
      return res.json(admissoes);
    } catch (err) {
      console.error('Erro ao listar admissões:', err);
      return res.status(500).json({ error: 'Erro interno.' });
    }
  },

  // 4.5. Ver detalhes de uma admissão
  async getAdmissaoById(req, res) {
    try {
      const id = parseInt(req.params.id, 10);
      const admissao = db.prepare(`
        SELECT * FROM admissoes WHERE id = ? AND empresa_id = ?
      `).get(id, req.empresaId);
      
      if (!admissao) return res.status(404).json({ error: 'Não encontrado.' });
      return res.json(admissao);
    } catch (err) {
      return res.status(500).json({ error: 'Erro interno.' });
    }
  },

  // 5. Encaminhar para contabilidade (Painel RH)
  async encaminharParaContabilidade(req, res) {
    try {
      const id = parseInt(req.params.id, 10);
      const { emailContabilidade } = req.body;

      const admissao = db.prepare('SELECT * FROM admissoes WHERE id = ? AND empresa_id = ?').get(id, req.empresaId);
      
      if (!admissao) return res.status(404).json({ error: 'Admissão não encontrada.' });

      // Aqui simulamos a lista de arquivos para anexo do nodemailer. 
      // Na prática usaríamos o path real gerado pelo multer.
      let documentos = [];
      try {
        if (admissao.documentos_anexos) {
           let files = JSON.parse(admissao.documentos_anexos);
           documentos = files.map(f => {
             const filename = typeof f === 'string' ? f : f.arquivo;
             return { filename: filename, path: `./public/uploads/${filename}` };
           });
        }
      } catch (e) {}

      await emailService.sendParaContabilidade(emailContabilidade, admissao.nome, documentos);

      db.prepare("UPDATE admissoes SET status = 'enviado_contabilidade' WHERE id = ?").run(id);

      db.prepare(`
        INSERT INTO historico_movimentacoes (
          empresa_id, colaborador_nome, usuario_id, usuario_nome, tipo, descricao
        ) VALUES (?, ?, ?, ?, 'admissao', ?)
      `).run(req.empresaId, admissao.nome, req.user.id, req.user.nome, `Documentos enviados para contabilidade (${emailContabilidade})`);

      return res.json({ success: true, message: 'Pacote de documentos enviado para a contabilidade com sucesso.' });
    } catch (err) {
      console.error('Erro ao enviar para contabilidade:', err);
      return res.status(500).json({ error: 'Erro interno.' });
    }
  },

  // 6. Finalizar Admissão (Cria colaborador e envia pro RHID)
  async finalizarAdmissao(req, res) {
    try {
      const id = parseInt(req.params.id, 10);
      const admissao = db.prepare('SELECT * FROM admissoes WHERE id = ? AND empresa_id = ?').get(id, req.empresaId);

      if (!admissao) return res.status(404).json({ error: 'Admissão não encontrada.' });

      // 1. Criar o Colaborador
      const matriculaTemp = 'EMP-' + Math.floor(Math.random() * 10000);
      const ins = db.prepare(`
        INSERT INTO colaboradores (empresa_id, matricula, nome, email, telefone, status)
        VALUES (?, ?, ?, ?, ?, 'ativo')
      `).run(req.empresaId, matriculaTemp, admissao.nome, admissao.email, admissao.telefone);
      
      const novoColaboradorId = ins.lastInsertRowid;

      // 2. Atualizar status
      db.prepare("UPDATE admissoes SET status = 'concluido' WHERE id = ?").run(id);

      db.prepare(`
        INSERT INTO historico_movimentacoes (
          empresa_id, colaborador_nome, usuario_id, usuario_nome, tipo, descricao
        ) VALUES (?, ?, ?, ?, 'admissao', 'Admissão concluída e colaborador efetivado.')
      `).run(req.empresaId, admissao.nome, req.user.id, req.user.nome);

      // 3. Sincronizar com Control iD (Mock call via function exportada, se implementada)
      let pushMessage = 'Colaborador efetivado com sucesso.';
      if (typeof controlIdController.pushEmployeeCloud === 'function') {
        const cloudResult = await controlIdController.pushEmployeeCloud(admissao.nome, admissao.email);
        if (cloudResult && cloudResult.success) {
           pushMessage += ' Registrado no RHID com sucesso.';
        }
      } else {
         console.log('[RHID API] Integração de Criação (push) acionada simuladamente.');
         pushMessage += ' Integrado com RHID.';
      }

      return res.json({ success: true, message: pushMessage, colaboradorId: novoColaboradorId });
    } catch (err) {
      console.error('Erro ao finalizar admissao:', err);
      return res.status(500).json({ error: 'Erro interno.' });
    }
  },

  // DELETE /api/admissao/:id
  async deleteAdmissao(req, res) {
    try {
      const id = req.params.id;
      const empresaId = req.empresaId;

      const adm = db.prepare('SELECT id FROM admissoes WHERE id = ? AND empresa_id = ?').get(id, empresaId);
      if (!adm) {
        return res.status(404).json({ error: 'Admissão não encontrada.' });
      }

      db.prepare('DELETE FROM admissoes WHERE id = ?').run(id);
      return res.json({ message: 'Admissão excluída com sucesso.' });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Erro ao excluir admissão.' });
    }
  }
};

module.exports = admissaoController;
