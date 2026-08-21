// ── CENTRAL APPLICATION CONTROLLER (TALENTOS UI) ──
const App = {
  state: {
    user: null,
    currentView: 'dashboard'
  },

  views: {
    dashboard: DashboardView,
    organograma: OrganogramaView,
    carometro: CarometroView,
    departamentos: DepartamentosView,
    colaboradores: ColaboradoresView,
    historico: HistoricoView,
    configuracoes: ConfiguracoesView
  },

  async init() {
    try {
      const data = await API.me();
      if (!data || !data.user) {
        window.location.href = '/login.html';
        return;
      }

      this.state.user = data.user;
      this.renderUserInfo();

      // Navega para a visão inicial
      const hash = window.location.hash.replace('#', '') || 'dashboard';
      this.navigate(hash);

      // Escuta mudanças de rota no hash
      window.addEventListener('hashchange', () => {
        const route = window.location.hash.replace('#', '') || 'dashboard';
        this.navigate(route, false);
      });
    } catch (err) {
      console.error('Erro na inicialização:', err);
      window.location.href = '/login.html';
    }
  },

  renderUserInfo() {
    const u = this.state.user;
    if (!u) return;

    // Header da Sidebar
    const companyName = document.getElementById('sidebar-company-name');
    if (companyName) companyName.textContent = u.empresa?.nome || 'Talentos';

    // Perfil Topbar
    const topbarEmail = document.getElementById('topbar-user-email');
    if (topbarEmail) topbarEmail.textContent = `${u.email} ▾`;

    const topbarRole = document.getElementById('topbar-role-label');
    if (topbarRole) topbarRole.textContent = `${u.role.toUpperCase()} ▾`;

    const avatarCircle = document.getElementById('topbar-avatar-circle');
    const footerAvatar = document.getElementById('user-avatar-initials');
    const initial = (u.nome || 'U')[0].toUpperCase();
    if (avatarCircle) avatarCircle.textContent = initial;
    if (footerAvatar) footerAvatar.textContent = initial;

    const userName = document.getElementById('user-display-name');
    if (userName) userName.textContent = u.nome;

    const userRole = document.getElementById('user-display-role');
    if (userRole) userRole.textContent = u.role;
  },

  navigate(viewName, updateHash = true) {
    if (!this.views[viewName]) viewName = 'dashboard';
    this.state.currentView = viewName;

    if (updateHash) {
      window.location.hash = viewName;
    }

    // Atualiza links da sidebar
    document.querySelectorAll('.nav-link').forEach(link => {
      if (link.getAttribute('data-view') === viewName) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });

    // Atualiza Títulos e Breadcrumbs
    const titles = {
      dashboard: { title: 'Relatório de Gestão & Dashboard', desc: 'Relatório e indicadores em tempo real', breadcrumb: 'Dashboard' },
      organograma: { title: 'Organograma da Estrutura', desc: 'Hierarquia e relações entre setores', breadcrumb: 'Organograma' },
      carometro: { title: 'Carômetro & Galeria', desc: 'Diretório fotográfico do time', breadcrumb: 'Carômetro' },
      departamentos: { title: 'Gestão de Departamentos & Cargos', desc: 'Estrutura dos setores e lideranças', breadcrumb: 'Departamentos' },
      colaboradores: { title: 'Quadro de Colaboradores (Contratados)', desc: 'Gestão e movimentação de funcionários', breadcrumb: 'Colaboradores' },
      historico: { title: 'Histórico & Auditoria de Movimentações', desc: 'Registro cronológico de alterações', breadcrumb: 'Auditoria' },
      configuracoes: { title: 'Configurações do Sistema & Usuários', desc: 'Identidade visual e perfis de acesso', breadcrumb: 'Configurações' }
    };

    const info = titles[viewName] || { title: 'Gestão SaaS', desc: '', breadcrumb: 'Painel' };
    
    const titleEl = document.getElementById('topbar-page-title');
    const descEl = document.getElementById('topbar-timestamp');
    const breadcrumbEl = document.getElementById('breadcrumb-current-view');

    if (titleEl) titleEl.textContent = info.title;
    if (descEl) descEl.textContent = `${info.desc} · Atualizado agora`;
    if (breadcrumbEl) breadcrumbEl.textContent = info.breadcrumb;

    // Renderiza a view no container principal
    const content = document.getElementById('main-content-view');
    if (content) {
      this.views[viewName].render(content);
    }
  },

  reloadCurrentView() {
    this.navigate(this.state.currentView, false);
    API.toast('Dados atualizados com sucesso!', 'success');
  },

  openModal(contentHtml) {
    const backdrop = document.getElementById('global-modal');
    const modalContent = document.getElementById('global-modal-content');
    if (backdrop && modalContent) {
      modalContent.innerHTML = contentHtml;
      backdrop.classList.add('active');
    }
  },

  closeModal() {
    const backdrop = document.getElementById('global-modal');
    if (backdrop) {
      backdrop.classList.remove('active');
    }
  },

  async logout() {
    if (confirm('Deseja realmente encerrar a sessão?')) {
      await API.logout();
      window.location.href = '/login.html';
    }
  }
};

// Auto inicialização ao carregar a página
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('main-content-view')) {
    App.init();
  }
});
