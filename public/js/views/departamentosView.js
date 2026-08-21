const DepartamentosView = {
  departamentos: [],
  colaboradores: [],

  async render(container) {
    container.innerHTML = `
      <div class="card" style="margin-bottom: 20px;">
        <div class="card-header" style="flex-wrap:wrap; gap:12px;">
          <div>
            <div class="card-title-with-icon">
              ${Icons.building} Estrutura Organizacional & Departamentos
            </div>
            <p style="font-size:12px; color:var(--text-muted); margin-top:2px;">Gerenciamento da estrutura de setores, lideranças e ramais da empresa.</p>
          </div>
          <div style="display:flex; gap:8px;">
            <button class="btn btn-outline" onclick="App.navigate('organograma')">${Icons.tree} Ver Organograma</button>
            <button class="btn btn-green" onclick="DepartamentosView.openCreateModal()">+ Novo Departamento</button>
          </div>
        </div>

        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Cor</th>
                <th>Nome do Departamento</th>
                <th>Sigla</th>
                <th>Setor Superior</th>
                <th>Responsável / Líder</th>
                <th>Ramal</th>
                <th>Membros</th>
                <th style="text-align:right;">Ações</th>
              </tr>
            </thead>
            <tbody id="departamentos-table-body">
              <tr><td colspan="8" style="text-align:center;">Carregando departamentos...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

    await this.loadData();
  },

  async loadData() {
    try {
      this.departamentos = await API.getDepartamentos();
      this.colaboradores = await API.getColaboradores();
      const tbody = document.getElementById('departamentos-table-body');
      if (!tbody) return;

      if (!this.departamentos || this.departamentos.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:24px; color:var(--text-muted);">Nenhum departamento cadastrado.</td></tr>`;
        return;
      }

      tbody.innerHTML = this.departamentos.map(d => `
        <tr>
          <td><div style="width:12px; height:12px; border-radius:2px; background:${d.cor || 'var(--brand-primary)'};"></div></td>
          <td><strong>${d.nome}</strong></td>
          <td><span class="badge badge-default">${d.sigla || '—'}</span></td>
          <td>${d.parent_nome ? `<strong>${d.parent_nome}</strong>` : '<span style="color:var(--text-muted); font-size:11px;">(Nível Raiz)</span>'}</td>
          <td>${d.responsavel_nome || '<span style="color:var(--text-muted);">Não definido</span>'}</td>
          <td>${d.ramal || '—'}</td>
          <td><span class="badge badge-info">${d.total_colaboradores} membros</span></td>
          <td style="text-align:right; white-space:nowrap;">
            <button class="btn btn-outline" style="padding:2px 6px; font-size:11px;" onclick="DepartamentosView.openCreateModal(${d.id})" title="Adicionar Subsetor">+ Subsetor</button>
            <button class="btn btn-outline" style="padding:2px 6px; font-size:11px;" onclick="DepartamentosView.openEditModal(${d.id})">Editar</button>
            <button class="btn btn-danger" style="padding:2px 6px; font-size:11px;" onclick="DepartamentosView.delete(${d.id}, '${d.nome.replace(/'/g, "\\'")}')">Excluir</button>
          </td>
        </tr>
      `).join('');
    } catch (err) {
      const tbody = document.getElementById('departamentos-table-body');
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:var(--danger);">Erro: ${err.message}</td></tr>`;
      }
    }
  },

  async openCreateModal(parentId = null) {
    try {
      this.departamentos = await API.getDepartamentos();
      this.colaboradores = await API.getColaboradores();
    } catch (_) {}

    const parentOpts = (this.departamentos || []).map(d => `
      <option value="${d.id}" ${parentId == d.id ? 'selected' : ''}>${d.nome} (${d.sigla || 'SET'})</option>
    `).join('');

    const colabOpts = (this.colaboradores || []).map(c => `
      <option value="${c.id}">${c.nome} - ${c.nome_cargo || 'Sem cargo'}</option>
    `).join('');

    App.openModal(`
      <div class="modal-header">
        <h3>Novo Departamento</h3>
        <button class="btn-icon" onclick="App.closeModal()" style="border:none; background:none; cursor:pointer; font-size:14px;">✕</button>
      </div>
      <form id="create-dept-form" onsubmit="DepartamentosView.submitCreate(event)">
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">Nome do Departamento *</label>
            <input type="text" name="nome" class="form-control" placeholder="Ex: Diretoria de Tecnologia" required />
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Sigla</label>
              <input type="text" name="sigla" class="form-control" placeholder="Ex: DITEC" />
            </div>
            <div class="form-group">
              <label class="form-label">Ramal</label>
              <input type="text" name="ramal" class="form-control" placeholder="Ex: 200" />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Setor Superior (Subordinação)</label>
            <select name="parent_id" class="form-control">
              <option value="">Nenhum (Nível Raiz / Diretoria)</option>
              ${parentOpts}
            </select>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Líder / Responsável</label>
              <select name="responsavel_id" class="form-control">
                <option value="">Selecione um líder (opcional)</option>
                ${colabOpts}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Cor de Identificação</label>
              <input type="color" name="cor" class="form-control" value="#2563eb" style="height:36px; padding:2px;" />
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-outline" onclick="App.closeModal()">Cancelar</button>
          <button type="submit" class="btn btn-green">Salvar</button>
        </div>
      </form>
    `);
  },

  async submitCreate(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());

    try {
      await API.createDepartamento(data);
      API.toast('Departamento criado com sucesso.', 'success');
      App.closeModal();
      
      if (App.state.currentView === 'organograma') {
        OrganogramaView.loadTree();
      } else if (App.state.currentView === 'departamentos') {
        this.loadData();
      }
    } catch (err) {
      API.toast(err.message, 'error');
    }
  },

  async openEditModal(id) {
    try {
      this.departamentos = await API.getDepartamentos();
      this.colaboradores = await API.getColaboradores();
    } catch (_) {}

    const dept = (this.departamentos || []).find(d => d.id === id);
    if (!dept) return;

    const parentOpts = (this.departamentos || []).filter(d => d.id !== id).map(d => `
      <option value="${d.id}" ${dept.parent_id == d.id ? 'selected' : ''}>${d.nome} (${d.sigla || 'SET'})</option>
    `).join('');

    const colabOpts = (this.colaboradores || []).map(c => `
      <option value="${c.id}" ${dept.responsavel_id == c.id ? 'selected' : ''}>${c.nome} - ${c.nome_cargo || 'Sem cargo'}</option>
    `).join('');

    App.openModal(`
      <div class="modal-header">
        <h3>Editar Departamento</h3>
        <button class="btn-icon" onclick="App.closeModal()" style="border:none; background:none; cursor:pointer; font-size:14px;">✕</button>
      </div>
      <form id="edit-dept-form" onsubmit="DepartamentosView.submitEdit(event, ${id})">
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">Nome do Departamento *</label>
            <input type="text" name="nome" class="form-control" value="${dept.nome}" required />
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Sigla</label>
              <input type="text" name="sigla" class="form-control" value="${dept.sigla || ''}" />
            </div>
            <div class="form-group">
              <label class="form-label">Ramal</label>
              <input type="text" name="ramal" class="form-control" value="${dept.ramal || ''}" />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Setor Superior</label>
            <select name="parent_id" class="form-control">
              <option value="">Nenhum (Nível Raiz)</option>
              ${parentOpts}
            </select>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Líder / Responsável</label>
              <select name="responsavel_id" class="form-control">
                <option value="">Selecione um líder (opcional)</option>
                ${colabOpts}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Cor de Identificação</label>
              <input type="color" name="cor" class="form-control" value="${dept.cor || '#2563eb'}" style="height:36px; padding:2px;" />
            </div>
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
      await API.updateDepartamento(id, data);
      API.toast('Departamento atualizado.', 'success');
      App.closeModal();

      if (App.state.currentView === 'organograma') {
        OrganogramaView.loadTree();
      } else if (App.state.currentView === 'departamentos') {
        this.loadData();
      }
    } catch (err) {
      API.toast(err.message, 'error');
    }
  },

  async delete(id, nome) {
    if (!confirm(`Deseja realmente excluir o departamento "${nome}"?`)) {
      return;
    }

    try {
      await API.deleteDepartamento(id);
      API.toast('Departamento excluído.', 'success');

      if (App.state.currentView === 'organograma') {
        OrganogramaView.loadTree();
      } else if (App.state.currentView === 'departamentos') {
        this.loadData();
      }
    } catch (err) {
      API.toast(err.message, 'error');
    }
  }
};
