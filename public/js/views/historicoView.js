const HistoricoView = {
  async render(container) {
    container.innerHTML = `
      <div class="card">
        <div class="card-header" style="flex-wrap:wrap; gap:12px;">
          <div>
            <div class="card-title-with-icon">
              ${Icons.history} Histórico & Auditoria de Movimentações
            </div>
            <p style="font-size:12px; color:var(--text-muted); margin-top:2px;">
              Registro cronológico auditável de alterações funcionais, admissões e transferências.
            </p>
          </div>

          <div style="display:flex; gap:8px;">
            <select id="hist-filter-type" class="form-control" style="width:180px;">
              <option value="todos">Todos os Eventos</option>
              <option value="admissao">Admissões</option>
              <option value="transferencia">Transferências de Setor</option>
              <option value="promocao">Promoções & Cargos</option>
              <option value="desligamento">Desligamentos</option>
            </select>
          </div>
        </div>

        <div id="historico-timeline" style="margin-top:12px;">
          <div class="skeleton skeleton-text" style="width:100%; height:40px; margin-bottom:8px;"></div>
        </div>
      </div>
    `;

    document.getElementById('hist-filter-type')?.addEventListener('change', () => this.loadData());
    await this.loadData();
  },

  async loadData() {
    const tipo = document.getElementById('hist-filter-type')?.value || 'todos';
    const container = document.getElementById('historico-timeline');

    try {
      const items = await API.getHistorico({ tipo });

      if (!items || items.length === 0) {
        container.innerHTML = `
          <p style="color:var(--text-muted); text-align:center; padding:24px; font-size:12px;">Nenhum registro encontrado no histórico.</p>
        `;
        return;
      }

      container.innerHTML = items.map(h => {
        let badgeType = 'badge-info';
        if (h.tipo === 'admissao') badgeType = 'badge-success';
        if (h.tipo === 'transferencia') badgeType = 'badge-warning';
        if (h.tipo === 'desligamento') badgeType = 'badge-danger';

        return `
          <div style="display:flex; gap:12px; padding:12px 0; border-bottom:1px solid var(--border-color);">
            <div style="width:6px; height:6px; border-radius:1px; background:var(--brand-primary); margin-top:6px;"></div>
            <div style="flex:1;">
              <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:2px;">
                <span class="badge ${badgeType}">${h.tipo}</span>
                <span style="font-size:11px; color:var(--text-muted);">${new Date(h.created_at).toLocaleString('pt-BR')}</span>
              </div>
              <div style="font-size:13px; font-weight:600; color:var(--text-main); margin-bottom:1px;">
                ${h.colaborador_nome}
              </div>
              <div style="font-size:12px; color:var(--text-muted);">
                ${h.descricao}
              </div>
              ${h.usuario_nome ? `
                <div style="font-size:11px; color:var(--text-muted); margin-top:2px;">
                  Registrado por: <strong>${h.usuario_nome}</strong>
                </div>
              ` : ''}
            </div>
          </div>
        `;
      }).join('');
    } catch (err) {
      container.innerHTML = `<p style="color:var(--danger);">Erro: ${err.message}</p>`;
    }
  }
};
