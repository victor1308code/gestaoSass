const HistoricoView = {
  async render(container) {
    container.innerHTML = `
      <div class="card">
        <div class="card-header" style="flex-wrap:wrap; gap:12px;">
          <div>
            <div class="card-title">📜 Histórico & Auditoria de Movimentações</div>
            <p style="font-size:12px; color:var(--text-muted); margin-top:2px;">
              Registro cronológico auditável de todas as alterações na estrutura, admissões e transferências da empresa.
            </p>
          </div>

          <div style="display:flex; gap:10px;">
            <select id="hist-filter-type" class="form-control" style="width:180px;">
              <option value="todos">Todos os Tipos</option>
              <option value="admissao">Admissões</option>
              <option value="transferencia">Transferências de Setor</option>
              <option value="promocao">Promoções & Cargos</option>
              <option value="desligamento">Desligamentos</option>
            </select>
          </div>
        </div>

        <div id="historico-timeline" style="margin-top:16px;">
          <div class="spinner">Carregando histórico...</div>
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
          <p style="color:var(--text-muted); text-align:center; padding:30px;">Nenhum registro encontrado no histórico.</p>
        `;
        return;
      }

      container.innerHTML = items.map(h => {
        let badgeType = 'badge-info';
        let icon = '📝';
        if (h.tipo === 'admissao') { badgeType = 'badge-success'; icon = '🎉'; }
        if (h.tipo === 'transferencia') { badgeType = 'badge-warning'; icon = '🔀'; }
        if (h.tipo === 'promocao') { badgeType = 'badge-info'; icon = '⭐'; }
        if (h.tipo === 'desligamento') { badgeType = 'badge-danger'; icon = '🚫'; }

        return `
          <div style="display:flex; gap:16px; padding:14px 0; border-bottom:1px solid var(--border-color);">
            <div style="font-size:20px; width:36px; height:36px; border-radius:50%; background:var(--bg-secondary); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
              ${icon}
            </div>
            <div style="flex:1;">
              <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:4px;">
                <span class="badge ${badgeType}">${h.tipo}</span>
                <span style="font-size:12px; color:var(--text-muted);">${new Date(h.created_at).toLocaleString('pt-BR')}</span>
              </div>
              <div style="font-size:14px; font-weight:700; color:var(--text-primary); margin-bottom:2px;">
                ${h.colaborador_nome}
              </div>
              <div style="font-size:13px; color:var(--text-secondary);">
                ${h.descricao}
              </div>
              ${h.usuario_nome ? `
                <div style="font-size:11px; color:var(--text-muted); margin-top:4px;">
                  Realizado por: <strong>${h.usuario_nome}</strong>
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
