const CarometroView = {
  colaboradores: [],
  departamentos: [],
  cargos: [],

  async render(container) {
    container.innerHTML = `
      <div class="carometro-toolbar">
        <div class="carometro-filters">
          <input type="text" id="carometro-search" class="form-control" placeholder="Buscar colaborador por nome, cargo ou e-mail..." style="flex:1;" />
          
          <select id="carometro-dept-filter" class="form-control" style="width:200px;">
            <option value="">Todos os Setores</option>
          </select>

          <select id="carometro-status-filter" class="form-control" style="width:140px;">
            <option value="">Todos Status</option>
            <option value="ativo">Ativo</option>
            <option value="ferias">Férias</option>
            <option value="afastado">Afastado</option>
          </select>
        </div>

        <div style="display:flex; gap:10px;">
          <button class="btn btn-primary" onclick="ColaboradoresView.openCreateModal()">+ Novo Colaborador</button>
        </div>
      </div>

      <div id="carometro-grid-container" class="carometro-grid">
        <div class="spinner">Carregando carômetro...</div>
      </div>
    `;

    // Carrega filtros
    this.departamentos = await API.getDepartamentos();
    const deptSelect = document.getElementById('carometro-dept-filter');
    if (deptSelect && this.departamentos) {
      this.departamentos.forEach(d => {
        const opt = document.createElement('option');
        opt.value = d.id;
        opt.textContent = `${d.nome} ${d.sigla ? `(${d.sigla})` : ''}`;
        deptSelect.appendChild(opt);
      });
    }

    // Event listeners
    document.getElementById('carometro-search')?.addEventListener('input', () => this.applyFilters());
    document.getElementById('carometro-dept-filter')?.addEventListener('change', () => this.applyFilters());
    document.getElementById('carometro-status-filter')?.addEventListener('change', () => this.applyFilters());

    await this.loadData();
  },

  async loadData() {
    try {
      this.colaboradores = await API.getColaboradores();
      this.applyFilters();
    } catch (err) {
      document.getElementById('carometro-grid-container').innerHTML = `
        <p style="color:var(--danger);">Erro ao carregar colaboradores: ${err.message}</p>
      `;
    }
  },

  applyFilters() {
    const search = document.getElementById('carometro-search')?.value.toLowerCase().trim() || '';
    const deptId = document.getElementById('carometro-dept-filter')?.value || '';
    const status = document.getElementById('carometro-status-filter')?.value || '';

    const filtered = this.colaboradores.filter(c => {
      const matchSearch = !search || 
        c.nome.toLowerCase().includes(search) || 
        (c.nome_cargo && c.nome_cargo.toLowerCase().includes(search)) ||
        (c.email && c.email.toLowerCase().includes(search)) ||
        (c.matricula && c.matricula.toLowerCase().includes(search));

      const matchDept = !deptId || c.departamento_id == deptId;
      const matchStatus = !status || c.status === status;

      return matchSearch && matchDept && matchStatus;
    });

    this.renderGrid(filtered);
  },

  renderGrid(list) {
    const container = document.getElementById('carometro-grid-container');
    if (!container) return;

    if (list.length === 0) {
      container.innerHTML = `
        <div style="grid-column:1/-1; text-align:center; padding:50px; background:var(--bg-surface); border-radius:var(--radius-lg); border:1px solid var(--border-color);">
          <p style="font-size:16px; font-weight:600; color:var(--text-secondary); margin-bottom:8px;">Nenhum colaborador encontrado</p>
          <p style="font-size:13px; color:var(--text-muted);">Tente ajustar seus filtros de busca ou cadastre um novo colaborador.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = list.map(c => {
      const photo = c.foto || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + encodeURIComponent(c.nome);
      const statusClass = c.status === 'ferias' ? 'status-ferias' : (c.status === 'afastado' ? 'status-afastado' : 'status-ativo');
      const dept = c.departamento_nome ? `${c.departamento_nome} ${c.departamento_sigla ? `(${c.departamento_sigla})` : ''}` : 'Sem departamento';

      return `
        <div class="colab-card" onclick="CarometroView.openProfileModal(${c.id})">
          <div class="colab-avatar-container">
            <img src="${photo}" alt="${c.nome}" class="colab-avatar" />
            <div class="colab-status-dot ${statusClass}" title="Status: ${c.status || 'Ativo'}"></div>
          </div>

          <div class="colab-name">${c.nome}</div>
          <div class="colab-role">${c.nome_cargo || 'Cargo não informado'}</div>
          <div class="colab-dept-pill">${dept}</div>

          <div class="colab-contacts">
            ${c.email ? `<a href="mailto:${c.email}" class="colab-contact-link" title="${c.email}" onclick="event.stopPropagation();">✉️ E-mail</a>` : ''}
            ${c.telefone ? `<a href="tel:${c.telefone}" class="colab-contact-link" title="${c.telefone}" onclick="event.stopPropagation();">📞 Contato</a>` : ''}
            ${c.matricula ? `<span style="font-size:11px; color:var(--text-muted);">Matr: ${c.matricula}</span>` : ''}
          </div>
        </div>
      `;
    }).join('');
  },

  async openProfileModal(id) {
    try {
      const c = await API.getColaboradorById(id);
      const photo = c.foto || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + encodeURIComponent(c.nome);

      let histHtml = '';
      if (c.historico && c.historico.length > 0) {
        histHtml = c.historico.map(h => `
          <div style="font-size:12px; padding:6px 0; border-bottom:1px solid var(--border-color);">
            <div style="color:var(--text-primary); font-weight:600;">${h.descricao}</div>
            <div style="color:var(--text-muted); font-size:11px;">${new Date(h.created_at).toLocaleDateString('pt-BR')} ${h.usuario_nome ? `por ${h.usuario_nome}` : ''}</div>
          </div>
        `).join('');
      } else {
        histHtml = '<p style="color:var(--text-muted); font-size:12px;">Nenhum histórico registrado.</p>';
      }

      App.openModal(`
        <div class="modal-header">
          <h3>Perfil do Colaborador</h3>
          <button class="btn-icon" onclick="App.closeModal()">✕</button>
        </div>
        <div class="modal-body">
          <div style="display:flex; gap:20px; align-items:center; margin-bottom:20px; padding-bottom:16px; border-bottom:1px solid var(--border-color);">
            <img src="${photo}" style="width:80px; height:80px; border-radius:50%; object-fit:cover; border:2px solid var(--brand-primary);" />
            <div>
              <h2 style="font-size:18px; font-weight:800; color:var(--text-primary);">${c.nome}</h2>
              <div style="font-size:14px; font-weight:600; color:var(--brand-primary);">${c.nome_cargo || 'Cargo não informado'}</div>
              <div style="font-size:12px; color:var(--text-muted); margin-top:2px;">
                ${c.departamento_nome || 'Sem departamento'} · Matrícula: ${c.matricula || '—'}
              </div>
            </div>
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; font-size:13px; margin-bottom:20px;">
            <div><strong>E-mail:</strong> ${c.email || '—'}</div>
            <div><strong>Telefone:</strong> ${c.telefone || '—'}</div>
            <div><strong>Data de Admissão:</strong> ${c.data_admissao ? new Date(c.data_admissao).toLocaleDateString('pt-BR') : '—'}</div>
            <div><strong>Líder Imediato:</strong> ${c.gestor_nome || 'Nenhum'}</div>
            <div><strong>Status Funcional:</strong> <span class="badge badge-info">${c.status || 'Ativo'}</span></div>
          </div>

          <h4 style="font-size:13px; font-weight:700; text-transform:uppercase; color:var(--text-muted); margin-bottom:8px;">Histórico Funcional:</h4>
          <div style="max-height:160px; overflow-y:auto; background:var(--bg-secondary); padding:10px 14px; border-radius:var(--radius-md);">
            ${histHtml}
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="App.closeModal()">Fechar</button>
          <button class="btn btn-primary" onclick="App.closeModal(); ColaboradoresView.openEditModal(${c.id})">Editar Dados</button>
        </div>
      `);
    } catch (err) {
      API.toast('Erro ao abrir perfil: ' + err.message, 'error');
    }
  }
};
