const OrganogramaView = {
  currentZoom: 1,
  treeData: null,

  async render(container) {
    container.innerHTML = `
      <div class="organograma-toolbar">
        <div style="display:flex; align-items:center; gap:10px;">
          <input type="text" id="tree-search-input" class="form-control" placeholder="Buscar setor ou líder..." style="width:240px;" />
          <button class="btn btn-outline" onclick="OrganogramaView.resetView()">🎯 Centralizar</button>
        </div>

        <div style="display:flex; align-items:center; gap:8px;">
          <button class="btn btn-outline" onclick="window.print()" title="Imprimir / Salvar em PDF">🖨️ Exportar / Imprimir</button>
          <button class="btn btn-outline" style="padding:6px 12px;" onclick="OrganogramaView.zoom(-0.1)" title="Diminuir Zoom">🔍 -</button>
          <span id="zoom-indicator" style="font-size:12px; font-weight:700; min-width:45px; text-align:center;">100%</span>
          <button class="btn btn-outline" style="padding:6px 12px;" onclick="OrganogramaView.zoom(0.1)" title="Aumentar Zoom">🔍 +</button>
          <button class="btn btn-green" onclick="DepartamentosView.openCreateModal()">+ Novo Setor Raiz</button>
        </div>
      </div>

      <div class="organograma-wrapper" id="organograma-viewport">
        <div class="tree-container" id="tree-root-container">
          <div style="display:flex; gap:24px; justify-content:center;">
            <div class="skeleton skeleton-card" style="width:260px; height:130px;"></div>
          </div>
        </div>
      </div>
    `;

    document.getElementById('tree-search-input')?.addEventListener('input', (e) => {
      this.filterTree(e.target.value.toLowerCase());
    });

    await this.loadTree();
  },

  async loadTree() {
    try {
      const response = await API.getDepartamentosTree();
      this.treeData = response.tree;
      const rootContainer = document.getElementById('tree-root-container');
      if (!rootContainer) return;

      if (!this.treeData || this.treeData.length === 0) {
        rootContainer.innerHTML = `
          <div style="text-align:center; padding: 40px;">
            <p style="color:var(--text-muted); margin-bottom:12px;">Nenhum departamento cadastrado ainda.</p>
            <button class="btn btn-green" onclick="DepartamentosView.openCreateModal()">Criar Primeiro Setor</button>
          </div>
        `;
        return;
      }

      rootContainer.innerHTML = `
        <div style="display:flex; gap:32px; justify-content:center; align-items:flex-start;">
          ${this.treeData.map(node => this.renderNode(node)).join('')}
        </div>
      `;
    } catch (err) {
      const rootContainer = document.getElementById('tree-root-container');
      if (rootContainer) {
        rootContainer.innerHTML = `<p style="color:var(--danger);">Erro ao carregar organograma: ${err.message}</p>`;
      }
    }
  },

  renderNode(node) {
    const hasChildren = node.children && node.children.length > 0;
    const leaderPhoto = node.responsavel_foto || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + encodeURIComponent(node.responsavel_nome || 'Lead');

    return `
      <div class="tree-node" id="node-${node.id}">
        <div class="node-card" style="border-top: 4px solid ${node.cor || 'var(--brand-primary)'};" onclick="OrganogramaView.showDeptDetails(${node.id})">
          <div class="node-header">
            <span class="node-sigla-badge" style="background:${node.cor || 'var(--brand-primary)'};">${node.sigla || 'SET'}</span>
            <span class="node-count-badge">👥 ${node.total_colaboradores}</span>
          </div>

          <div class="node-title">${node.nome}</div>

          ${node.responsavel_nome ? `
            <div class="node-leader">
              <img src="${leaderPhoto}" class="leader-avatar" alt="${node.responsavel_nome}" />
              <div class="leader-info">
                <div class="leader-name">${node.responsavel_nome}</div>
                <div class="leader-role">${node.responsavel_cargo || 'Responsável'}</div>
              </div>
            </div>
          ` : `
            <div style="font-size:11px; color:var(--text-muted); padding-top:6px; border-top:1px solid var(--border-color);">
              ${node.ramal ? `📞 Ramal: ${node.ramal}` : 'Sem gestor definido'}
            </div>
          `}

          <!-- AÇÕES RÁPIDAS NO CARD -->
          <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px; padding-top:8px; border-top:1px dashed var(--border-color);" onclick="event.stopPropagation()">
            <button class="btn btn-outline" style="padding:2px 8px; font-size:10px;" onclick="DepartamentosView.openCreateModal(${node.id})" title="Adicionar Subdepartamento">
              ➕ Sub-Setor
            </button>
            <button class="btn btn-outline" style="padding:2px 8px; font-size:10px;" onclick="DepartamentosView.openEditModal(${node.id})">
              ✏️ Editar
            </button>
          </div>
        </div>

        ${hasChildren ? `
          <button class="node-toggle-btn" onclick="event.stopPropagation(); OrganogramaView.toggleCollapse(${node.id})">▼</button>
          <div class="tree-children" id="children-${node.id}">
            ${node.children.map(child => this.renderNode(child)).join('')}
          </div>
        ` : ''}
      </div>
    `;
  },

  toggleCollapse(nodeId) {
    const childrenContainer = document.getElementById(`children-${nodeId}`);
    if (childrenContainer) {
      const isHidden = childrenContainer.style.display === 'none';
      childrenContainer.style.display = isHidden ? 'flex' : 'none';
      const btn = document.querySelector(`#node-${nodeId} > .node-toggle-btn`);
      if (btn) btn.textContent = isHidden ? '▼' : '▶';
    }
  },

  zoom(delta) {
    this.currentZoom = Math.min(Math.max(this.currentZoom + delta, 0.4), 1.8);
    const container = document.getElementById('tree-root-container');
    if (container) {
      container.style.transform = `scale(${this.currentZoom})`;
      container.style.transformOrigin = 'top center';
      container.style.transition = 'transform 0.15s ease-out';
    }
    const indicator = document.getElementById('zoom-indicator');
    if (indicator) indicator.textContent = `${Math.round(this.currentZoom * 100)}%`;
  },

  resetView() {
    this.currentZoom = 1;
    this.zoom(0);
    const viewport = document.getElementById('organograma-viewport');
    if (viewport) {
      viewport.scrollTo({ top: 0, left: viewport.scrollWidth / 4, behavior: 'smooth' });
    }
  },

  filterTree(query) {
    const cards = document.querySelectorAll('.node-card');
    cards.forEach(card => {
      const text = card.textContent.toLowerCase();
      if (!query || text.includes(query)) {
        card.style.opacity = '1';
        card.style.borderColor = query ? 'var(--brand-primary)' : 'var(--border-color)';
      } else {
        card.style.opacity = '0.3';
        card.style.borderColor = 'var(--border-color)';
      }
    });
  },

  async showDeptDetails(deptId) {
    try {
      const colabs = await API.getColaboradores({ departamento_id: deptId });
      const deptList = await API.getDepartamentos();
      const currentDept = deptList.find(d => d.id === deptId);

      let colabsHtml = '';
      if (colabs.length > 0) {
        colabsHtml = colabs.map(c => `
          <div style="display:flex; align-items:center; justify-content:space-between; padding:10px 0; border-bottom:1px solid var(--border-color);">
            <div style="display:flex; align-items:center; gap:10px;">
              <img src="${c.foto || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + encodeURIComponent(c.nome)}" 
                   style="width:36px; height:36px; border-radius:50%; object-fit:cover;" />
              <div>
                <div style="font-size:13px; font-weight:700;">${c.nome}</div>
                <div style="font-size:11px; color:var(--text-muted);">${c.nome_cargo || 'Sem cargo'}</div>
              </div>
            </div>
            <button class="btn btn-outline" style="padding:4px 8px; font-size:11px;" onclick="ColaboradoresView.openMoverModal(${c.id}, '${c.nome.replace(/'/g, "\\'")}', ${deptId})">
              Mover Setor
            </button>
          </div>
        `).join('');
      } else {
        colabsHtml = '<p style="color:var(--text-muted); font-size:13px; padding:10px 0;">Nenhum colaborador neste departamento.</p>';
      }

      App.openModal(`
        <div class="modal-header">
          <h3>🏢 ${currentDept ? currentDept.nome : 'Departamento'}</h3>
          <button class="btn-icon" onclick="App.closeModal()" style="border:none; background:none; cursor:pointer; font-size:16px;">✕</button>
        </div>
        <div class="modal-body">
          <div style="font-size:13px; color:var(--text-muted); margin-bottom:16px;">
            Sigla: <strong>${currentDept?.sigla || '—'}</strong> | Ramal: <strong>${currentDept?.ramal || '—'}</strong>
          </div>
          <h4 style="font-size:13px; font-weight:800; text-transform:uppercase; color:var(--text-muted); margin-bottom:10px;">Membros da Equipe (${colabs.length}):</h4>
          <div style="max-height:280px; overflow-y:auto;">
            ${colabsHtml}
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" onclick="App.closeModal()">Fechar</button>
          <button class="btn btn-green" onclick="App.closeModal(); ColaboradoresView.openCreateModal(${deptId})">+ Adicionar Colaborador</button>
        </div>
      `);
    } catch (err) {
      API.toast('Erro ao abrir detalhes: ' + err.message, 'error');
    }
  }
};
