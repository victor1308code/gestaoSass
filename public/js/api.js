// ── CLIENT API HELPER & UTILITIES (10/10 REFINED) ──
const API = {
  async request(url, options = {}) {
    const defaultHeaders = {
      'Content-Type': 'application/json'
    };

    const config = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers
      }
    };

    if (config.body && typeof config.body === 'object') {
      config.body = JSON.stringify(config.body);
    }

    try {
      const response = await fetch(url, config);
      
      // Se não autorizado, redireciona para login
      if (response.status === 401 && !window.location.pathname.includes('login.html')) {
        window.location.href = '/login.html';
        return null;
      }

      if (response.status === 429) {
        throw new Error('Muitas tentativas consecutivas. Por favor, aguarde alguns instantes.');
      }

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || 'Ocorreu um erro na requisição.');
      }

      return data;
    } catch (err) {
      this.toast(err.message, 'error');
      throw err;
    }
  },

  // Auth
  login(email, password) {
    return this.request('/api/auth/login', { method: 'POST', body: { email, password } });
  },
  register(formData) {
    return this.request('/api/auth/register', { method: 'POST', body: formData });
  },
  logout() {
    return this.request('/api/auth/logout', { method: 'POST' });
  },
  me() {
    return this.request('/api/auth/me');
  },
  changePassword(senhaAtual, novaSenha) {
    return this.request('/api/auth/senha', { method: 'POST', body: { senhaAtual, novaSenha } });
  },

  // Empresa
  getEmpresa() {
    return this.request('/api/empresa');
  },
  updateEmpresa(data) {
    return this.request('/api/empresa', { method: 'PUT', body: data });
  },
  listUsers() {
    return this.request('/api/empresa/usuarios');
  },
  createUser(data) {
    return this.request('/api/empresa/usuarios', { method: 'POST', body: data });
  },
  deleteUser(id) {
    return this.request(`/api/empresa/usuarios/${id}`, { method: 'DELETE' });
  },

  // Departamentos
  getDepartamentos() {
    return this.request('/api/departamentos');
  },
  getDepartamentosTree() {
    return this.request('/api/departamentos/tree');
  },
  createDepartamento(data) {
    return this.request('/api/departamentos', { method: 'POST', body: data });
  },
  updateDepartamento(id, data) {
    return this.request(`/api/departamentos/${id}`, { method: 'PUT', body: data });
  },
  deleteDepartamento(id) {
    return this.request(`/api/departamentos/${id}`, { method: 'DELETE' });
  },

  // Cargos
  getCargos() {
    return this.request('/api/cargos');
  },
  createCargo(data) {
    return this.request('/api/cargos', { method: 'POST', body: data });
  },
  updateCargo(id, data) {
    return this.request(`/api/cargos/${id}`, { method: 'PUT', body: data });
  },
  deleteCargo(id) {
    return this.request(`/api/cargos/${id}`, { method: 'DELETE' });
  },

  // Colaboradores
  getColaboradores(filters = {}) {
    const params = new URLSearchParams(filters);
    return this.request(`/api/colaboradores?${params.toString()}`);
  },
  getColaboradorById(id) {
    return this.request(`/api/colaboradores/${id}`);
  },
  createColaborador(data) {
    return this.request('/api/colaboradores', { method: 'POST', body: data });
  },
  updateColaborador(id, data) {
    return this.request(`/api/colaboradores/${id}`, { method: 'PUT', body: data });
  },
  moverColaborador(id, departamento_id) {
    return this.request(`/api/colaboradores/${id}/mover`, { method: 'PUT', body: { departamento_id } });
  },
  updatePhoto(id, foto) {
    return this.request(`/api/colaboradores/${id}/foto`, { method: 'PUT', body: { foto } });
  },
  deleteColaborador(id) {
    return this.request(`/api/colaboradores/${id}`, { method: 'DELETE' });
  },
  importColaboradores(colaboradores) {
    return this.request('/api/colaboradores/import', { method: 'POST', body: { colaboradores } });
  },

  // Dashboard & Histórico
  getDashboard() {
    return this.request('/api/dashboard');
  },
  getHistorico(filters = {}) {
    const params = new URLSearchParams(filters);
    return this.request(`/api/historico?${params.toString()}`);
  },

  // ── MÁSCARAS DE ENTRADA ──
  maskCPF(value) {
    return value
      .replace(/\D/g, '')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
      .slice(0, 14);
  },
  maskCNPJ(value) {
    return value
      .replace(/\D/g, '')
      .replace(/^(\d{2})(\d)/, '$1.$2')
      .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1/$2')
      .replace(/(\d{4})(\d)/, '$1-$2')
      .slice(0, 18);
  },
  maskPhone(value) {
    return value
      .replace(/\D/g, '')
      .replace(/^(\d{2})(\d)/g, '($1) $2')
      .replace(/(\d)(\d{4})$/, '$1-$2')
      .slice(0, 15);
  },

  // ── OTIMIZADOR DE IMAGEM / PREVIEW (CANVAS 400x400) ──
  compressImage(file, maxWidth = 400, maxHeight = 400) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxWidth) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        };
        img.onerror = reject;
      };
      reader.onerror = reject;
    });
  },

  // Notificações Toast
  toast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '⚠️';

    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }
};
