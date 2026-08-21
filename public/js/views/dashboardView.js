const DashboardView = {
  async render(container) {
    container.innerHTML = `
      <div style="display:flex; justify-content:center; padding: 40px;">
        <div class="spinner">Carregando painel...</div>
      </div>
    `;

    try {
      const data = await API.getDashboard();
      const { kpis, distribuicaoDept, recentes, ultimasMovimentacoes } = data;

      let deptListHtml = '';
      if (distribuicaoDept && distribuicaoDept.length > 0) {
        deptListHtml = distribuicaoDept.map(d => `
          <div style="display:flex; align-items:center; justify-content:space-between; padding:12px 0; border-bottom:1px solid var(--border-color);">
            <div style="display:flex; align-items:center; gap:10px;">
              <div style="width:12px; height:12px; border-radius:3px; background:${d.cor || 'var(--brand-primary)'};"></div>
              <div>
                <strong style="font-size:13px; color:var(--text-main);">${d.nome}</strong>
                <span style="font-size:11px; color:var(--text-muted); margin-left:4px;">(${d.sigla || 'SET'})</span>
              </div>
            </div>
            <span class="badge badge-info">${d.total} colaborador(es)</span>
          </div>
        `).join('');
      } else {
        deptListHtml = '<p style="color:var(--text-muted); font-size:13px; padding:10px 0;">Nenhum departamento cadastrado.</p>';
      }

      let recentesHtml = '';
      if (recentes && recentes.length > 0) {
        recentesHtml = recentes.map(r => `
          <div style="display:flex; align-items:center; justify-content:space-between; padding:10px 0; border-bottom:1px solid var(--border-color);">
            <div style="display:flex; align-items:center; gap:10px;">
              <img src="${r.foto || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + encodeURIComponent(r.nome)}" 
                   style="width:34px; height:34px; border-radius:50%; object-fit:cover; border:1px solid var(--border-color);" />
              <div>
                <div style="font-size:13px; font-weight:700; color:var(--text-main);">${r.nome}</div>
                <div style="font-size:11px; color:var(--text-muted);">${r.nome_cargo || 'Sem cargo'} · ${r.departamento_nome || 'Sem setor'}</div>
              </div>
            </div>
            <span class="badge badge-success">Admitido</span>
          </div>
        `).join('');
      } else {
        recentesHtml = '<p style="color:var(--text-muted); font-size:13px; padding:10px 0;">Nenhuma admissão recente.</p>';
      }

      let histHtml = '';
      if (ultimasMovimentacoes && ultimasMovimentacoes.length > 0) {
        histHtml = ultimasMovimentacoes.map(h => `
          <div style="display:flex; gap:12px; padding:10px 0; border-bottom:1px solid var(--border-color);">
            <div style="width:8px; height:8px; border-radius:50%; background:var(--brand-primary); margin-top:6px;"></div>
            <div style="flex:1;">
              <div style="font-size:13px; color:var(--text-main); font-weight:600;">${h.descricao}</div>
              <div style="font-size:11px; color:var(--text-muted); margin-top:2px;">
                ${new Date(h.created_at).toLocaleString('pt-BR')} ${h.usuario_nome ? `· por ${h.usuario_nome}` : ''}
              </div>
            </div>
          </div>
        `).join('');
      } else {
        histHtml = '<p style="color:var(--text-muted); font-size:13px; padding:10px 0;">Nenhuma movimentação registrada.</p>';
      }

      container.innerHTML = `
        <!-- 4 KPI STAT CARDS (ESTILO TALENTOS) -->
        <div class="kpi-grid-4">
          <!-- CARD 1 -->
          <div class="kpi-stat-box" onclick="App.navigate('colaboradores')" style="cursor:pointer;">
            <div class="kpi-stat-icon kpi-blue">👥</div>
            <div class="kpi-stat-value kpi-blue">${kpis.totalColaboradores}</div>
            <div class="kpi-stat-label">Colaboradores Contratados</div>
          </div>

          <!-- CARD 2 -->
          <div class="kpi-stat-box" onclick="App.navigate('departamentos')" style="cursor:pointer;">
            <div class="kpi-stat-icon kpi-green">🏢</div>
            <div class="kpi-stat-value kpi-green">${kpis.totalDepartamentos}</div>
            <div class="kpi-stat-label">Departamentos Ativos</div>
          </div>

          <!-- CARD 3 -->
          <div class="kpi-stat-box" onclick="App.navigate('departamentos')" style="cursor:pointer;">
            <div class="kpi-stat-icon kpi-orange">💼</div>
            <div class="kpi-stat-value kpi-orange">${kpis.totalCargos}</div>
            <div class="kpi-stat-label">Cargos & Funções</div>
          </div>

          <!-- CARD 4 -->
          <div class="kpi-stat-box" onclick="App.navigate('configuracoes')" style="cursor:pointer;">
            <div class="kpi-stat-icon kpi-purple">👤</div>
            <div class="kpi-stat-value kpi-purple">${kpis.totalUsuarios}</div>
            <div class="kpi-stat-label">Usuários com Acesso</div>
          </div>
        </div>

        <!-- LISTAS LIMPAS E CARDS EM DUAS COLUNAS -->
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap:24px; margin-top:10px;">
          <!-- DEPARTAMENTOS -->
          <div class="card">
            <div class="card-header">
              <div class="card-title-with-icon">
                <span>🏢</span> Departamentos & Alocação
              </div>
              <button class="btn btn-outline" style="padding:4px 12px; font-size:11px;" onclick="App.navigate('departamentos')">Ver Todos</button>
            </div>
            <div>${deptListHtml}</div>
          </div>

          <!-- ÚLTIMAS CONTRATAÇÕES -->
          <div class="card">
            <div class="card-header">
              <div class="card-title-with-icon">
                <span>👥</span> Últimos Contratados
              </div>
              <button class="btn btn-outline" style="padding:4px 12px; font-size:11px;" onclick="App.navigate('colaboradores')">Gerenciar</button>
            </div>
            <div>${recentesHtml}</div>
          </div>

          <!-- HISTÓRICO RECENTE -->
          <div class="card" style="grid-column: 1 / -1;">
            <div class="card-header">
              <div class="card-title-with-icon">
                <span>📜</span> Atividades e Movimentações Recentes
              </div>
              <button class="btn btn-outline" style="padding:4px 12px; font-size:11px;" onclick="App.navigate('historico')">Ver Histórico Completo</button>
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
