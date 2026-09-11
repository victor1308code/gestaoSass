const CargosView = {
  cargos: [],

  async render(container) {
    container.innerHTML = `
      <div class="card" style="margin-bottom: 20px;">
        <div class="card-header" style="flex-wrap:wrap; gap:12px;">
          <div>
            <div class="card-title-with-icon">
              ${Icons.briefcase} Cargos & Funções
            </div>
            <p style="font-size:12px; color:var(--text-muted); margin-top:2px;">
              Gerenciamento de posições, níveis hierárquicos e CBO da empresa.
            </p>
          </div>
          <div style="display:flex; gap:8px;">
            <button class="btn btn-outline" onclick="App.navigate('colaboradores')">${Icons.users} Ver Colaboradores</button>
            <button class="btn btn-green" onclick="CargosView.openCreateModal()">+ Novo Cargo</button>
          </div>
        </div>

        <div style="padding: 12px 16px; border-bottom: 1px solid var(--border-color); background: var(--bg-card); display:flex; gap:12px; align-items:center;">
          <input type="text" id="cargo-table-search" class="form-control" placeholder="Buscar por cargo, nível ou CBO..." style="max-width:320px;" />
        </div>

        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Cargo / Função</th>
                <th>Nível Hierárquico</th>
                <th>CBO</th>
                <th>Descrição / Atribuições</th>
                <th>Colaboradores</th>
                <th style="text-align:right;">Ações</th>
              </tr>
            </thead>
            <tbody id="cargos-table-body">
              <tr><td colspan="6" style="text-align:center;">Carregando cargos...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

    document.getElementById('cargo-table-search')?.addEventListener('input', (e) => {
      this.filterTable(e.target.value.toLowerCase().trim());
    });

    await this.loadData();
  },

  async loadData() {
    try {
      this.cargos = await API.getCargos();
      const colabs = await API.getColaboradores().catch(() => []);
      if (Array.isArray(colabs) && colabs.length > 0) {
        this.cargos = (this.cargos || []).map(cg => ({
          ...cg,
          total_colaboradores: colabs.filter(c => c.cargo_id == cg.id).length
        }));
      }
      this.renderTable(this.cargos);
    } catch (err) {
      const tbody = document.getElementById('cargos-table-body');
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--danger);">Erro ao carregar cargos: ${err.message}</td></tr>`;
      }
    }
  },

  filterTable(search) {
    if (!search) {
      this.renderTable(this.cargos);
      return;
    }
    const filtered = (this.cargos || []).filter(c => {
      return (
        (c.nome_cargo && c.nome_cargo.toLowerCase().includes(search)) ||
        (c.nivel && c.nivel.toLowerCase().includes(search)) ||
        (c.cbo && c.cbo.toLowerCase().includes(search)) ||
        (c.descricao && c.descricao.toLowerCase().includes(search))
      );
    });
    this.renderTable(filtered);
  },

  renderTable(list) {
    const tbody = document.getElementById('cargos-table-body');
    if (!tbody) return;

    if (!list || list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:24px; color:var(--text-muted);">Nenhum cargo cadastrado.</td></tr>`;
      return;
    }

    const levelBadgeMap = {
      'C-Level': 'badge-danger',
      'Diretoria': 'badge-danger',
      'Gerência': 'badge-warning',
      'Coordenação': 'badge-info',
      'Especialista': 'badge-info',
      'Sênior': 'badge-primary',
      'Pleno': 'badge-default',
      'Júnior': 'badge-default',
      'Estágio': 'badge-default',
      'Operacional': 'badge-default'
    };

    tbody.innerHTML = list.map(c => {
      const badgeClass = levelBadgeMap[c.nivel] || 'badge-default';
      return `
        <tr>
          <td><strong>${c.nome_cargo}</strong></td>
          <td><span class="badge ${badgeClass}">${c.nivel || 'Geral'}</span></td>
          <td><code style="font-size:11px; color:var(--text-muted);">${c.cbo || '—'}</code></td>
          <td style="color:var(--text-muted); font-size:12px; max-width:260px;">${c.descricao || 'Sem descrição cadastrada'}</td>
          <td><span class="badge badge-info">${c.total_colaboradores || 0} ativos</span></td>
          <td style="text-align:right; white-space:nowrap;">
            <button class="btn btn-outline" style="padding:2px 6px; font-size:11px;" onclick="CargosView.openEditModal(${c.id})">Editar</button>
            <button class="btn btn-danger" style="padding:2px 6px; font-size:11px;" onclick="CargosView.delete(${c.id}, '${c.nome_cargo.replace(/'/g, "\\'")}')">Excluir</button>
          </td>
        </tr>
      `;
    }).join('');
  },

  openCreateModal() {
    App.openModal(`
      <div class="modal-header">
        <h3>Novo Cargo</h3>
        <button class="btn-icon" onclick="App.closeModal()" style="border:none; background:none; cursor:pointer; font-size:14px;">✕</button>
      </div>
      <form id="create-cargo-form" onsubmit="CargosView.submitCreate(event)">
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">Nome do Cargo / Função *</label>
            <input type="text" name="nome_cargo" class="form-control" placeholder="Ex: Desenvolvedor Full Stack" required />
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Nível Hierárquico</label>
              <select name="nivel" class="form-control">
                <option value="C-Level">C-Level</option>
                <option value="Diretoria">Diretoria</option>
                <option value="Gerência">Gerência</option>
                <option value="Coordenação">Coordenação</option>
                <option value="Especialista">Especialista</option>
                <option value="Sênior">Sênior</option>
                <option value="Pleno" selected>Pleno</option>
                <option value="Júnior">Júnior</option>
                <option value="Estágio">Estágio</option>
                <option value="Operacional">Operacional</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Código CBO</label>
              <input type="text" name="cbo" class="form-control" placeholder="Ex: 2124-05" />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Descrição / Atribuições</label>
            <textarea name="descricao" class="form-control" rows="3" placeholder="Responsabilidades e escopo da função..."></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-outline" onclick="App.closeModal()">Cancelar</button>
          <button type="submit" class="btn btn-green">Salvar Cargo</button>
        </div>
      </form>
    `);
  },

  async submitCreate(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());

    try {
      await API.createCargo(data);
      API.toast('Cargo cadastrado com sucesso.', 'success');
      App.closeModal();
      this.loadData();
    } catch (err) {
      API.toast(err.message, 'error');
    }
  },

  async openEditModal(id) {
    const cargo = (this.cargos || []).find(c => c.id == id);
    if (!cargo) return;

    const niveis = ['C-Level', 'Diretoria', 'Gerência', 'Coordenação', 'Especialista', 'Sênior', 'Pleno', 'Júnior', 'Estágio', 'Operacional'];
    const nivelOpts = niveis.map(n => `
      <option value="${n}" ${cargo.nivel === n ? 'selected' : ''}>${n}</option>
    `).join('');

    App.openModal(`
      <div class="modal-header">
        <h3>Editar Cargo: ${cargo.nome_cargo}</h3>
        <button class="btn-icon" onclick="App.closeModal()" style="border:none; background:none; cursor:pointer; font-size:14px;">✕</button>
      </div>
      <form id="edit-cargo-form" onsubmit="CargosView.submitEdit(event, ${id})">
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">Nome do Cargo / Função *</label>
            <input type="text" name="nome_cargo" class="form-control" value="${cargo.nome_cargo}" required />
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Nível Hierárquico</label>
              <select name="nivel" class="form-control">
                ${nivelOpts}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Código CBO</label>
              <input type="text" name="cbo" class="form-control" value="${cargo.cbo || ''}" placeholder="Ex: 2124-05" />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Descrição / Atribuições</label>
            <textarea name="descricao" class="form-control" rows="3">${cargo.descricao || ''}</textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-outline" onclick="App.closeModal()">Cancelar</button>
          <button type="submit" class="btn btn-green">Salvar Alterações</button>
        </div>
      </form>
    `);
  },

  async submitEdit(e, id) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());

    try {
      await API.updateCargo(id, data);
      API.toast('Cargo atualizado com sucesso.', 'success');
      App.closeModal();
      this.loadData();
    } catch (err) {
      API.toast(err.message, 'error');
    }
  },

  async delete(id, nome) {
    if (!confirm(`Deseja realmente excluir o cargo "${nome}"? Colaboradores vinculados a este cargo ficarão sem cargo definido.`)) {
      return;
    }

    try {
      await API.deleteCargo(id);
      API.toast('Cargo excluído.', 'success');
      this.loadData();
    } catch (err) {
      API.toast(err.message, 'error');
    }
  }
};
