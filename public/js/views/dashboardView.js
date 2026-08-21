const DashboardView = {
  async render(container) {
    container.innerHTML = `
      <div style="display:flex; justify-content:center; padding: 40px;">
        <div class="skeleton skeleton-card" style="width:100%; max-width:800px; height:180px;"></div>
      </div>
    `;

    try {
      const data = await API.getDashboard();
      const { kpis, distribuicaoDept, recentes, ultimasMovimentacoes } = data;

      let deptListHtml = '';
      if (distribuicaoDept && distribuicaoDept.length > 0) {
        deptListHtml = distribuicaoDept.map(d => `
          <div style="display:flex; align-items:center; justify-content:space-between; padding:10px 0; border-bottom:1px solid var(--border-color);">
            <div style="display:flex; align-items:center; gap:8px;">
              <div style="width:10px; height:10px; border-radius:2px; background:${d.cor || 'var(--brand-primary)'};"></div>
              <div>
                <strong style="font-size:12px; color:var(--text-main);">${d.nome}</strong>
                <span style="font-size:11px; color:var(--text-muted); margin-left:4px;">(${d.sigla || 'SET'})</span>
              </div>
            </div>
            <span class="badge badge-info">${d.total} membro(s)</span>
          </div>
        `).join('');
      } else {
        deptListHtml = '<p style="color:var(--text-muted); font-size:12px; padding:10px 0;">Nenhum departamento cadastrado.</p>';
      }

      let recentesHtml = '';
      if (recentes && recentes.length > 0) {
        recentesHtml = recentes.map(r => `
          <div style="display:flex; align-items:center; justify-content:space-between; padding:10px 0; border-bottom:1px solid var(--border-color);">
            <div style="display:flex; align-items:center; gap:10px;">
              <img src="${r.foto || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + encodeURIComponent(r.nome)}" 
                   style="width:30px; height:30px; border-radius:4px; object-fit:cover; border:1px solid var(--border-color);" />
              <div>
                <div style="font-size:12px; font-weight:600; color:var(--text-main);">${r.nome}</div>
                <div style="font-size:11px; color:var(--text-muted);">${r.nome_cargo || 'Sem cargo'} · ${r.departamento_nome || 'Sem setor'}</div>
              </div>
            </div>
            <span class="badge badge-success">Admitido</span>
          </div>
        `).join('');
      } else {
        recentesHtml = '<p style="color:var(--text-muted); font-size:12px; padding:10px 0;">Nenhuma admissão recente.</p>';
      }

      let histHtml = '';
      if (ultimasMovimentacoes && ultimasMovimentacoes.length > 0) {
        histHtml = ultimasMovimentacoes.map(h => `
          <div style="display:flex; gap:10px; padding:8px 0; border-bottom:1px solid var(--border-color);">
            <div style="width:6px; height:6px; border-radius:1px; background:var(--brand-primary); margin-top:6px;"></div>
            <div style="flex:1;">
              <div style="font-size:12px; color:var(--text-main); font-weight:500;">${h.descricao}</div>
              <div style="font-size:11px; color:var(--text-muted); margin-top:1px;">
                ${new Date(h.created_at).toLocaleString('pt-BR')} ${h.usuario_nome ? `· por ${h.usuario_nome}` : ''}
              </div>
            </div>
          </div>
        `).join('');
      } else {
        histHtml = '<p style="color:var(--text-muted); font-size:12px; padding:10px 0;">Nenhuma movimentação registrada.</p>';
      }

      container.innerHTML = `
        <!-- 4 KPI STAT BOXES (CLEAN ENTERPRISE) -->
        <div class="kpi-grid-4">
          <div class="kpi-stat-box" onclick="App.navigate('colaboradores')" style="cursor:pointer;">
            <div class="kpi-stat-icon-wrapper" style="color:var(--brand-primary);">${Icons.users}</div>
            <div class="kpi-stat-content">
              <div class="kpi-stat-value">${kpis.totalColaboradores}</div>
              <div class="kpi-stat-label">Colaboradores</div>
            </div>
          </div>

          <div class="kpi-stat-box" onclick="App.navigate('departamentos')" style="cursor:pointer;">
            <div class="kpi-stat-icon-wrapper" style="color:var(--brand-accent-green);">${Icons.building}</div>
            <div class="kpi-stat-content">
              <div class="kpi-stat-value">${kpis.totalDepartamentos}</div>
              <div class="kpi-stat-label">Departamentos</div>
            </div>
          </div>

          <div class="kpi-stat-box" onclick="App.navigate('departamentos')" style="cursor:pointer;">
            <div class="kpi-stat-icon-wrapper" style="color:#d97706;">${Icons.briefcase}</div>
            <div class="kpi-stat-content">
              <div class="kpi-stat-value">${kpis.totalCargos}</div>
              <div class="kpi-stat-label">Cargos & Funções</div>
            </div>
          </div>

          <div class="kpi-stat-box" onclick="App.navigate('configuracoes')" style="cursor:pointer;">
            <div class="kpi-stat-icon-wrapper" style="color:#7c3aed;">${Icons.user}</div>
            <div class="kpi-stat-content">
              <div class="kpi-stat-value">${kpis.totalUsuarios}</div>
              <div class="kpi-stat-label">Usuários Ativos</div>
            </div>
          </div>
        </div>

        <!-- LISTAS LIMPAS E CARDS -->
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap:18px; margin-top:8px;">
          <!-- DEPARTAMENTOS -->
          <div class="card">
            <div class="card-header">
              <div class="card-title-with-icon">
                ${Icons.building} Departamentos & Alocação
              </div>
              <button class="btn btn-outline" style="padding:3px 8px; font-size:11px;" onclick="App.navigate('departamentos')">Ver Todos</button>
            </div>
            <div>${deptListHtml}</div>
          </div>

          <!-- ÚLTIMAS CONTRATAÇÕES -->
          <div class="card">
            <div class="card-header">
              <div class="card-title-with-icon">
                ${Icons.users} Últimas Admissões
              </div>
              <button class="btn btn-outline" style="padding:3px 8px; font-size:11px;" onclick="App.navigate('colaboradores')">Gerenciar</button>
            </div>
            <div>${recentesHtml}</div>
          </div>

          <!-- HISTÓRICO RECENTE -->
          <div class="card" style="grid-column: 1 / -1;">
            <div class="card-header">
              <div class="card-title-with-icon">
                ${Icons.history} Atividades Recentes do Sistema
              </div>
              <button class="btn btn-outline" style="padding:3px 8px; font-size:11px;" onclick="App.navigate('historico')">Ver Auditoria Completa</button>
            </div>
            <div>${histHtml}</div>
          </div>
        </div>
      `;
    } catch (err) {
      container.innerHTML = `<div class="card"><p style="color:var(--danger);">Erro ao carregar dashboard: ${err.message}</p></div>`;
    }
  }
};
