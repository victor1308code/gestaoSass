const DispositivosView = {
  dispositivos: [],
  logs: [],

  async render(container) {
    container.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:20px;">
        <!-- CABEÇALHO & AÇÕES -->
        <div class="card">
          <div class="card-header" style="flex-wrap:wrap; gap:12px;">
            <div>
              <div class="card-title-with-icon">
                ${Icons.device} Dispositivos & Catracas Control iD
              </div>
              <p style="font-size:12px; color:var(--text-muted); margin-top:2px;">
                Gerenciamento de leitores faciais (iDFace), catracas e controle de acesso físico em tempo real.
              </p>
            </div>
            <div style="display:flex; gap:8px;">
              <button class="btn btn-outline" onclick="DispositivosView.loadData()">${Icons.clock} Atualizar</button>
              <button class="btn btn-green" onclick="DispositivosView.openCreateModal()">+ Novo Dispositivo</button>
            </div>
          </div>

          <!-- GRID DE DISPOSITIVOS -->
          <div id="devices-grid-container" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); gap:14px; margin-top:8px;">
            <div class="skeleton skeleton-card" style="height:140px;"></div>
            <div class="skeleton skeleton-card" style="height:140px;"></div>
          </div>
        </div>

        <!-- FEED DE ACESSOS EM TEMPO REAL -->
        <div class="card">
          <div class="card-header">
            <div class="card-title-with-icon">
              ${Icons.history} Monitor de Acessos em Tempo Real (Catracas & Portas)
            </div>
            <span class="badge badge-success">Feed Ativo</span>
          </div>

          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Colaborador</th>
                  <th>Dispositivo / Local</th>
                  <th>Autenticação</th>
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

        <!-- GUIA DE CONFIGURAÇÃO PUSH -->
        <div class="card" style="background:var(--bg-surface-subtle);">
          <div style="font-size:12px; font-weight:600; color:var(--text-main); margin-bottom:4px;">
            Configuração do Modo Push nos Terminais Control iD
          </div>
          <p style="font-size:11px; color:var(--text-muted); line-height:1.5;">
            Para conectar um equipamento (ex: iDFace ou Catraca iDBlock), acesse o menu de configuração do dispositivo ➔ <em>Modo de Operação: Push</em> e aponte a URL do servidor para: 
            <code style="background:#ffffff; padding:2px 6px; border-radius:3px; border:1px solid var(--border-color); font-weight:600;">https://${window.location.host}/api/controlid/push</code>
          </p>
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
            <div style="grid-column: 1 / -1; text-align:center; padding:30px; color:var(--text-muted); font-size:12px;">
              Nenhum dispositivo Control iD conectado. Clique em <strong>+ Novo Dispositivo</strong> para cadastrar.
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
                <button class="btn btn-outline" style="flex:1; font-size:11px; padding:4px;" onclick="DispositivosView.syncFace(${d.id})" title="Enviar colaboradores e fotos para este terminal">
                  Sincronizar
                </button>
                <button class="btn btn-outline" style="flex:1; font-size:11px; padding:4px;" onclick="DispositivosView.unlock(${d.id})" title="Liberar passagem">
                  Abrir Porta
                </button>
                <button class="btn btn-danger" style="padding:4px 8px; font-size:11px;" onclick="DispositivosView.delete(${d.id}, '${d.nome.replace(/'/g, "\\'")}')" title="Excluir">
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
          tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:24px; color:var(--text-muted); font-size:12px;">Nenhum acesso registrado nas catracas ainda.</td></tr>`;
        } else {
          tbody.innerHTML = this.logs.map(l => `
            <tr>
              <td>
                <div style="display:flex; align-items:center; gap:8px;">
                  <img src="${l.colaborador_foto || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + encodeURIComponent(l.colaborador_nome || 'Access')}" 
                       style="width:26px; height:26px; border-radius:3px; object-fit:cover; border:1px solid var(--border-color);" />
                  <div>
                    <div style="font-weight:600; color:var(--text-main);">${l.colaborador_nome || 'Visitante / Desconhecido'}</div>
                    <div style="font-size:10px; color:var(--text-muted);">${l.departamento_nome || 'Acesso Geral'}</div>
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

  openCreateModal() {
    App.openModal(`
      <div class="modal-header">
        <h3>Novo Dispositivo Control iD</h3>
        <button class="btn-icon" onclick="App.closeModal()" style="border:none; background:none; cursor:pointer; font-size:14px;">✕</button>
      </div>
      <form onsubmit="DispositivosView.submitCreate(event)">
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">Nome de Identificação *</label>
            <input type="text" name="nome" class="form-control" placeholder="Ex: iDFace Recepção / Catraca 01" required />
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Modelo do Equipamento *</label>
              <select name="modelo" class="form-control" required>
                <option value="iDFace">iDFace (Reconhecimento Facial)</option>
                <option value="iDFace Max">iDFace Max (Alta Capacidade)</option>
                <option value="iDBlock">iDBlock (Catraca Pedestre)</option>
                <option value="iDAccess">iDAccess (Biometria / Cartão)</option>
                <option value="iDBox">iDBox (Controlador de Portas)</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Localização Físico-Predial</label>
              <input type="text" name="localizacao" class="form-control" placeholder="Ex: Entrada Principal - Bloco A" />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Endereço IP na Rede Local</label>
              <input type="text" name="ip" class="form-control" placeholder="Ex: 192.168.1.100" />
            </div>
            <div class="form-group">
              <label class="form-label">Porta de Comunicação</label>
              <input type="number" name="porta" class="form-control" value="80" />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Identificador / UUID do Equipamento</label>
            <input type="text" name="identificador_uuid" class="form-control" placeholder="Deixe em branco para gerar automaticamente" />
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-outline" onclick="App.closeModal()">Cancelar</button>
          <button type="submit" class="btn btn-green">Salvar Equipamento</button>
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
      API.toast('Dispositivo cadastrado com sucesso!', 'success');
      App.closeModal();
      this.loadData();
    } catch (err) {
      API.toast(err.message, 'error');
    }
  },

  async syncFace(id) {
    try {
      API.toast('Iniciando sincronização de biometrias faciais...', 'info');
      const res = await API.syncDispositivo(id);
      API.toast(res.message, 'success');
      this.loadData();
    } catch (err) {
      API.toast(err.message, 'error');
    }
  },

  async unlock(id) {
    try {
      const res = await API.remoteUnlockDispositivo(id);
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
      API.toast('Dispositivo removido.', 'success');
      this.loadData();
    } catch (err) {
      API.toast(err.message, 'error');
    }
  }
};
