const ConfiguracoesView = {
  empresa: null,
  users: [],

  async render(container) {
    container.innerHTML = `
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(320px, 1fr)); gap:24px;">
        <!-- DADOS DA EMPRESA & IDENTIDADE VISUAL -->
        <div class="card">
          <div class="card-header">
            <div class="card-title-with-icon">
              <span>🏢</span> Perfil da Empresa
            </div>
          </div>
          <form id="empresa-config-form" onsubmit="ConfiguracoesView.saveEmpresa(event)">
            <div class="form-group">
              <label class="form-label">Nome Fantasia da Empresa *</label>
              <input type="text" id="cfg-nome-fantasia" name="nome_fantasia" class="form-control" required />
            </div>

            <div class="form-group">
              <label class="form-label">Razão Social</label>
              <input type="text" id="cfg-razao-social" name="razao_social" class="form-control" />
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label">CNPJ</label>
                <input type="text" id="cfg-cnpj" name="cnpj" class="form-control" placeholder="00.000.000/0000-00" oninput="this.value = API.maskCNPJ(this.value)" />
              </div>
              <div class="form-group">
                <label class="form-label">Telefone / Contato</label>
                <input type="text" id="cfg-telefone" name="telefone_contato" class="form-control" placeholder="(00) 00000-0000" oninput="this.value = API.maskPhone(this.value)" />
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">E-mail Institucional</label>
              <input type="email" id="cfg-email" name="email_contato" class="form-control" />
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label">URL da Logomarca (Logo)</label>
                <input type="url" id="cfg-logo" name="logo_url" class="form-control" placeholder="https://..." />
              </div>
              <div class="form-group">
                <label class="form-label">Cor Primária da Marca</label>
                <input type="color" id="cfg-cor" name="cor_primaria" class="form-control" style="height:42px; padding:4px;" />
              </div>
            </div>

            <button type="submit" class="btn btn-green" style="width:100%; margin-top:8px;">Salvar Dados da Empresa</button>
          </form>
        </div>

        <!-- GESTÃO DE USUÁRIOS E ACESSOS -->
        <div class="card">
          <div class="card-header">
            <div class="card-title-with-icon">
              <span>👥</span> Usuários & Acessos
            </div>
            <button class="btn btn-green btn-sm" style="padding:4px 10px; font-size:11px;" onclick="ConfiguracoesView.openAddUserModal()">+ Convidar</button>
          </div>
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>E-mail</th>
                  <th>Perfil</th>
                  <th style="text-align:right;">Ações</th>
                </tr>
              </thead>
              <tbody id="usuarios-table-body">
                <tr><td colspan="4" style="text-align:center;">Carregando usuários...</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- ALTERAR MINHA SENHA -->
        <div class="card" style="grid-column: 1 / -1;">
          <div class="card-header">
            <div class="card-title-with-icon">
              <span>🔐</span> Segurança & Senha
            </div>
          </div>
          <form id="change-pass-form" onsubmit="ConfiguracoesView.changePassword(event)" style="max-width:400px;">
            <div class="form-group">
              <label class="form-label">Senha Atual *</label>
              <input type="password" name="senhaAtual" class="form-control" required />
            </div>
            <div class="form-group">
              <label class="form-label">Nova Senha *</label>
              <input type="password" name="novaSenha" class="form-control" minlength="6" required />
            </div>
            <button type="submit" class="btn btn-outline">Alterar Senha</button>
          </form>
        </div>
      </div>
    `;

    await this.loadData();
  },

  async loadData() {
    try {
      const data = await API.getEmpresa();
      this.empresa = data.empresa;

      document.getElementById('cfg-nome-fantasia').value = this.empresa.nome_fantasia || '';
      document.getElementById('cfg-razao-social').value = this.empresa.razao_social || '';
      document.getElementById('cfg-cnpj').value = this.empresa.cnpj || '';
      document.getElementById('cfg-telefone').value = this.empresa.telefone_contato || '';
      document.getElementById('cfg-email').value = this.empresa.email_contato || '';
      document.getElementById('cfg-logo').value = this.empresa.logo_url || '';
      document.getElementById('cfg-cor').value = this.empresa.cor_primaria || '#4f46e5';

      // Usuários
      this.users = await API.listUsers();
      const tbody = document.getElementById('usuarios-table-body');
      if (tbody) {
        tbody.innerHTML = this.users.map(u => `
          <tr>
            <td><strong>${u.nome}</strong></td>
            <td>${u.email}</td>
            <td><span class="badge ${u.role === 'admin' ? 'badge-primary' : 'badge-default'}">${u.role}</span></td>
            <td style="text-align:right;">
              ${u.id !== App.state.user.id ? `
                <button class="btn btn-danger btn-sm" style="padding:4px 8px; font-size:11px;" onclick="ConfiguracoesView.deleteUser(${u.id})">Remover</button>
              ` : '<span style="font-size:11px; color:var(--text-muted); font-weight:600;">(Você)</span>'}
            </td>
          </tr>
        `).join('');
      }
    } catch (err) {
      API.toast('Erro ao carregar configurações: ' + err.message, 'error');
    }
  },

  async saveEmpresa(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());

    try {
      await API.updateEmpresa(data);
      API.toast('Empresa atualizada com sucesso!', 'success');
      App.updateCompanyBranding(data.nome_fantasia, data.logo_url, data.cor_primaria);
    } catch (err) {
      API.toast(err.message, 'error');
    }
  },

  openAddUserModal() {
    App.openModal(`
      <div class="modal-header">
        <h3>+ Adicionar Usuário</h3>
        <button class="btn-icon" onclick="App.closeModal()" style="border:none; background:none; cursor:pointer; font-size:16px;">✕</button>
      </div>
      <form onsubmit="ConfiguracoesView.submitAddUser(event)">
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">Nome Completo *</label>
            <input type="text" name="nome" class="form-control" required />
          </div>
          <div class="form-group">
            <label class="form-label">E-mail de Acesso *</label>
            <input type="email" name="email" class="form-control" required />
          </div>
          <div class="form-group">
            <label class="form-label">Senha Inicial *</label>
            <input type="password" name="senha" class="form-control" minlength="6" required />
          </div>
          <div class="form-group">
            <label class="form-label">Perfil de Acesso *</label>
            <select name="role" class="form-control" required>
              <option value="admin">Administrador (Acesso total)</option>
              <option value="gestor">Gestor de Setor</option>
              <option value="viewer">Visualizador (Consulta)</option>
            </select>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-outline" onclick="App.closeModal()">Cancelar</button>
          <button type="submit" class="btn btn-green">Criar Usuário</button>
        </div>
      </form>
    `);
  },

  async submitAddUser(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());

    try {
      await API.createUser(data);
      API.toast('Usuário criado com sucesso!', 'success');
      App.closeModal();
      this.loadData();
    } catch (err) {
      API.toast(err.message, 'error');
    }
  },

  async deleteUser(id) {
    if (!confirm('Deseja realmente remover este usuário da empresa?')) return;
    try {
      await API.deleteUser(id);
      API.toast('Usuário removido com sucesso.', 'success');
      this.loadData();
    } catch (err) {
      API.toast(err.message, 'error');
    }
  },

  async changePassword(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const senhaAtual = formData.get('senhaAtual');
    const novaSenha = formData.get('novaSenha');

    try {
      await API.changePassword(senhaAtual, novaSenha);
      API.toast('Senha alterada com sucesso!', 'success');
      e.target.reset();
    } catch (err) {
      API.toast(err.message, 'error');
    }
  }
};
