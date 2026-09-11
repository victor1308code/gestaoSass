const DispositivosView = {
  dispositivos: [],
  logs: [],

  async render(container) {
    container.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:20px;">
        
        <!-- PAINEL CENTRAL DE SINCRONIZAÇÃO DA API CONTROL ID (BANCO DE FUNCIONÁRIOS E HIERARQUIA) -->
        <div class="card" style="border-left: 4px solid var(--brand-primary);">
          <div class="card-header" style="flex-wrap:wrap; gap:12px;">
            <div>
              <div class="card-title-with-icon">
                ${Icons.device} Integração & Sincronização com API Control iD
              </div>
              <p style="font-size:12px; color:var(--text-muted); margin-top:2px;">
                Sincronização bidirecional do banco de colaboradores, dados pessoais e hierarquia entre o Gestão SaaS e o ambiente Control iD.
              </p>
            </div>
            <div style="display:flex; gap:8px; flex-wrap:wrap;">
              <a href="/api/controlid/export-csv" class="btn btn-outline" target="_blank" title="Baixar CSV formatado com 76 colunas">
                ${Icons.download} Baixar CSV Oficial Control iD
              </a>
              <button class="btn btn-green" onclick="DispositivosView.openCreateModal()">
                + Cadastrar Terminal
              </button>
            </div>
          </div>

          <!-- CONTROLES DO AMBIENTE DE TESTES / API -->
          <div style="background:var(--bg-surface-subtle); padding:14px; border-radius:var(--radius-sm); border:1px solid var(--border-color); margin-top:4px;">
            <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap; margin-bottom:12px;">
              <div style="flex:1; min-width:260px;">
                <label class="form-label" style="font-size:11px; margin-bottom:2px;">Endereço / Host do Ambiente de Testes Control iD:</label>
                <div style="display:flex; gap:6px;">
                  <input type="text" id="controlid-test-host" class="form-control" value="192.168.1.100" placeholder="Ex: 192.168.1.100 ou http://localhost:8080" />
                  <button class="btn btn-outline" style="white-space:nowrap;" onclick="DispositivosView.testConnection()">
                    ${Icons.search} Testar Conexão
                  </button>
                </div>
              </div>

              <div style="display:flex; gap:8px; align-items:flex-end; padding-top:14px; flex-wrap:wrap;">
                <button class="btn btn-primary" style="background:#0284c7; border-color:#0284c7;" onclick="DispositivosView.openPullCloudModal()">
                  ☁️ Puxar do Control iD Nuvem
                </button>
                <button class="btn btn-primary" onclick="DispositivosView.syncApiEmployees()">
                  ⚡ Enviar Funcionários & Hierarquia (API)
                </button>
                <button class="btn btn-outline" onclick="DispositivosView.pullApiEmployees()">
                  📥 Puxar Dados do Terminal IP (API)
                </button>
              </div>
            </div>

            <!-- RESULTADO DO STATUS DA COMUNICAÇÃO -->
            <div id="controlid-api-feedback" style="display:none; padding:10px 12px; border-radius:var(--radius-sm); font-size:12px; margin-top:8px;"></div>
          </div>
        </div>

        <!-- LISTA DE EQUIPAMENTOS / TERMINAIS CADASTRADOS -->
        <div class="card">
          <div class="card-header" style="flex-wrap:wrap; gap:12px;">
            <div>
              <div class="card-title-with-icon">
                ${Icons.building} Terminais e Leitores Faciais Cadastrados
              </div>
              <p style="font-size:12px; color:var(--text-muted); margin-top:2px;">
                Equipamentos autorizados a receber a base de colaboradores.
              </p>
            </div>
            <button class="btn btn-outline" onclick="DispositivosView.loadData()">${Icons.clock} Atualizar Lista</button>
          </div>

          <div id="devices-grid-container" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); gap:14px; margin-top:8px;">
            <div class="skeleton skeleton-card" style="height:140px;"></div>
            <div class="skeleton skeleton-card" style="height:140px;"></div>
          </div>
        </div>

        <!-- FEED DE REGISTROS DE SINCRONIZAÇÃO E ACESSO -->
        <div class="card">
          <div class="card-header">
            <div class="card-title-with-icon">
              ${Icons.history} Registro de Comunicações e Acessos
            </div>
            <span class="badge badge-success">Sincronizado</span>
          </div>

          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Colaborador</th>
                  <th>Terminal / Local</th>
                  <th>Tipo</th>
                  <th>Status</th>
                  <th>Data & Horário</th>
                </tr>
              </thead>
              <tbody id="access-logs-table-body">
                <tr><td colspan="5" style="text-align:center;">Carregando registros...</td></tr>
              </tbody>
            </table>
          </div>
        </div>

      </div>
    `;

    await this.loadData();
  },

  async loadData() {
    try {
      this.dispositivos = await API.getDispositivos();
      this.logs = await API.getDispositivosLogs();

      // Renderiza Dispositivos
      const devContainer = document.getElementById('devices-grid-container');
      if (devContainer) {
        if (!this.dispositivos || this.dispositivos.length === 0) {
          devContainer.innerHTML = `
            <div style="grid-column: 1 / -1; text-align:center; padding:24px; color:var(--text-muted); font-size:12px;">
              Nenhum terminal cadastrado no momento. Clique em <strong>+ Cadastrar Terminal</strong> para adicionar.
            </div>
          `;
        } else {
          devContainer.innerHTML = this.dispositivos.map(d => `
            <div style="background:#ffffff; border:1px solid var(--border-color); border-radius:var(--radius-md); padding:14px; display:flex; flex-direction:column; justify-content:space-between; box-shadow:var(--shadow-card);">
              <div>
                <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;">
                  <span class="badge ${d.status === 'online' ? 'badge-success' : 'badge-danger'}">${d.status.toUpperCase()}</span>
                  <span style="font-size:11px; color:var(--text-muted); font-family:monospace;">${d.modelo}</span>
                </div>
                <div style="font-size:13px; font-weight:700; color:var(--text-main); margin-bottom:2px;">${d.nome}</div>
                <div style="font-size:11px; color:var(--text-muted); margin-bottom:10px;">${d.localizacao || 'Sem local especificado'} · IP: ${d.ip || 'DHCP'}</div>
                <div style="font-size:11px; color:var(--text-muted); background:var(--bg-surface-subtle); padding:6px 8px; border-radius:var(--radius-xs); margin-bottom:12px;">
                  UUID: <code style="color:var(--brand-primary); font-weight:600;">${d.identificador_uuid || 'CID-DEFAULT'}</code>
                </div>
              </div>

              <div style="display:flex; gap:6px; flex-wrap:wrap; border-top:1px solid var(--border-color); padding-top:10px;">
                <button class="btn btn-outline" style="flex:1; font-size:11px; padding:4px;" onclick="DispositivosView.syncFace(${d.id})" title="Enviar base de colaboradores para este terminal">
                  Sincronizar
                </button>
                <button class="btn btn-danger" style="padding:4px 8px; font-size:11px;" onclick="DispositivosView.delete(${d.id}, '${d.nome.replace(/'/g, "\\'")}')" title="Remover">
                  ${Icons.trash}
                </button>
              </div>
            </div>
          `).join('');
        }
      }

      // Renderiza Logs
      const tbody = document.getElementById('access-logs-table-body');
      if (tbody) {
        if (!this.logs || this.logs.length === 0) {
          tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:20px; color:var(--text-muted); font-size:12px;">Nenhum registro de acesso capturado no momento.</td></tr>`;
        } else {
          tbody.innerHTML = this.logs.map(l => `
            <tr>
              <td>
                <div style="display:flex; align-items:center; gap:8px;">
                  <img src="${l.colaborador_foto || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + encodeURIComponent(l.colaborador_nome || 'User')}" 
                       style="width:26px; height:26px; border-radius:3px; object-fit:cover; border:1px solid var(--border-color);" />
                  <div>
                    <div style="font-weight:600; color:var(--text-main);">${l.colaborador_nome || 'Visitante'}</div>
                    <div style="font-size:10px; color:var(--text-muted);">${l.departamento_nome || 'Geral'}</div>
                  </div>
                </div>
              </td>
              <td><strong>${l.dispositivo_nome || 'Terminal'}</strong></td>
              <td><span class="badge badge-default">${l.tipo_autenticacao || 'facial'}</span></td>
              <td><span class="badge ${l.status_acesso === 'liberado' ? 'badge-success' : 'badge-danger'}">${l.status_acesso}</span></td>
              <td style="font-size:11px; color:var(--text-muted);">${new Date(l.created_at).toLocaleString('pt-BR')}</td>
            </tr>
          `).join('');
        }
      }
    } catch (err) {
      API.toast('Erro ao carregar dispositivos: ' + err.message, 'error');
    }
  },

  async testConnection() {
    const host = document.getElementById('controlid-test-host')?.value.trim();
    const fb = document.getElementById('controlid-api-feedback');
    if (!host) {
      API.toast('Informe o endereço IP ou Host.', 'error');
      return;
    }

    if (fb) {
      fb.style.display = 'block';
      fb.style.background = '#eff6ff';
      fb.style.border = '1px solid #bfdbfe';
      fb.style.color = '#1e40af';
      fb.innerHTML = `Testando comunicação com <strong>${host}</strong>...`;
    }

    try {
      const res = await API.testControlIdConnection({ host });
      if (fb) {
        fb.style.display = 'block';
        if (res.online) {
          fb.style.background = '#ecfdf5';
          fb.style.border = '1px solid #a7f3d0';
          fb.style.color = '#065f46';
          fb.innerHTML = `✅ <strong>Conexão ativa!</strong> O terminal respondeu em ${res.latency}.`;
        } else {
          fb.style.background = '#fffbeb';
          fb.style.border = '1px solid #fde68a';
          fb.style.color = '#92400e';
          fb.innerHTML = `⚠️ <strong>Terminal não alcançado no IP ${res.host}</strong>. O sistema utilizará o modo de simulação com validação de payload para testes.`;
        }
      }
    } catch (err) {
      API.toast('Erro no teste: ' + err.message, 'error');
    }
  },

  async syncApiEmployees() {
    const host = document.getElementById('controlid-test-host')?.value.trim() || '192.168.1.100';
    const fb = document.getElementById('controlid-api-feedback');

    try {
      API.toast('Iniciando sincronização com a API Control iD...', 'info');
      const res = await API.syncControlIdApi({ host });
      
      if (fb) {
        fb.style.display = 'block';
        fb.style.background = '#ecfdf5';
        fb.style.border = '1px solid #a7f3d0';
        fb.style.color = '#065f46';
        fb.innerHTML = `
          ✅ <strong>Sincronização Concluída!</strong><br/>
          • <strong>${res.total_funcionarios} funcionários</strong> formatados e sincronizados via <code>/create_objects.fcgi</code>.<br/>
          • <strong>${res.total_departamentos} departamentos</strong> estruturados na hierarquia do Control iD.<br/>
          • Modo: <em>${res.status}</em>.
        `;
      }
      API.toast(res.message, 'success');
      this.loadData();
    } catch (err) {
      API.toast('Erro na sincronização: ' + err.message, 'error');
    }
  },

  async pullApiEmployees() {
    const host = document.getElementById('controlid-test-host')?.value.trim() || '192.168.1.100';
    const fb = document.getElementById('controlid-api-feedback');

    try {
      API.toast('Consultando banco de usuários do Control iD via API...', 'info');
      const res = await API.pullControlIdApi({ host });

      if (fb) {
        fb.style.display = 'block';
        fb.style.background = '#eff6ff';
        fb.style.border = '1px solid #bfdbfe';
        fb.style.color = '#1e40af';
        fb.innerHTML = `
          📥 <strong>Consulta Realizada via <code>/load_objects.fcgi</code>:</strong><br/>
          • Usuários encontrados no terminal: <strong>${res.encontrados}</strong>.<br/>
          • Status: Conexão com a API operacional.
        `;
      }
      API.toast(res.message, 'success');
    } catch (err) {
      API.toast('Erro ao puxar dados: ' + err.message, 'error');
    }
  },

  openPullCloudModal() {
    App.openModal(`
      <div class="modal-header">
        <h3>☁️ Puxar Colaboradores do Control iD Nuvem (RHiD)</h3>
        <button class="btn-icon" onclick="App.closeModal()" style="border:none; background:none; cursor:pointer; font-size:14px;">✕</button>
      </div>
      <form onsubmit="DispositivosView.submitPullCloud(event)">
        <div class="modal-body">
          <p style="font-size:12px; color:var(--text-muted); margin-bottom:16px;">
            Conecta na API oficial em nuvem do <strong>RHiD (rhid.com.br)</strong> e importa os colaboradores cadastrados diretamente para a empresa ativa (ex: <strong>TESTE01</strong>).
          </p>

          <div class="form-group">
            <label class="form-label">E-mail de Login no RHiD Cloud *</label>
            <input type="email" name="email" id="rhid-disp-cloud-email" class="form-control" placeholder="seu-email@empresa.com" required />
          </div>

          <div class="form-group">
            <label class="form-label">Senha de Acesso ao RHiD Cloud *</label>
            <input type="password" name="password" id="rhid-disp-cloud-password" class="form-control" placeholder="••••••••" required />
          </div>

          <div id="disp-pull-cloud-feedback" style="display:none; padding:10px 12px; border-radius:var(--radius-sm); font-size:12px; margin-top:10px;"></div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-outline" onclick="App.closeModal()">Cancelar</button>
          <button type="submit" id="btn-disp-submit-pull-cloud" class="btn btn-primary" style="background:#0284c7;">
            📥 Conectar & Importar Colaboradores
          </button>
        </div>
      </form>
    `);
  },

  async submitPullCloud(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const email = formData.get('email');
    const password = formData.get('password');
    const btn = document.getElementById('btn-disp-submit-pull-cloud');
    const fb = document.getElementById('disp-pull-cloud-feedback');

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '⏳ Conectando ao RHiD Cloud...';
    }

    if (fb) {
      fb.style.display = 'block';
      fb.style.background = '#eff6ff';
      fb.style.border = '1px solid #bfdbfe';
      fb.style.color = '#1e40af';
      fb.innerHTML = 'Autenticando na API e buscando colaboradores...';
    }

    try {
      const res = await API.pullControlIdCloud({ email, password });
      API.toast(res.message, 'success');

      if (fb) {
        fb.style.background = '#f0fdf4';
        fb.style.border = '1px solid #bbf7d0';
        fb.style.color = '#15803d';
        fb.innerHTML = `✅ <strong>${res.message}</strong>`;
      }

      setTimeout(() => {
        App.closeModal();
        App.navigate('colaboradores');
      }, 1200);
    } catch (err) {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '📥 Conectar & Importar Colaboradores';
      }
      if (fb) {
        fb.style.background = '#fef2f2';
        fb.style.border = '1px solid #fecaca';
        fb.style.color = '#991b1b';
        fb.innerHTML = `❌ ${err.message || 'Erro ao comunicar com a API do RHiD Cloud.'}`;
      }
      API.toast(err.message, 'error');
    }
  },

  openCreateModal() {
    App.openModal(`
      <div class="modal-header">
        <h3>Cadastrar Terminal Control iD</h3>
        <button class="btn-icon" onclick="App.closeModal()" style="border:none; background:none; cursor:pointer; font-size:14px;">✕</button>
      </div>
      <form onsubmit="DispositivosView.submitCreate(event)">
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">Nome de Identificação *</label>
            <input type="text" name="nome" class="form-control" placeholder="Ex: iDFace Recepção / Terminal Teste" required />
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Modelo do Equipamento *</label>
              <select name="modelo" class="form-control" required>
                <option value="iDFace">iDFace (Reconhecimento Facial)</option>
                <option value="iDFace Max">iDFace Max (Alta Capacidade)</option>
                <option value="iDClass">iDClass (Relógio de Ponto REP)</option>
                <option value="iDAccess">iDAccess (Biometria / Cartão)</option>
                <option value="iDBlock">iDBlock (Catraca Pedestre)</option>
                <option value="iDBox">iDBox (Controlador de Acesso)</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Localização</label>
              <input type="text" name="localizacao" class="form-control" placeholder="Ex: Laboratório / Entrada" />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Endereço IP na Rede</label>
              <input type="text" name="ip" class="form-control" placeholder="Ex: 192.168.1.100" />
            </div>
            <div class="form-group">
              <label class="form-label">Porta</label>
              <input type="number" name="porta" class="form-control" value="80" />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">UUID de Identificação</label>
            <input type="text" name="identificador_uuid" class="form-control" placeholder="Deixe em branco para gerar automático" />
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-outline" onclick="App.closeModal()">Cancelar</button>
          <button type="submit" class="btn btn-green">Salvar Terminal</button>
        </div>
      </form>
    `);
  },

  async submitCreate(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());

    try {
      await API.createDispositivo(data);
      API.toast('Terminal cadastrado com sucesso!', 'success');
      App.closeModal();
      this.loadData();
    } catch (err) {
      API.toast(err.message, 'error');
    }
  },

  async syncFace(id) {
    try {
      API.toast('Enviando colaboradores e dados para o terminal...', 'info');
      const res = await API.syncDispositivo(id);
      API.toast(res.message, 'success');
      this.loadData();
    } catch (err) {
      API.toast(err.message, 'error');
    }
  },

  async delete(id, nome) {
    if (!confirm(`Deseja realmente remover o dispositivo "${nome}"?`)) return;

    try {
      await API.deleteDispositivo(id);
      API.toast('Terminal removido.', 'success');
      this.loadData();
    } catch (err) {
      API.toast(err.message, 'error');
    }
  }
};
