// ── CENTRAL APPLICATION CONTROLLER (ENTERPRISE UI) ──
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
    dispositivos: DispositivosView,
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
    if (companyName) companyName.textContent = u.empresa?.nome || 'Gestão SaaS';

    // Perfil Topbar
    const topbarEmail = document.getElementById('topbar-user-email');
    if (topbarEmail) topbarEmail.textContent = u.email;

    const avatarCircle = document.getElementById('topbar-avatar-circle');
    const footerAvatar = document.getElementById('user-avatar-initials');
    const initial = (u.nome || 'V')[0].toUpperCase();
    if (avatarCircle) avatarCircle.textContent = initial;
    if (footerAvatar) footerAvatar.textContent = initial;

    const userName = document.getElementById('user-display-name');
    if (userName) userName.textContent = u.nome;

    const userRole = document.getElementById('user-display-role');
    if (userRole) userRole.textContent = u.role === 'admin' ? 'Administrador' : u.role;
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
      dashboard: { title: 'Relatório de Gestão & Indicadores', desc: 'Métricas consolidadas em tempo real', breadcrumb: 'Dashboard' },
      organograma: { title: 'Organograma da Estrutura', desc: 'Hierarquia e relações entre setores', breadcrumb: 'Organograma' },
      carometro: { title: 'Diretório Visual (Carômetro)', desc: 'Galeria de fotos e contatos da equipe', breadcrumb: 'Carômetro' },
      departamentos: { title: 'Estrutura de Departamentos', desc: 'Gerenciamento de setores e lideranças', breadcrumb: 'Departamentos' },
      colaboradores: { title: 'Quadro Geral de Colaboradores', desc: 'Gestão de pessoal, cargos e admissões', breadcrumb: 'Colaboradores' },
      dispositivos: { title: 'Dispositivos & Catracas Control iD', desc: 'Monitoramento de hardware e acessos físicos', breadcrumb: 'Acesso Físico' },
      historico: { title: 'Histórico & Auditoria de Movimentações', desc: 'Registro auditável de transferências e alterações', breadcrumb: 'Auditoria' },
      configuracoes: { title: 'Configurações do Sistema & Usuários', desc: 'Perfil da empresa e controle de acessos', breadcrumb: 'Configurações' }
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
    API.toast('Dados atualizados.', 'success');
  },

  updateCompanyBranding(name, logo, color) {
    const title = document.getElementById('sidebar-company-name');
    if (title && name) title.textContent = name;
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

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('main-content-view')) {
    App.init();
  }
});
