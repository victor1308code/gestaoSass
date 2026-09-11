const ColaboradoresView = {
  colaboradores: [],
  departamentos: [],
  cargos: [],
  currentPage: 1,
  pageSize: 10,
  uploadedPhotoBase64: null,

  async render(container) {
    container.innerHTML = `
      <div class="card" style="margin-bottom:20px;">
        <div class="card-header" style="flex-wrap:wrap; gap:12px;">
          <div>
            <div class="card-title-with-icon">
              ${Icons.users} Quadro Geral de Colaboradores
            </div>
            <p style="font-size:12px; color:var(--text-muted); margin-top:2px;">Gerenciamento de funcionários, alocações e registros cadastrais.</p>
          </div>

          <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
            <button class="btn btn-primary" style="background:#0284c7; border-color:#0284c7;" onclick="ColaboradoresView.openPullCloudModal()">☁️ Puxar do Control iD Nuvem</button>
            <a href="/api/controlid/export-csv" class="btn btn-outline" target="_blank" title="Download do CSV formatado com 76 colunas para Control iD">${Icons.download} CSV Control iD</a>
            <a href="/api/colaboradores/export/csv" class="btn btn-outline" target="_blank">${Icons.download} Exportar CSV</a>
            <button class="btn btn-outline" onclick="ColaboradoresView.openImportModal()">${Icons.upload} Importar CSV</button>
            <button class="btn btn-green" onclick="ColaboradoresView.openCreateModal()">+ Novo Colaborador</button>
          </div>
        </div>

        <!-- FILTROS -->
        <div style="display:flex; gap:10px; margin-bottom:14px; flex-wrap:wrap;">
          <input type="text" id="colab-table-search" class="form-control" placeholder="Buscar por nome, matrícula, cargo..." style="flex:1; min-width:200px;" />
          <select id="colab-table-dept" class="form-control" style="width:200px;">
            <option value="">Todos os Departamentos</option>
          </select>
        </div>

        <!-- TABELA -->
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Colaborador</th>
                <th>Matrícula</th>
                <th>Departamento</th>
                <th>Cargo / Função</th>
                <th>Admissão</th>
                <th>Status</th>
                <th style="text-align:right;">Ações</th>
              </tr>
            </thead>
            <tbody id="colaboradores-table-body">
              ${[1,2,3,4,5].map(() => `
                <tr>
                  <td>
                    <div style="display:flex; align-items:center; gap:8px;">
                      <div class="skeleton skeleton-avatar" style="width:28px; height:28px;"></div>
                      <div style="flex:1;">
                        <div class="skeleton skeleton-text" style="width:100px; height:10px;"></div>
                        <div class="skeleton skeleton-text" style="width:70px; height:8px;"></div>
                      </div>
                    </div>
                  </td>
                  <td><div class="skeleton skeleton-text" style="width:50px;"></div></td>
                  <td><div class="skeleton skeleton-text" style="width:90px;"></div></td>
                  <td><div class="skeleton skeleton-text" style="width:80px;"></div></td>
                  <td><div class="skeleton skeleton-text" style="width:60px;"></div></td>
                  <td><div class="skeleton skeleton-text" style="width:40px;"></div></td>
                  <td style="text-align:right;"><div class="skeleton skeleton-text" style="width:50px; margin-left:auto;"></div></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <!-- PAGINAÇÃO -->
        <div class="pagination-container" id="colab-pagination"></div>
      </div>
    `;

    document.getElementById('colab-table-search')?.addEventListener('input', () => {
      this.currentPage = 1;
      this.filterTable();
    });
    document.getElementById('colab-table-dept')?.addEventListener('change', () => {
      this.currentPage = 1;
      this.filterTable();
    });

    await this.loadData();
  },

  async loadData() {
    try {
      this.colaboradores = await API.getColaboradores();
      this.departamentos = await API.getDepartamentos();
      this.cargos = await API.getCargos();

      const deptSelect = document.getElementById('colab-table-dept');
      if (deptSelect && this.departamentos) {
        deptSelect.innerHTML = '<option value="">Todos os Departamentos</option>';
        this.departamentos.forEach(d => {
          const opt = document.createElement('option');
          opt.value = d.id;
          opt.textContent = d.nome;
          deptSelect.appendChild(opt);
        });
      }

      this.filterTable();
    } catch (err) {
      document.getElementById('colaboradores-table-body').innerHTML = `
        <tr><td colspan="7" style="text-align:center; color:var(--danger);">Erro ao carregar colaboradores: ${err.message}</td></tr>
      `;
    }
  },

  filterTable() {
    const search = document.getElementById('colab-table-search')?.value.toLowerCase().trim() || '';
    const deptId = document.getElementById('colab-table-dept')?.value || '';

    const filtered = this.colaboradores.filter(c => {
      const matchSearch = !search ||
        c.nome.toLowerCase().includes(search) ||
        (c.matricula && c.matricula.toLowerCase().includes(search)) ||
        (c.nome_cargo && c.nome_cargo.toLowerCase().includes(search)) ||
        (c.email && c.email.toLowerCase().includes(search));

      const matchDept = !deptId || c.departamento_id == deptId;
      return matchSearch && matchDept;
    });

    const totalItems = filtered.length;
    const totalPages = Math.ceil(totalItems / this.pageSize) || 1;
    if (this.currentPage > totalPages) this.currentPage = totalPages;

    const startIdx = (this.currentPage - 1) * this.pageSize;
    const paginated = filtered.slice(startIdx, startIdx + this.pageSize);

    const tbody = document.getElementById('colaboradores-table-body');
    if (!tbody) return;

    if (paginated.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:24px; color:var(--text-muted);">Nenhum colaborador encontrado.</td></tr>`;
      document.getElementById('colab-pagination').innerHTML = '';
      return;
    }

    tbody.innerHTML = paginated.map(c => {
      const photo = c.foto || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + encodeURIComponent(c.nome);
      const statusBadge = c.status === 'ferias' ? 'badge-warning' : (c.status === 'afastado' ? 'badge-danger' : 'badge-success');

      return `
        <tr>
          <td>
            <div style="display:flex; align-items:center; gap:8px;">
              <img src="${photo}" style="width:28px; height:28px; border-radius:3px; object-fit:cover; border:1px solid var(--border-color);" />
              <div>
                <div style="font-weight:600; color:var(--text-main);">${c.nome}</div>
                <div style="font-size:11px; color:var(--text-muted);">${c.email || 'Sem e-mail'}</div>
              </div>
            </div>
          </td>
          <td><code style="font-size:11px; color:var(--text-muted);">${c.matricula || '—'}</code></td>
          <td>${c.departamento_nome ? `<span class="badge badge-default">${c.departamento_nome}</span>` : '<span style="color:var(--text-muted);">Sem setor</span>'}</td>
          <td><strong>${c.nome_cargo || '—'}</strong></td>
          <td>${c.data_admissao ? new Date(c.data_admissao).toLocaleDateString('pt-BR') : '—'}</td>
          <td><span class="badge ${statusBadge}">${c.status || 'Ativo'}</span></td>
          <td style="text-align:right; white-space:nowrap;">
            <button class="btn btn-outline" style="padding:2px 6px; font-size:11px;" onclick="ColaboradoresView.openMoverModal(${c.id}, '${c.nome.replace(/'/g, "\\'")}', ${c.departamento_id || 'null'})" title="Transferir Setor">Transferir</button>
            <button class="btn btn-outline" style="padding:2px 6px; font-size:11px;" onclick="ColaboradoresView.openEditModal(${c.id})" title="Editar">Editar</button>
            <button class="btn btn-danger" style="padding:2px 6px; font-size:11px;" onclick="ColaboradoresView.delete(${c.id}, '${c.nome.replace(/'/g, "\\'")}')" title="Excluir">Excluir</button>
          </td>
        </tr>
      `;
    }).join('');

    const pagContainer = document.getElementById('colab-pagination');
    if (pagContainer) {
      pagContainer.innerHTML = `
        <div>Mostrando <strong>${totalItems > 0 ? startIdx + 1 : 0}</strong> - <strong>${Math.min(startIdx + this.pageSize, totalItems)}</strong> de <strong>${totalItems}</strong> colaboradores</div>
        <div class="pagination-controls">
          <button class="page-btn" onclick="ColaboradoresView.goToPage(${this.currentPage - 1})" ${this.currentPage === 1 ? 'disabled' : ''}>Anterior</button>
          <span style="font-weight:600; margin:0 6px;">${this.currentPage} / ${totalPages}</span>
          <button class="page-btn" onclick="ColaboradoresView.goToPage(${this.currentPage + 1})" ${this.currentPage === totalPages ? 'disabled' : ''}>Próxima</button>
        </div>
      `;
    }
  },

  goToPage(page) {
    this.currentPage = page;
    this.filterTable();
  },

  openCreateModal(defaultDeptId = null) {
    this.uploadedPhotoBase64 = null;

    const deptOpts = (this.departamentos || []).map(d => `
      <option value="${d.id}" ${defaultDeptId == d.id ? 'selected' : ''}>${d.nome}</option>
    `).join('');

    const cargoOpts = (this.cargos || []).map(cg => `
      <option value="${cg.id}">${cg.nome_cargo} (${cg.nivel || 'Geral'})</option>
    `).join('');

    const gestorOpts = (this.colaboradores || []).map(c => `
      <option value="${c.id}">${c.nome} - ${c.nome_cargo || 'Sem cargo'}</option>
    `).join('');

    App.openModal(`
      <div class="modal-header">
        <h3>Novo Colaborador</h3>
        <button class="btn-icon" onclick="App.closeModal()" style="border:none; background:none; cursor:pointer; font-size:14px;">✕</button>
      </div>
      <form id="create-colab-form" onsubmit="ColaboradoresView.submitCreate(event)">
        <div class="modal-body">
          <div class="avatar-upload-box" id="avatar-drop-zone">
            <img id="avatar-preview-display" src="https://api.dicebear.com/7.x/avataaars/svg?seed=Novo" class="avatar-preview-img" alt="Foto" />
            <div class="avatar-upload-info">
              <div style="font-size:12px; font-weight:600; color:var(--text-main);">Foto do Colaborador</div>
              <div style="font-size:11px; color:var(--text-muted); margin-bottom:4px;">JPG ou PNG com boa resolução.</div>
              <label class="avatar-upload-btn">
                Selecionar Imagem
                <input type="file" id="colab-file-input" accept="image/*" style="display:none;" onchange="ColaboradoresView.handlePhotoUpload(event)" />
              </label>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group" style="grid-column: span 2;">
              <label class="form-label">Nome Completo *</label>
              <input type="text" name="nome" class="form-control" placeholder="Ex: Maria Silva" required />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Matrícula</label>
              <input type="text" name="matricula" class="form-control" placeholder="Ex: EMP-1042" />
            </div>
            <div class="form-group">
              <label class="form-label">E-mail Profissional</label>
              <input type="email" name="email" class="form-control" placeholder="maria@empresa.com" />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Telefone / Contato</label>
              <input type="text" name="telefone" id="input-colab-phone" class="form-control" placeholder="(11) 99999-9999" oninput="this.value = API.maskPhone(this.value)" />
            </div>
            <div class="form-group">
              <label class="form-label">Data de Admissão</label>
              <input type="date" name="data_admissao" class="form-control" value="${new Date().toISOString().split('T')[0]}" />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Departamento / Setor</label>
              <select name="departamento_id" class="form-control">
                <option value="">Selecione um departamento</option>
                ${deptOpts}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Cargo / Função</label>
              <select name="cargo_id" class="form-control">
                <option value="">Selecione um cargo</option>
                ${cargoOpts}
              </select>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Gestor Imediato</label>
              <select name="gestor_id" class="form-control">
                <option value="">Nenhum (Diretoria)</option>
                ${gestorOpts}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Status</label>
              <select name="status" class="form-control">
                <option value="ativo">Ativo</option>
                <option value="ferias">Férias</option>
                <option value="afastado">Afastado</option>
              </select>
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

  async handlePhotoUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    try {
      this.uploadedPhotoBase64 = await API.compressImage(file);
      const preview = document.getElementById('avatar-preview-display');
      if (preview) preview.src = this.uploadedPhotoBase64;
    } catch (err) {
      API.toast('Erro ao processar imagem: ' + err.message, 'error');
    }
  },

  async submitCreate(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());
    if (this.uploadedPhotoBase64) {
      data.foto = this.uploadedPhotoBase64;
    }

    try {
      await API.createColaborador(data);
      API.toast('Colaborador cadastrado com sucesso.', 'success');
      App.closeModal();
      this.loadData();
    } catch (err) {
      API.toast(err.message, 'error');
    }
  },

  async openEditModal(id) {
    try {
      const c = await API.getColaboradorById(id);
      this.uploadedPhotoBase64 = c.foto || null;

      const deptOpts = (this.departamentos || []).map(d => `
        <option value="${d.id}" ${c.departamento_id == d.id ? 'selected' : ''}>${d.nome}</option>
      `).join('');

      const cargoOpts = (this.cargos || []).map(cg => `
        <option value="${cg.id}" ${c.cargo_id == cg.id ? 'selected' : ''}>${cg.nome_cargo} (${cg.nivel || 'Geral'})</option>
      `).join('');

      const gestorOpts = (this.colaboradores || []).filter(item => item.id !== id).map(g => `
        <option value="${g.id}" ${c.gestor_id == g.id ? 'selected' : ''}>${g.nome} - ${g.nome_cargo || 'Sem cargo'}</option>
      `).join('');

      App.openModal(`
        <div class="modal-header">
          <h3>Editar Colaborador</h3>
          <button class="btn-icon" onclick="App.closeModal()" style="border:none; background:none; cursor:pointer; font-size:14px;">✕</button>
        </div>
        <form id="edit-colab-form" onsubmit="ColaboradoresView.submitEdit(event, ${id})">
          <div class="modal-body">
            <div class="avatar-upload-box">
              <img id="avatar-preview-display" src="${c.foto || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + encodeURIComponent(c.nome)}" class="avatar-preview-img" alt="Foto" />
              <div class="avatar-upload-info">
                <div style="font-size:12px; font-weight:600; color:var(--text-main);">Alterar Foto</div>
                <div style="font-size:11px; color:var(--text-muted); margin-bottom:4px;">Selecione uma imagem atualizada.</div>
                <label class="avatar-upload-btn">
                  Selecionar Foto
                  <input type="file" id="colab-file-input" accept="image/*" style="display:none;" onchange="ColaboradoresView.handlePhotoUpload(event)" />
                </label>
              </div>
            </div>

            <div class="form-row">
              <div class="form-group" style="grid-column: span 2;">
                <label class="form-label">Nome Completo *</label>
                <input type="text" name="nome" class="form-control" value="${c.nome}" required />
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Matrícula</label>
                <input type="text" name="matricula" class="form-control" value="${c.matricula || ''}" />
              </div>
              <div class="form-group">
                <label class="form-label">E-mail Profissional</label>
                <input type="email" name="email" class="form-control" value="${c.email || ''}" />
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Telefone / WhatsApp</label>
                <input type="text" name="telefone" class="form-control" value="${c.telefone || ''}" oninput="this.value = API.maskPhone(this.value)" />
              </div>
              <div class="form-group">
                <label class="form-label">Data de Admissão</label>
                <input type="date" name="data_admissao" class="form-control" value="${c.data_admissao || ''}" />
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Departamento / Setor</label>
                <select name="departamento_id" class="form-control">
                  <option value="">Selecione um departamento</option>
                  ${deptOpts}
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Cargo / Função</label>
                <select name="cargo_id" class="form-control">
                  <option value="">Selecione um cargo</option>
                  ${cargoOpts}
                </select>
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Gestor Imediato</label>
                <select name="gestor_id" class="form-control">
                  <option value="">Nenhum (Diretoria)</option>
                  ${gestorOpts}
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Status</label>
                <select name="status" class="form-control">
                  <option value="ativo" ${c.status === 'ativo' ? 'selected' : ''}>Ativo</option>
                  <option value="ferias" ${c.status === 'ferias' ? 'selected' : ''}>Férias</option>
                  <option value="afastado" ${c.status === 'afastado' ? 'selected' : ''}>Afastado</option>
                  <option value="desligado" ${c.status === 'desligado' ? 'selected' : ''}>Desligado</option>
                </select>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline" onclick="App.closeModal()">Cancelar</button>
            <button type="submit" class="btn btn-green">Salvar Alterações</button>
          </div>
        </form>
      `);
    } catch (err) {
      API.toast(err.message, 'error');
    }
  },

  async submitEdit(e, id) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());
    if (this.uploadedPhotoBase64) {
      data.foto = this.uploadedPhotoBase64;
    }

    try {
      await API.updateColaborador(id, data);
      API.toast('Colaborador atualizado com sucesso.', 'success');
      App.closeModal();
      this.loadData();
    } catch (err) {
      API.toast(err.message, 'error');
    }
  },

  openMoverModal(id, nome, currentDeptId) {
    const deptOpts = (this.departamentos || []).map(d => `
      <option value="${d.id}" ${currentDeptId == d.id ? 'selected' : ''}>${d.nome} (${d.sigla || 'SET'})</option>
    `).join('');

    App.openModal(`
      <div class="modal-header">
        <h3>Transferir Setor: ${nome}</h3>
        <button class="btn-icon" onclick="App.closeModal()" style="border:none; background:none; cursor:pointer; font-size:14px;">✕</button>
      </div>
      <form onsubmit="ColaboradoresView.submitMover(event, ${id})">
        <div class="modal-body">
          <p style="font-size:12px; color:var(--text-muted); margin-bottom:14px;">
            Selecione o departamento de destino. A alteração será registrada automaticamente no histórico.
          </p>
          <div class="form-group">
            <label class="form-label">Departamento de Destino *</label>
            <select name="departamento_id" class="form-control" required>
              <option value="">Selecione o departamento</option>
              ${deptOpts}
            </select>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-outline" onclick="App.closeModal()">Cancelar</button>
          <button type="submit" class="btn btn-green">Confirmar Transferência</button>
        </div>
      </form>
    `);
  },

  async submitMover(e, id) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const deptId = formData.get('departamento_id');

    try {
      await API.moverColaborador(id, deptId);
      API.toast('Colaborador transferido com sucesso.', 'success');
      App.closeModal();
      this.loadData();
    } catch (err) {
      API.toast(err.message, 'error');
    }
  },

  async delete(id, nome) {
    if (!confirm(`Deseja realmente remover o colaborador "${nome}"?`)) {
      return;
    }

    try {
      await API.deleteColaborador(id);
      API.toast('Colaborador removido.', 'success');
      this.loadData();
    } catch (err) {
      API.toast(err.message, 'error');
    }
  },

  openImportModal() {
    App.openModal(`
      <div class="modal-header">
        <h3>Importação de Colaboradores (CSV)</h3>
        <button class="btn-icon" onclick="App.closeModal()" style="border:none; background:none; cursor:pointer; font-size:14px;">✕</button>
      </div>
      <div class="modal-body">
        <p style="font-size:12px; color:var(--text-muted); margin-bottom:10px;">
          Cole os dados da planilha no formato CSV (separado por vírgula ou ponto-e-vírgula):
        </p>
        <textarea id="import-csv-text" class="form-control" rows="8" placeholder="Nome, Email, Departamento, Cargo, Matrícula&#10;Ana Paula, ana@empresa.com, Tecnologia, Desenvolvedora, EMP-101&#10;Lucas Santos, lucas@empresa.com, Vendas, Executivo de Contas, EMP-102"></textarea>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-outline" onclick="App.closeModal()">Cancelar</button>
        <button type="button" class="btn btn-green" onclick="ColaboradoresView.processCsvImport()">Importar</button>
      </div>
    `);
  },

  async processCsvImport() {
    const rawText = document.getElementById('import-csv-text')?.value.trim();
    if (!rawText) {
      API.toast('Cole o conteúdo CSV para importar.', 'error');
      return;
    }

    const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length < 2) {
      API.toast('O arquivo deve conter ao menos o cabeçalho e 1 colaborador.', 'error');
      return;
    }

    const delimiter = lines[0].includes(';') ? ';' : ',';
    const list = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(delimiter).map(c => c.trim().replace(/"/g, ''));
      if (cols.length > 0 && cols[0]) {
        list.push({
          nome: cols[0],
          email: cols[1] || '',
          departamento: cols[2] || '',
          cargo: cols[3] || '',
          matricula: cols[4] || ''
        });
      }
    }

    try {
      const res = await API.importColaboradores(list);
      API.toast(res.message, 'success');
      App.closeModal();
      this.loadData();
    } catch (err) {
      API.toast(err.message, 'error');
    }
  },

  openPullCloudModal() {
    App.openModal(`
      <div class="modal-header">
        <h3>☁️ Puxar Colaboradores do Control iD Nuvem (RHiD)</h3>
        <button class="btn-icon" onclick="App.closeModal()" style="border:none; background:none; cursor:pointer; font-size:14px;">✕</button>
      </div>
      <form onsubmit="ColaboradoresView.submitPullCloud(event)">
        <div class="modal-body">
          <p style="font-size:12px; color:var(--text-muted); margin-bottom:16px;">
            Conecta na API oficial em nuvem do <strong>RHiD (rhid.com.br)</strong> e importa os colaboradores cadastrados diretamente para a empresa ativa (ex: <strong>TESTE01</strong>).
          </p>

          <div class="form-group">
            <label class="form-label">E-mail de Login no RHiD Cloud *</label>
            <input type="email" name="email" id="rhid-cloud-email" class="form-control" placeholder="seu-email@empresa.com" required />
          </div>

          <div class="form-group">
            <label class="form-label">Senha de Acesso ao RHiD Cloud *</label>
            <input type="password" name="password" id="rhid-cloud-password" class="form-control" placeholder="••••••••" required />
          </div>

          <div id="pull-cloud-feedback" style="display:none; padding:10px 12px; border-radius:var(--radius-sm); font-size:12px; margin-top:10px;"></div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-outline" onclick="App.closeModal()">Cancelar</button>
          <button type="submit" id="btn-submit-pull-cloud" class="btn btn-primary" style="background:#0284c7;">
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
    const btn = document.getElementById('btn-submit-pull-cloud');
    const fb = document.getElementById('pull-cloud-feedback');

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
        ColaboradoresView.loadData();
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
  }
};
