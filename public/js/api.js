// ── CLIENT API HELPER & UTILITIES (STATELESS JWT AUTH) ──
const API = {
  async request(url, options = {}) {
    const token = localStorage.getItem('gestao_token');

    const defaultHeaders = {
      'Content-Type': 'application/json'
    };

    if (token) {
      defaultHeaders['Authorization'] = `Bearer ${token}`;
    }

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
      
      // Se não autorizado, limpa token e redireciona para login
      if (response.status === 401) {
        localStorage.removeItem('gestao_token');
        if (!window.location.pathname.includes('login.html')) {
          window.location.href = '/login.html';
          return null;
        }
      }

      if (response.status === 429) {
        throw new Error('Muitas tentativas consecutivas. Por favor, aguarde alguns instantes.');
      }

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || 'Ocorreu um erro na requisição.');
      }

      // Se a resposta trouxe um novo token, salva no localStorage
      if (data && data.token) {
        localStorage.setItem('gestao_token', data.token);
      }

      return data;
    } catch (err) {
      if (!options.silent) {
        this.toast(err.message, 'error');
      }
      throw err;
    }
  },

  // Auth
  async login(email, password) {
    const res = await this.request('/api/auth/login', { method: 'POST', body: { email, password } });
    if (res && res.token) {
      localStorage.setItem('gestao_token', res.token);
    }
    return res;
  },
  async register(formData) {
    const res = await this.request('/api/auth/register', { method: 'POST', body: formData });
    if (res && res.token) {
      localStorage.setItem('gestao_token', res.token);
    }
    return res;
  },
  async logout() {
    try {
      await this.request('/api/auth/logout', { method: 'POST' });
    } catch (_) {}
    localStorage.removeItem('gestao_token');
  },
  me() {
    return this.request('/api/auth/me');
  },
  changePassword(senhaAtual, novaSenha) {
    return this.request('/api/auth/senha', { method: 'POST', body: { senhaAtual, novaSenha } });
  },

  // Empresa
  async getEmpresa() {
    const empresaId = this.getCurrentEmpresaId();
    const cacheKey = `gestao_cache_empresa_${empresaId}`;
    const isUserModified = localStorage.getItem(`gestao_user_modified_${empresaId}`) === 'true';

    if (isUserModified) {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (parsed && (parsed.empresa || parsed.id)) {
            return parsed;
          }
        } catch (_) {}
      }
    }

    try {
      const data = await this.request('/api/empresa');
      if (data && data.empresa) {
        localStorage.setItem(cacheKey, JSON.stringify(data));
        return data;
      }
    } catch (err) {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try { return JSON.parse(cached); } catch (_) {}
      }
      throw err;
    }
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try { return JSON.parse(cached); } catch (_) {}
    }
    return { empresa: {} };
  },

  async updateEmpresa(data) {
    const empresaId = this.getCurrentEmpresaId();
    localStorage.setItem(`gestao_user_modified_${empresaId}`, 'true');
    const cacheKey = `gestao_cache_empresa_${empresaId}`;
    let cached = {};
    try {
      const raw = localStorage.getItem(cacheKey);
      if (raw) cached = JSON.parse(raw);
    } catch (_) {}
    cached.empresa = { ...(cached.empresa || {}), ...data };
    localStorage.setItem(cacheKey, JSON.stringify(cached));
    const res = await this.request('/api/empresa', { method: 'PUT', body: data });
    return res;
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

  getCurrentEmpresaId() {
    try {
      const token = localStorage.getItem('gestao_token');
      if (!token) return 'default';
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.empresaId || 'default';
    } catch (_) {
      return 'default';
    }
  },

  async rehydrateTenant(data = {}, options = {}) {
    const empresaId = this.getCurrentEmpresaId();

    let empresaObj = data.empresa;
    if (!empresaObj) {
      try {
        const raw = localStorage.getItem(`gestao_cache_empresa_${empresaId}`);
        if (raw) {
          const parsed = JSON.parse(raw);
          empresaObj = parsed.empresa || parsed;
        }
      } catch (_) {}
    }

    let departamentos = data.departamentos;
    if (!departamentos) {
      try {
        const raw = localStorage.getItem(`gestao_cache_departamentos_${empresaId}`);
        if (raw) departamentos = JSON.parse(raw);
      } catch (_) {}
    }

    let cargos = data.cargos;
    if (!cargos) {
      try {
        const raw = localStorage.getItem(`gestao_cache_cargos_${empresaId}`);
        if (raw) cargos = JSON.parse(raw);
      } catch (_) {}
    }

    let colaboradores = data.colaboradores;
    if (!colaboradores) {
      try {
        const raw = localStorage.getItem(`gestao_cache_colaboradores_${empresaId}`);
        if (raw) colaboradores = JSON.parse(raw);
      } catch (_) {}
    }

    const payload = {
      empresa: empresaObj,
      departamentos,
      cargos,
      colaboradores
    };

    return this.request('/api/empresa/rehydrate', {
      method: 'POST',
      body: payload,
      silent: options.silent !== undefined ? options.silent : true
    });
  },

  async resetTestData() {
    const empresaId = this.getCurrentEmpresaId();
    localStorage.removeItem(`gestao_user_modified_${empresaId}`);
    localStorage.removeItem(`gestao_cache_empresa_${empresaId}`);
    localStorage.removeItem(`gestao_cache_colaboradores_${empresaId}`);
    localStorage.removeItem(`gestao_cache_departamentos_${empresaId}`);
    localStorage.removeItem(`gestao_cache_cargos_${empresaId}`);
    return this.request('/api/empresa/reset-test', { method: 'POST' });
  },

  // Departamentos
  async getDepartamentos() {
    const empresaId = this.getCurrentEmpresaId();
    const cacheKey = `gestao_cache_departamentos_${empresaId}`;
    const isUserModified = localStorage.getItem(`gestao_user_modified_${empresaId}`) === 'true';

    if (isUserModified) {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          const list = JSON.parse(cached);
          if (Array.isArray(list) && list.length > 0) {
            this.rehydrateTenant({ departamentos: list }, { silent: true }).catch(() => {});
            return list;
          }
        } catch (_) {}
      }
    }

    const serverList = await this.request('/api/departamentos');
    if (Array.isArray(serverList) && serverList.length > 0) {
      localStorage.setItem(cacheKey, JSON.stringify(serverList));
      return serverList;
    }

    if (!serverList || serverList.length === 0) {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          const cachedList = JSON.parse(cached);
          if (Array.isArray(cachedList) && cachedList.length > 0) {
            this.rehydrateTenant({ departamentos: cachedList }, { silent: true }).catch(() => {});
            return cachedList;
          }
        } catch (_) {}
      }
    }
    return serverList || [];
  },

  async getDepartamentosTree() {
    const empresaId = this.getCurrentEmpresaId();
    const isUserModified = localStorage.getItem(`gestao_user_modified_${empresaId}`) === 'true';

    if (isUserModified) {
      const depts = await this.getDepartamentos();
      const colabs = await this.getColaboradores();
      return this.buildTreeInMemory(depts, colabs);
    }

    try {
      const res = await this.request('/api/departamentos/tree');
      if (res && res.tree && res.tree.length > 0) {
        return res;
      }
    } catch (_) {}

    const depts = await this.getDepartamentos();
    const colabs = await this.getColaboradores();
    return this.buildTreeInMemory(depts, colabs);
  },

  buildTreeInMemory(departamentos = [], colaboradores = []) {
    const colabPorDept = {};
    (colaboradores || []).forEach(c => {
      if (!colabPorDept[c.departamento_id]) {
        colabPorDept[c.departamento_id] = [];
      }
      colabPorDept[c.departamento_id].push(c);
    });

    const deptMap = {};
    const roots = [];

    (departamentos || []).forEach(d => {
      const deptColabs = colabPorDept[d.id] || [];
      const resp = d.responsavel_id ? (colaboradores || []).find(c => c.id == d.responsavel_id) : null;
      deptMap[d.id] = {
        ...d,
        responsavel_nome: resp ? resp.nome : (d.responsavel_nome || null),
        responsavel_foto: resp ? resp.foto : (d.responsavel_foto || null),
        responsavel_cargo: resp ? (resp.cargo || resp.nome_cargo) : (d.responsavel_cargo || null),
        colaboradores: deptColabs,
        total_colaboradores: deptColabs.length,
        children: []
      };
    });

    (departamentos || []).forEach(d => {
      if (d.parent_id && deptMap[d.parent_id]) {
        deptMap[d.parent_id].children.push(deptMap[d.id]);
      } else {
        roots.push(deptMap[d.id]);
      }
    });

    return {
      tree: roots,
      total_departamentos: (departamentos || []).length,
      total_colaboradores: (colaboradores || []).length
    };
  },

  async createDepartamento(data) {
    const empresaId = this.getCurrentEmpresaId();
    localStorage.setItem(`gestao_user_modified_${empresaId}`, 'true');
    const res = await this.request('/api/departamentos', { method: 'POST', body: data });
    const cacheKey = `gestao_cache_departamentos_${empresaId}`;
    try {
      const cached = localStorage.getItem(cacheKey);
      let list = cached ? JSON.parse(cached) : [];
      const newDept = {
        id: (res && res.departamento && res.departamento.id) || (res && res.id) || Date.now(),
        ...data,
        parent_id: data.parent_id ? parseInt(data.parent_id) : null,
        responsavel_id: data.responsavel_id ? parseInt(data.responsavel_id) : null,
        total_colaboradores: 0
      };
      if (newDept.parent_id) {
        const parent = list.find(p => p.id == newDept.parent_id);
        if (parent) newDept.parent_nome = parent.nome;
      }
      list.push(newDept);
      localStorage.setItem(cacheKey, JSON.stringify(list));
      this.rehydrateTenant({ departamentos: list }, { silent: true }).catch(() => {});
    } catch (_) {}
    return res;
  },

  async updateDepartamento(id, data) {
    const empresaId = this.getCurrentEmpresaId();
    const cacheKey = `gestao_cache_departamentos_${empresaId}`;
    localStorage.setItem(`gestao_user_modified_${empresaId}`, 'true');

    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        let list = JSON.parse(cached);
        const idx = list.findIndex(d => d.id == id);
        if (idx !== -1) {
          const parentId = data.parent_id ? parseInt(data.parent_id) : null;
          const respId = data.responsavel_id ? parseInt(data.responsavel_id) : null;
          const parent = parentId ? list.find(p => p.id == parentId) : null;
          list[idx] = {
            ...list[idx],
            ...data,
            parent_id: parentId,
            parent_nome: parent ? parent.nome : null,
            responsavel_id: respId
          };
          localStorage.setItem(cacheKey, JSON.stringify(list));
          this.rehydrateTenant({ departamentos: list }, { silent: true }).catch(() => {});
        }
      }
    } catch (_) {}

    const res = await this.request(`/api/departamentos/${id}`, { method: 'PUT', body: data });
    return res;
  },

  async deleteDepartamento(id) {
    const empresaId = this.getCurrentEmpresaId();
    localStorage.setItem(`gestao_user_modified_${empresaId}`, 'true');
    const cacheKey = `gestao_cache_departamentos_${empresaId}`;
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const list = JSON.parse(cached).filter(d => d.id != id);
        localStorage.setItem(cacheKey, JSON.stringify(list));
        this.rehydrateTenant({ departamentos: list }, { silent: true }).catch(() => {});
      }
    } catch (_) {}
    const res = await this.request(`/api/departamentos/${id}`, { method: 'DELETE' });
    return res;
  },

  // Cargos
  async getCargos() {
    const empresaId = this.getCurrentEmpresaId();
    const cacheKey = `gestao_cache_cargos_${empresaId}`;
    const isUserModified = localStorage.getItem(`gestao_user_modified_${empresaId}`) === 'true';

    if (isUserModified) {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          const list = JSON.parse(cached);
          if (Array.isArray(list) && list.length > 0) {
            this.rehydrateTenant({ cargos: list }, { silent: true }).catch(() => {});
            return list;
          }
        } catch (_) {}
      }
    }

    const serverList = await this.request('/api/cargos');
    if (Array.isArray(serverList) && serverList.length > 0) {
      localStorage.setItem(cacheKey, JSON.stringify(serverList));
      return serverList;
    }

    if (!serverList || serverList.length === 0) {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          const cachedList = JSON.parse(cached);
          if (Array.isArray(cachedList) && cachedList.length > 0) {
            this.rehydrateTenant({ cargos: cachedList }, { silent: true }).catch(() => {});
            return cachedList;
          }
        } catch (_) {}
      }
    }
    return serverList || [];
  },

  async createCargo(data) {
    const empresaId = this.getCurrentEmpresaId();
    localStorage.setItem(`gestao_user_modified_${empresaId}`, 'true');
    const res = await this.request('/api/cargos', { method: 'POST', body: data });
    const cacheKey = `gestao_cache_cargos_${empresaId}`;
    try {
      const cached = localStorage.getItem(cacheKey);
      let list = cached ? JSON.parse(cached) : [];
      const newCargo = {
        id: (res && res.cargo && res.cargo.id) || (res && res.id) || Date.now(),
        ...data,
        total_colaboradores: 0
      };
      list.push(newCargo);
      localStorage.setItem(cacheKey, JSON.stringify(list));
      this.rehydrateTenant({ cargos: list }, { silent: true }).catch(() => {});
    } catch (_) {}
    return res;
  },

  async updateCargo(id, data) {
    const empresaId = this.getCurrentEmpresaId();
    localStorage.setItem(`gestao_user_modified_${empresaId}`, 'true');
    const cacheKey = `gestao_cache_cargos_${empresaId}`;
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        let list = JSON.parse(cached);
        const idx = list.findIndex(c => c.id == id);
        if (idx !== -1) {
          list[idx] = { ...list[idx], ...data };
          localStorage.setItem(cacheKey, JSON.stringify(list));
          this.rehydrateTenant({ cargos: list }, { silent: true }).catch(() => {});
        }
      }
    } catch (_) {}
    const res = await this.request(`/api/cargos/${id}`, { method: 'PUT', body: data });
    return res;
  },

  async deleteCargo(id) {
    const empresaId = this.getCurrentEmpresaId();
    localStorage.setItem(`gestao_user_modified_${empresaId}`, 'true');
    const cacheKey = `gestao_cache_cargos_${empresaId}`;
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const list = JSON.parse(cached).filter(c => c.id != id);
        localStorage.setItem(cacheKey, JSON.stringify(list));
        this.rehydrateTenant({ cargos: list }, { silent: true }).catch(() => {});
      }
    } catch (_) {}
    const res = await this.request(`/api/cargos/${id}`, { method: 'DELETE' });
    return res;
  },

  // Colaboradores
  async getColaboradores(filters = {}) {
    const params = new URLSearchParams(filters);
    const empresaId = this.getCurrentEmpresaId();
    const cacheKey = `gestao_cache_colaboradores_${empresaId}`;
    const hasFilters = Object.keys(filters).length > 0;
    const isUserModified = localStorage.getItem(`gestao_user_modified_${empresaId}`) === 'true';

    if (!hasFilters && isUserModified) {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          const list = JSON.parse(cached);
          if (Array.isArray(list) && list.length > 0) {
            this.rehydrateTenant({ colaboradores: list }, { silent: true }).catch(() => {});
            return list;
          }
        } catch (_) {}
      }
    }

    const serverList = await this.request(`/api/colaboradores?${params.toString()}`);
    if (Array.isArray(serverList) && serverList.length > 0) {
      if (!hasFilters) {
        localStorage.setItem(cacheKey, JSON.stringify(serverList));
      }
      return serverList;
    }

    // Se o servidor retornou vazio (cold start ou reciclagem da Vercel)
    if (!hasFilters && (!serverList || serverList.length === 0)) {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          const cachedList = JSON.parse(cached);
          if (Array.isArray(cachedList) && cachedList.length > 0) {
            this.rehydrateTenant({ colaboradores: cachedList }, { silent: true }).catch(() => {});
            return cachedList;
          }
        } catch (_) {}
      }
    }

    return serverList || [];
  },
  getColaboradorById(id) {
    return this.request(`/api/colaboradores/${id}`);
  },

  async createColaborador(data) {
    const empresaId = this.getCurrentEmpresaId();
    localStorage.setItem(`gestao_user_modified_${empresaId}`, 'true');
    const res = await this.request('/api/colaboradores', { method: 'POST', body: data });
    const colabId = (res && res.id) || Date.now();
    const cacheKey = `gestao_cache_colaboradores_${empresaId}`;
    try {
      const cached = localStorage.getItem(cacheKey);
      let list = cached ? JSON.parse(cached) : [];
      let depts = [];
      let cargos = [];
      try {
        depts = JSON.parse(localStorage.getItem(`gestao_cache_departamentos_${empresaId}`)) || [];
        cargos = JSON.parse(localStorage.getItem(`gestao_cache_cargos_${empresaId}`)) || [];
      } catch (_) {}
      const dept = depts.find(d => d.id == data.departamento_id);
      const cargo = cargos.find(c => c.id == data.cargo_id);
      const gestor = list.find(g => g.id == data.gestor_id);

      const newColab = {
        id: colabId,
        ...data,
        nome_departamento: dept ? dept.nome : null,
        nome_cargo: cargo ? cargo.nome_cargo : null,
        cargo_nivel: cargo ? cargo.nivel : null,
        gestor_nome: gestor ? gestor.nome : null,
        status: data.status || 'ativo'
      };
      list.push(newColab);
      localStorage.setItem(cacheKey, JSON.stringify(list));
      this.rehydrateTenant({ colaboradores: list }, { silent: true }).catch(() => {});
    } catch (_) {}
    return res;
  },

  async updateColaborador(id, data) {
    const empresaId = this.getCurrentEmpresaId();
    localStorage.setItem(`gestao_user_modified_${empresaId}`, 'true');
    const cacheKey = `gestao_cache_colaboradores_${empresaId}`;
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        let list = JSON.parse(cached);
        const idx = list.findIndex(c => c.id == id);
        if (idx !== -1) {
          let depts = [];
          let cargos = [];
          try {
            depts = JSON.parse(localStorage.getItem(`gestao_cache_departamentos_${empresaId}`)) || [];
            cargos = JSON.parse(localStorage.getItem(`gestao_cache_cargos_${empresaId}`)) || [];
          } catch (_) {}
          const deptId = data.departamento_id !== undefined ? data.departamento_id : list[idx].departamento_id;
          const cargoId = data.cargo_id !== undefined ? data.cargo_id : list[idx].cargo_id;
          const gestorId = data.gestor_id !== undefined ? data.gestor_id : list[idx].gestor_id;
          const dept = depts.find(d => d.id == deptId);
          const cargo = cargos.find(c => c.id == cargoId);
          const gestor = list.find(g => g.id == gestorId);

          list[idx] = {
            ...list[idx],
            ...data,
            nome_departamento: dept ? dept.nome : list[idx].nome_departamento,
            nome_cargo: cargo ? cargo.nome_cargo : list[idx].nome_cargo,
            cargo_nivel: cargo ? cargo.nivel : list[idx].cargo_nivel,
            gestor_nome: gestor ? gestor.nome : (gestorId ? list[idx].gestor_nome : null)
          };
          localStorage.setItem(cacheKey, JSON.stringify(list));
          this.rehydrateTenant({ colaboradores: list }, { silent: true }).catch(() => {});
        }
      }
    } catch (_) {}
    const res = await this.request(`/api/colaboradores/${id}`, { method: 'PUT', body: data });
    return res;
  },

  async moverColaborador(id, departamento_id) {
    const empresaId = this.getCurrentEmpresaId();
    localStorage.setItem(`gestao_user_modified_${empresaId}`, 'true');
    const cacheKey = `gestao_cache_colaboradores_${empresaId}`;
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        let list = JSON.parse(cached);
        const idx = list.findIndex(c => c.id == id);
        if (idx !== -1) {
          let depts = [];
          try {
            depts = JSON.parse(localStorage.getItem(`gestao_cache_departamentos_${empresaId}`)) || [];
          } catch (_) {}
          const dept = depts.find(d => d.id == departamento_id);
          list[idx].departamento_id = departamento_id ? parseInt(departamento_id) : null;
          list[idx].nome_departamento = dept ? dept.nome : null;
          localStorage.setItem(cacheKey, JSON.stringify(list));
          this.rehydrateTenant({ colaboradores: list }, { silent: true }).catch(() => {});
        }
      }
    } catch (_) {}
    const res = await this.request(`/api/colaboradores/${id}/mover`, { method: 'PUT', body: { departamento_id } });
    return res;
  },

  async updatePhoto(id, foto) {
    const empresaId = this.getCurrentEmpresaId();
    localStorage.setItem(`gestao_user_modified_${empresaId}`, 'true');
    const cacheKey = `gestao_cache_colaboradores_${empresaId}`;
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        let list = JSON.parse(cached);
        const idx = list.findIndex(c => c.id == id);
        if (idx !== -1) {
          list[idx].foto = foto;
          localStorage.setItem(cacheKey, JSON.stringify(list));
          this.rehydrateTenant({ colaboradores: list }, { silent: true }).catch(() => {});
        }
      }
    } catch (_) {}
    const res = await this.request(`/api/colaboradores/${id}/foto`, { method: 'PUT', body: { foto } });
    return res;
  },

  async deleteColaborador(id) {
    const empresaId = this.getCurrentEmpresaId();
    localStorage.setItem(`gestao_user_modified_${empresaId}`, 'true');
    const cacheKey = `gestao_cache_colaboradores_${empresaId}`;
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const list = JSON.parse(cached).filter(c => c.id != id);
        localStorage.setItem(cacheKey, JSON.stringify(list));
        this.rehydrateTenant({ colaboradores: list }, { silent: true }).catch(() => {});
      }
    } catch (_) {}
    const res = await this.request(`/api/colaboradores/${id}`, { method: 'DELETE' });
    return res;
  },

  async importColaboradores(colaboradores) {
    const res = await this.request('/api/colaboradores/import', { method: 'POST', body: { colaboradores } });
    const empresaId = this.getCurrentEmpresaId();
    localStorage.removeItem(`gestao_user_modified_${empresaId}`);
    await this.getColaboradores().catch(() => {});
    await this.getDepartamentos().catch(() => {});
    await this.getCargos().catch(() => {});
    localStorage.setItem(`gestao_user_modified_${empresaId}`, 'true');
    return res;
  },

  // Dashboard & Histórico
  getDashboard() {
    return this.request('/api/dashboard');
  },
  getHistorico(filters = {}) {
    const params = new URLSearchParams(filters);
    return this.request(`/api/historico?${params.toString()}`);
  },

  // Sincronização Cloud Control iD (RHiD Nuvem)
  async pullControlIdCloud(data) {
    const res = await this.request('/api/controlid/pull-cloud', { method: 'POST', body: data });
    if (res && res.importados && res.importados.length > 0) {
      const empresaId = this.getCurrentEmpresaId();
      localStorage.setItem(`gestao_cache_colaboradores_${empresaId}`, JSON.stringify(res.importados));
    }
    return res;
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
