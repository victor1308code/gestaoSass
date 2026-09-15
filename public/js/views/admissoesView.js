const AdmissoesView = {
  name: 'admissoes',
  title: 'Admissões Digitais',
  breadcrumb: 'Cadastros / Admissões',

  async render(container) {
    container.innerHTML = `
      <div id="smtp-warning-container"></div>
      <div style="display:flex; justify-content:space-between; margin-bottom:20px;">
        <div>
          <h2>Gestão de Admissões</h2>
          <p style="color:#6b7280; font-size:14px;">Acompanhe o status dos candidatos.</p>
        </div>
        <div>
          <button class="btn btn-primary" onclick="AdmissoesView.abrirModalNova()">+ Nova Admissão</button>
        </div>
      </div>

      <div class="card" style="padding:0;">
        <table class="data-table" style="width:100%; text-align:left; border-collapse:collapse;">
          <thead style="background:#f8fafc; border-bottom:1px solid #e2e8f0;">
            <tr>
              <th style="padding:15px;">Candidato</th>
              <th style="padding:15px;">E-mail</th>
              <th style="padding:15px;">Status</th>
              <th style="padding:15px;">Ações</th>
            </tr>
          </thead>
          <tbody id="admissoes-tbody">
            <tr><td colspan="4" style="padding:15px; text-align:center;">Carregando...</td></tr>
          </tbody>
        </table>
      </div>
    `;

    // Checa se o e-mail está configurado
    try {
      const res = await fetch('/api/config/smtp-status');
      const data = await res.json();
      if (!data.configurado) {
        document.getElementById('smtp-warning-container').innerHTML = `
          <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 12px 16px; margin-bottom: 20px; border-radius: 4px; display: flex; align-items: center; gap: 12px;">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
            <div>
              <h4 style="margin: 0 0 4px 0; color: #92400e; font-size: 14px;">Envio de E-mails em Modo Simulação</h4>
              <p style="margin: 0; color: #b45309; font-size: 13px;">Para enviar e-mails reais aos candidatos e à contabilidade, configure as credenciais SMTP no arquivo <strong>.env</strong> e reinicie o servidor.</p>
            </div>
          </div>
        `;
      }
    } catch (e) {}

    await this.carregarLista();
  },

  async carregarLista() {
    try {
      const res = await fetch('/api/admissao', { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } });
      const data = await res.json();
      
      if (!res.ok) {
        if (res.status === 401) {
          localStorage.removeItem('token');
          window.location.href = '/login.html';
          return;
        }
        throw new Error(data.error || 'Erro ao carregar admissões do servidor');
      }

      const tbody = document.getElementById('admissoes-tbody');

      if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="padding:15px; text-align:center;">Nenhuma admissão em andamento.</td></tr>';
        return;
      }

      const statusMap = {
        'pendente_candidato': '<span style="color:#ca8a04; background:#fef08a; padding:4px 8px; border-radius:4px; font-size:12px;">Aguardando Candidato</span>',
        'analise_rh': '<span style="color:#1d4ed8; background:#dbeafe; padding:4px 8px; border-radius:4px; font-size:12px;">Em Análise (RH)</span>',
        'enviado_contabilidade': '<span style="color:#7e22ce; background:#f3e8ff; padding:4px 8px; border-radius:4px; font-size:12px;">Na Contabilidade</span>',
        'concluido': '<span style="color:#15803d; background:#dcfce3; padding:4px 8px; border-radius:4px; font-size:12px;">Concluído (Colaborador)</span>'
      };

      tbody.innerHTML = data.map(adm => `
        <tr style="border-bottom:1px solid #f1f5f9;">
          <td style="padding:15px; font-weight:500;">${adm.nome}</td>
          <td style="padding:15px; color:#475569;">${adm.email}</td>
          <td style="padding:15px;">${statusMap[adm.status] || adm.status}</td>
          <td style="padding:15px;">
            <button class="btn btn-outline" style="font-size:12px; padding:5px 10px; margin-right:5px;" onclick="AdmissoesView.abrirDetalhes(${adm.id})">Ver Dados</button>
            ${adm.status === 'analise_rh' ? `<button class="btn btn-outline" style="font-size:12px; padding:5px 10px; margin-right:5px;" onclick="AdmissoesView.enviarContabilidade(${adm.id})">Enviar p/ Contabilidade</button>` : ''}
            ${adm.status === 'enviado_contabilidade' ? `<button class="btn btn-primary" style="font-size:12px; padding:5px 10px;" onclick="AdmissoesView.finalizar(${adm.id})">Efetivar Funcionário</button>` : ''}
          </td>
        </tr>
      `).join('');

    } catch (err) {
      console.error(err);
      API.toast('Erro ao carregar admissões.', 'error');
    }
  },

  abrirModalNova() {
    App.openModal(`
      <div style="padding: 24px;">
        <h3 style="margin-top:0;">Iniciar Admissão</h3>
        <p style="margin-bottom:15px; color:#64748b;">Um e-mail será enviado ao candidato solicitando os documentos.</p>
        <form onsubmit="event.preventDefault(); AdmissoesView.salvarNova()">
          <div style="margin-bottom:15px;">
            <label style="display:block; margin-bottom:5px;">Nome Completo</label>
            <input type="text" id="adm-nome" class="form-input" required style="width:100%; padding:8px;" />
          </div>
          <div style="margin-bottom:15px;">
            <label style="display:block; margin-bottom:5px;">E-mail do Candidato</label>
            <input type="email" id="adm-email" class="form-input" required style="width:100%; padding:8px;" />
          </div>
          <div style="margin-bottom:20px;">
            <label style="display:block; margin-bottom:5px;">Telefone (Opcional)</label>
            <input type="text" id="adm-telefone" class="form-input" style="width:100%; padding:8px;" />
          </div>
          <div style="display:flex; gap:10px; justify-content:flex-end;">
            <button type="button" class="btn btn-outline" onclick="App.closeModal()">Cancelar</button>
            <button type="submit" class="btn btn-primary">Iniciar Processo</button>
          </div>
        </form>
      </div>
    `);
  },

  async salvarNova() {
    const payload = {
      nome: document.getElementById('adm-nome').value,
      email: document.getElementById('adm-email').value,
      telefone: document.getElementById('adm-telefone').value
    };

    try {
      const res = await fetch('/api/admissao/iniciar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(payload)
      });
      
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Erro desconhecido');

      API.toast('E-mail enviado ao candidato com sucesso!', 'success');
      App.closeModal();
      this.carregarLista();
    } catch (err) {
      API.toast(err.message, 'error');
    }
  },

  async abrirDetalhes(id) {
    try {
      const res = await fetch(`/api/admissao/${id}`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao buscar detalhes');

      let anexosHtml = '<p style="color:#64748b; font-size:14px;">Nenhum documento enviado ainda.</p>';
      try {
        if (data.documentos_anexos) {
          const arquivos = JSON.parse(data.documentos_anexos);
          
          const labelsMap = {
            doc_ctps: 'Carteira de Trabalho',
            doc_exame_medico: 'Exame Médico',
            doc_foto: 'Foto 3x4',
            doc_rg: 'RG',
            doc_cpf: 'CPF',
            doc_pis: 'PIS/Cidadão',
            doc_titulo: 'Título de Eleitor',
            doc_endereco: 'Comprovante Endereço',
            doc_escolaridade: 'Escolaridade',
            doc_reservista: 'Reservista',
            doc_cnh: 'CNH',
            doc_casamento: 'Certidão Casamento',
            doc_conjuge: 'RG/CPF Cônjuge',
            doc_filhos_nasc_cpf: 'Certidão/CPF Filho',
            doc_filhos_vacina: 'Vacina Filho',
            doc_filhos_escola: 'Escolaridade Filho'
          };
          
          if (Array.isArray(arquivos) && arquivos.length > 0) {
            anexosHtml = arquivos.map(arq => {
              const ehObjeto = (typeof arq === 'object' && arq !== null);
              const arquivoReal = ehObjeto ? arq.arquivo : arq;
              const nomeOriginal = ehObjeto && arq.nome_original ? arq.nome_original : '';
              
              let labelBotao = 'Abrir Documento';
              if (ehObjeto && arq.tipo && labelsMap[arq.tipo]) {
                labelBotao = labelsMap[arq.tipo];
              }

              return `
                <a href="/uploads/${arquivoReal}" target="_blank" title="${nomeOriginal}" style="display:inline-flex; align-items:center; gap:5px; padding:8px 12px; background:#f8fafc; border-radius:5px; margin:5px; text-decoration:none; font-size:13px; color:#1d4ed8; border:1px solid #e2e8f0; transition: background 0.2s;">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16c0 1.1.9 2 2 2h12a2 2 0 0 0 2-2V8l-6-6z"/><path d="M14 3v5h5"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/></svg>
                  ${labelBotao}
                </a>
              `;
            }).join('');
          }
        }
      } catch (parseError) {
        console.error('Erro ao fazer parse dos anexos', parseError);
      }

      const telefoneStr = data.telefone || 'Não informado';
      
      App.openModal(`
        <div style="padding: 24px;">
          <h3 style="margin-top:0; margin-bottom:5px; color:#0f172a;">Detalhes da Admissão</h3>
          <p style="color:#64748b; font-size:14px; margin-bottom:15px;">Confira as informações e arquivos enviados pelo candidato.</p>
          
          <div style="background:#f8fafc; padding:15px; border-radius:8px; border:1px solid #e2e8f0; margin-bottom:20px;">
            <p style="margin-top:0; margin-bottom:8px;"><strong>Candidato:</strong> ${data.nome}</p>
            <p style="margin-bottom:8px;"><strong>E-mail:</strong> ${data.email}</p>
            <p style="margin-bottom:8px;"><strong>Telefone:</strong> ${telefoneStr}</p>
            <p style="margin-bottom:0;"><strong>Status Atual:</strong> ${data.status.replace('_', ' ').toUpperCase()}</p>
          </div>
          
          <h4 style="margin-top:0px; margin-bottom:10px; color:#0f172a;">Documentos Recebidos:</h4>
          <div style="background:#fff; padding:15px; border-radius:8px; border:1px dashed #cbd5e1; min-height:80px; display:flex; flex-wrap:wrap;">
            ${anexosHtml}
          </div>
          
          <div style="margin-top:25px; display:flex; justify-content:flex-end;">
            <button class="btn btn-primary" onclick="App.closeModal()">Fechar</button>
          </div>
        </div>
      `);
    } catch(err) {
      API.toast(err.message, 'error');
      console.error(err);
    }
  },

  enviarContabilidade(id) {
    // Substitui o prompt() nativo por um Modal padronizado
    App.openModal(`
      <div style="padding: 24px;">
        <h3 style="margin-top:0; margin-bottom:10px; color:#0f172a;">Enviar para Contabilidade</h3>
        <p style="color:#64748b; font-size:14px; margin-bottom:20px;">Informe o e-mail da contabilidade. Um pacote com os dados e anexos será enviado automaticamente.</p>
        
        <form onsubmit="event.preventDefault(); AdmissoesView.confirmarEnvioContabilidade(${id})">
          <div style="margin-bottom:20px;">
            <label style="display:block; margin-bottom:5px; font-weight:500;">E-mail do Escritório Contábil</label>
            <input type="email" id="email-contabilidade" class="form-input" required placeholder="contato@escritorio.com" style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:6px;" />
          </div>
          <div style="display:flex; gap:10px; justify-content:flex-end;">
            <button type="button" class="btn btn-outline" onclick="App.closeModal()">Cancelar</button>
            <button type="submit" class="btn btn-primary" style="background:#2563eb; color:white;">Confirmar Envio</button>
          </div>
        </form>
      </div>
    `);
  },

  async confirmarEnvioContabilidade(id) {
    const email = document.getElementById('email-contabilidade').value;
    if (!email) return;

    try {
      const res = await fetch(`/api/admissao/${id}/contabilidade`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ emailContabilidade: email })
      });
      
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);

      API.toast(result.message, 'success');
      App.closeModal();
      this.carregarLista();
    } catch (err) {
      API.toast(err.message, 'error');
    }
  },

  finalizar(id) {
    // Substitui o confirm() nativo por um Modal padronizado
    App.openModal(`
      <div style="padding: 24px;">
        <h3 style="margin-top:0; margin-bottom:10px; color:#0f172a;">Efetivar Funcionário</h3>
        <p style="color:#64748b; font-size:14px; margin-bottom:20px;">Tem certeza que deseja efetivar este candidato?</p>
        
        <div style="background:#f0fdf4; border:1px solid #bbf7d0; padding:12px; border-radius:6px; margin-bottom:20px; color:#166534; font-size:13px;">
          Ao confirmar, este candidato será adicionado à tabela oficial de Colaboradores e os dados serão sincronizados com o ponto eletrônico (RHID).
        </div>

        <div style="display:flex; gap:10px; justify-content:flex-end;">
          <button class="btn btn-outline" onclick="App.closeModal()">Cancelar</button>
          <button class="btn btn-primary" style="background:#16a34a; color:white; border:none;" onclick="AdmissoesView.confirmarFinalizar(${id})">Sim, Efetivar</button>
        </div>
      </div>
    `);
  },

  async confirmarFinalizar(id) {
    try {
      const res = await fetch(`/api/admissao/${id}/finalizar`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);

      API.toast(result.message, 'success');
      App.closeModal();
      this.carregarLista();
    } catch (err) {
      API.toast(err.message, 'error');
    }
  }
};

window.AdmissoesView = AdmissoesView;
