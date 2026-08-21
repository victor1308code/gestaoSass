const CarometroView = {
  colaboradores: [],
  departamentos: [],

  async render(container) {
    container.innerHTML = `
      <div class="card" style="margin-bottom: 20px;">
        <div class="card-header" style="flex-wrap:wrap; gap:12px;">
          <div>
            <div class="card-title-with-icon">
              ${Icons.image} Diretório Visual (Carômetro)
            </div>
            <p style="font-size:12px; color:var(--text-muted); margin-top:2px;">Visualização de fotos e contatos da equipe.</p>
          </div>
          <div style="display:flex; gap:8px;">
            <input type="text" id="carometro-search" class="form-control" placeholder="Buscar pessoa..." style="width:200px;" />
            <select id="carometro-dept-filter" class="form-control" style="width:180px;">
              <option value="">Todos os Setores</option>
            </select>
          </div>
        </div>

        <div class="carometro-grid" id="carometro-cards-container">
          <div style="display:flex; gap:14px; flex-wrap:wrap;">
            ${[1,2,3,4].map(() => `<div class="skeleton skeleton-card" style="width:200px; height:240px;"></div>`).join('')}
          </div>
        </div>
      </div>
    `;

    document.getElementById('carometro-search')?.addEventListener('input', () => this.filterCards());
    document.getElementById('carometro-dept-filter')?.addEventListener('change', () => this.filterCards());

    await this.loadData();
  },

  async loadData() {
    try {
      this.colaboradores = await API.getColaboradores();
      this.departamentos = await API.getDepartamentos();

      const deptSelect = document.getElementById('carometro-dept-filter');
      if (deptSelect && this.departamentos) {
        deptSelect.innerHTML = '<option value="">Todos os Setores</option>';
        this.departamentos.forEach(d => {
          const opt = document.createElement('option');
          opt.value = d.id;
          opt.textContent = d.nome;
          deptSelect.appendChild(opt);
        });
      }

      this.filterCards();
    } catch (err) {
      document.getElementById('carometro-cards-container').innerHTML = `
        <p style="color:var(--danger); text-align:center; padding:20px;">Erro: ${err.message}</p>
      `;
    }
  },

  filterCards() {
    const search = document.getElementById('carometro-search')?.value.toLowerCase().trim() || '';
    const deptId = document.getElementById('carometro-dept-filter')?.value || '';

    const filtered = this.colaboradores.filter(c => {
      const matchSearch = !search ||
        c.nome.toLowerCase().includes(search) ||
        (c.nome_cargo && c.nome_cargo.toLowerCase().includes(search)) ||
        (c.matricula && c.matricula.toLowerCase().includes(search));

      const matchDept = !deptId || c.departamento_id == deptId;
      return matchSearch && matchDept;
    });

    const container = document.getElementById('carometro-cards-container');
    if (!container) return;

    if (filtered.length === 0) {
      container.innerHTML = `<p style="color:var(--text-muted); text-align:center; padding:30px; width:100%;">Nenhum colaborador encontrado.</p>`;
      return;
    }

    container.innerHTML = filtered.map(c => {
      const photo = c.foto || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + encodeURIComponent(c.nome);
      return `
        <div class="person-card" onclick="CarometroView.openProfile(${c.id})">
          <img src="${photo}" class="person-photo" alt="${c.nome}" />
          <div class="person-name">${c.nome}</div>
          <div class="person-role">${c.nome_cargo || 'Sem cargo'}</div>
          <div class="person-dept">${c.departamento_nome || 'Sem setor'}</div>
        </div>
      `;
    }).join('');
  },

  async openProfile(id) {
    try {
      const c = await API.getColaboradorById(id);
      const photo = c.foto || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + encodeURIComponent(c.nome);

      App.openModal(`
        <div class="modal-header">
          <h3>Ficha do Colaborador</h3>
          <button class="btn-icon" onclick="App.closeModal()" style="border:none; background:none; cursor:pointer; font-size:14px;">✕</button>
        </div>
        <div class="modal-body" style="text-align:center;">
          <img src="${photo}" style="width:72px; height:72px; border-radius:4px; object-fit:cover; margin-bottom:12px; border:1px solid var(--border-color);" />
          <h2 style="font-size:16px; font-weight:700; color:var(--text-main);">${c.nome}</h2>
          <p style="font-size:12px; color:var(--brand-primary); font-weight:600; margin-bottom:16px;">${c.nome_cargo || 'Cargo não informado'}</p>

          <div style="text-align:left; background:var(--bg-surface-subtle); padding:14px; border-radius:var(--radius-sm); border:1px solid var(--border-color); font-size:12px; display:grid; gap:8px;">
            <div><strong>Matrícula:</strong> ${c.matricula || '—'}</div>
            <div><strong>Departamento:</strong> ${c.departamento_nome || '—'}</div>
            <div><strong>E-mail:</strong> ${c.email || '—'}</div>
            <div><strong>Telefone:</strong> ${c.telefone || '—'}</div>
            <div><strong>Admissão:</strong> ${c.data_admissao ? new Date(c.data_admissao).toLocaleDateString('pt-BR') : '—'}</div>
            <div><strong>Status:</strong> <span class="badge ${c.status === 'ativo' ? 'badge-success' : 'badge-warning'}">${c.status || 'Ativo'}</span></div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" onclick="App.closeModal()">Fechar</button>
          <button class="btn btn-primary" onclick="App.closeModal(); ColaboradoresView.openEditModal(${c.id})">Editar Dados</button>
        </div>
      `);
    } catch (err) {
      API.toast(err.message, 'error');
    }
  }
};
