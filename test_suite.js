const http = require('http');
const db = require('./src/config/database');
const app = require('./server');

const server = http.createServer(app);
const PORT = 4099;

async function runTests() {
  await new Promise(resolve => server.listen(PORT, resolve));
  console.log(`🧪 Servidor de testes rodando na porta ${PORT}`);

  const results = [];
  function logTest(name, passed, detail = '') {
    results.push({ name, passed, detail });
    console.log(`${passed ? '✅' : '❌'} ${name} ${detail ? '(' + detail + ')' : ''}`);
  }

  async function api(path, options = {}) {
    const res = await fetch(`http://localhost:${PORT}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      },
      body: options.body ? JSON.stringify(options.body) : undefined
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, ok: res.ok, data, headers: res.headers };
  }

  try {
    // ── 1. TESTE DE AUTENTICAÇÃO (LOGIN DEMO & JWT) ──
    const loginRes = await api('/api/auth/login', {
      method: 'POST',
      body: { email: 'admin@inovatech.com', password: 'senha123' }
    });
    logTest('1.1 Login InovaTech Demo', loginRes.ok && !!loginRes.data.token, `Token recebido`);
    const token = loginRes.data.token;

    const authHeaders = { Authorization: `Bearer ${token}` };

    // ── 2. TESTE ME (PERFIL & TENANT SCOPE) ──
    const meRes = await api('/api/auth/me', { headers: authHeaders });
    logTest('2.1 GET /api/auth/me', meRes.ok && meRes.data.user.nome === 'Victor', `Admin: ${meRes.data?.user?.nome}`);

    // ── 3. TESTE DEPARTAMENTOS (HIERARQUIA & ÁRVORE) ──
    const treeRes = await api('/api/departamentos/tree', { headers: authHeaders });
    logTest('3.1 GET /api/departamentos/tree', treeRes.ok && Array.isArray(treeRes.data.tree), `Raízes: ${treeRes.data?.tree?.length}`);

    // Criar departamento raiz
    const createDeptRes = await api('/api/departamentos', {
      method: 'POST',
      headers: authHeaders,
      body: { nome: 'Logística & Suprimentos', sigla: 'LOG', ramal: '500', cor: '#e11d48' }
    });
    logTest('3.2 POST /api/departamentos (Raiz)', createDeptRes.ok && !!createDeptRes.data.id, `ID: ${createDeptRes.data?.id}`);
    const newDeptId = createDeptRes.data.id;

    // Criar subsetor subordinado
    const createSubDeptRes = await api('/api/departamentos', {
      method: 'POST',
      headers: authHeaders,
      body: { parent_id: newDeptId, nome: 'Armazém Central', sigla: 'ARM', ramal: '501', cor: '#f59e0b' }
    });
    logTest('3.3 POST /api/departamentos (Sub-setor)', createSubDeptRes.ok, `Subordinado ao ID: ${newDeptId}`);

    // Validar se subsetor aparece na árvore
    const updatedTree = await api('/api/departamentos/tree', { headers: authHeaders });
    const logDept = updatedTree.data.tree.find(d => d.id === newDeptId);
    const hasChild = logDept && logDept.children.some(c => c.nome === 'Armazém Central');
    logTest('3.4 Validação de Hierarquia Recursiva', !!hasChild, `Filhos de LOG: ${logDept?.children?.length}`);

    // ── 4. TESTE CARGOS ──
    const createCargoRes = await api('/api/cargos', {
      method: 'POST',
      headers: authHeaders,
      body: { nome_cargo: 'Coordenador de Logística', nivel: 'Coordenação', descricao: 'Gestão de frotas' }
    });
    logTest('4.1 POST /api/cargos', createCargoRes.ok, `Cargo criado`);
    const cargoId = createCargoRes.data.id;

    // ── 5. TESTE COLABORADORES (CRUD & FOTO BASE64) ──
    const mockPhoto = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const createColabRes = await api('/api/colaboradores', {
      method: 'POST',
      headers: authHeaders,
      body: {
        nome: 'Juliana Paes Ferreira',
        email: 'juliana.log@inovatech.com',
        telefone: '(11) 97777-8888',
        matricula: 'EMP-999',
        departamento_id: newDeptId,
        cargo_id: cargoId,
        data_admissao: '2024-05-10',
        status: 'ativo',
        foto: mockPhoto
      }
    });
    logTest('5.1 POST /api/colaboradores (com foto Base64)', createColabRes.ok, `ID: ${createColabRes.data?.id}`);
    const colabId = createColabRes.data.id;

    // ── 6. TESTE MOVIMENTAÇÃO DE SETOR ──
    const targetDeptId = treeRes.data.tree[0]?.id || newDeptId;
    const moveRes = await api(`/api/colaboradores/${colabId}/mover`, {
      method: 'PUT',
      headers: authHeaders,
      body: { departamento_id: targetDeptId }
    });
    logTest('6.1 PUT /api/colaboradores/:id/mover', moveRes.ok, `Movido para Dept ${targetDeptId}`);

    // ── 7. TESTE HISTÓRICO & AUDITORIA ──
    const histRes = await api('/api/historico', { headers: authHeaders });
    const hasMoveLog = histRes.data.some(h => h.colaborador_id === colabId && h.tipo.toLowerCase() === 'transferencia');
    logTest('7.1 GET /api/historico (Auditoria Automática)', hasMoveLog, `Registros: ${histRes.data?.length}`);

    // ── 8. TESTE IMPORTAÇÃO EM LOTE CSV ──
    const importRes = await api('/api/colaboradores/import', {
      method: 'POST',
      headers: authHeaders,
      body: {
        colaboradores: [
          { nome: 'Roberto Teste 1', email: 'roberto1@inovatech.com', departamento: 'Logística & Suprimentos', cargo: 'Operador', matricula: 'EMP-801' },
          { nome: 'Camila Teste 2', email: 'camila2@inovatech.com', departamento: 'Logística & Suprimentos', cargo: 'Assistente', matricula: 'EMP-802' }
        ]
      }
    });
    logTest('8.1 POST /api/colaboradores/import (Batch CSV)', importRes.ok && importRes.data.count === 2, `Importados: ${importRes.data?.count}`);

    // ── 9. TESTE DISPOSITIVOS CONTROL ID (HARDWARE & IOT) ──
    const listDevRes = await api('/api/dispositivos', { headers: authHeaders });
    logTest('9.1 GET /api/dispositivos (Listagem)', listDevRes.ok && Array.isArray(listDevRes.data), `Dispositivos: ${listDevRes.data?.length}`);

    const createDevRes = await api('/api/dispositivos', {
      method: 'POST',
      headers: authHeaders,
      body: {
        nome: 'iDFace Teste Automatizado',
        modelo: 'iDFace',
        ip: '192.168.1.150',
        porta: 80,
        identificador_uuid: 'IDFACE-AUTO-TEST-99',
        localizacao: 'Laboratório de Testes'
      }
    });
    logTest('9.2 POST /api/dispositivos (Novo Terminal)', createDevRes.ok, `UUID: ${createDevRes.data?.uuid}`);
    const testDevId = createDevRes.data.id;

    // ── 10. TESTE SINCRONIZAÇÃO BIOMÉTRICA (FOTOS/FACES) ──
    const syncRes = await api(`/api/dispositivos/${testDevId}/sincronizar`, {
      method: 'POST',
      headers: authHeaders
    });
    logTest('10.1 POST /api/dispositivos/:id/sincronizar', syncRes.ok && syncRes.data.sincronizados > 0, `Colabs Sincronizados: ${syncRes.data?.sincronizados}`);

    // ── 11. TESTE ABERTURA REMOTA (PULSO DE CATRACA) ──
    const unlockRes = await api(`/api/dispositivos/${testDevId}/abrir`, {
      method: 'POST',
      headers: authHeaders
    });
    logTest('11.1 POST /api/dispositivos/:id/abrir', unlockRes.ok, `Resposta: ${unlockRes.data?.message}`);

    // ── 12. TESTE PROTOCOLO PUSH WEBHOOK CONTROL ID ──
    const pushRes = await api('/api/controlid/push', {
      method: 'POST',
      body: {
        device_uuid: 'IDFACE-AUTO-TEST-99',
        event: 'face_identified',
        registration: 'EMP-999'
      }
    });
    logTest('12.1 POST /api/controlid/push (Webhook Push)', pushRes.ok && pushRes.data.result?.allow === 1, `Liberação: ${pushRes.data?.result?.message}`);

    // ── 13. TESTE LOGS DE ACESSO FÍSICO ──
    const logsRes = await api('/api/dispositivos/logs', { headers: authHeaders });
    const hasPushLog = logsRes.data.some(l => l.colaborador_nome === 'Juliana Paes Ferreira');
    logTest('13.1 GET /api/dispositivos/logs (Feed de Acessos)', hasPushLog, `Logs capturados: ${logsRes.data?.length}`);

    // ── 13.2 TESTE EXPORTAÇÃO CSV OFICIAL CONTROL ID ──
    const csvExportRes = await fetch(`http://localhost:${PORT}/api/controlid/export-csv`, { headers: authHeaders });
    const csvText = await csvExportRes.text();
    const csvHasHeader = csvText.includes('id_funcionario;CPF;PIS;Nome;Matrícula;');
    logTest('13.2 GET /api/controlid/export-csv (CSV Oficial 76 Colunas)', csvExportRes.ok && csvHasHeader, `Cabeçalho verificado`);

    // ── 13.3 TESTE SINCRONIZAÇÃO DE BANCO E HIERARQUIA VIA API ──
    const syncApiRes = await api('/api/controlid/sync-api', {
      method: 'POST',
      headers: authHeaders,
      body: { host: '192.168.1.100' }
    });
    logTest('13.3 POST /api/controlid/sync-api (Sincronização de Funcionários e Hierarquia)', syncApiRes.ok && syncApiRes.data.total_funcionarios > 0, `Colabs: ${syncApiRes.data?.total_funcionarios}, Depts: ${syncApiRes.data?.total_departamentos}`);

    // ── 13.4 TESTE PUXAR USUÁRIOS DA API CONTROL ID ──
    const pullApiRes = await api('/api/controlid/pull-api', {
      method: 'POST',
      headers: authHeaders,
      body: { host: '192.168.1.100' }
    });
    logTest('13.4 POST /api/controlid/pull-api (Consulta de Usuários)', pullApiRes.ok, `Status: Operacional`);

    // ── 13.5 TESTE CONECTIVIDADE / PING COM TERMINAL ──
    const pingRes = await api('/api/controlid/test-connection', {
      method: 'POST',
      headers: authHeaders,
      body: { host: '192.168.1.100' }
    });
    logTest('13.5 POST /api/controlid/test-connection (Teste Conexão)', pingRes.ok, `Host: ${pingRes.data?.host}`);

    // ── 14. TESTE DASHBOARD METRICS ──
    const dashRes = await api('/api/dashboard', { headers: authHeaders });
    logTest('14.1 GET /api/dashboard (KPIs e Distribuição)', dashRes.ok && dashRes.data.kpis?.totalColaboradores > 0, `Total Colabs: ${dashRes.data?.kpis?.totalColaboradores}`);

    // ── 15. TESTE ISOLAMENTO MULTI-TENANT ──
    const registerOtherRes = await api('/api/auth/register', {
      method: 'POST',
      body: {
        nome_fantasia: 'Empresa Beta Teste',
        razao_social: 'Beta Teste LTDA',
        nome_responsavel: 'Carlos Beta',
        email: `carlos.beta.${Date.now()}@teste.com`,
        senha: 'senha123456'
      }
    });
    const betaToken = registerOtherRes.data.token;
    const betaColabs = await api('/api/colaboradores', { headers: { Authorization: `Bearer ${betaToken}` } });
    logTest('15.1 Isolamento Multi-Tenant Estrito', betaColabs.data.length === 0, `Colabs da Empresa Beta: ${betaColabs.data?.length} (InovaTech isolada)`);

    // ── 16. TESTE SEGURANÇA & ACESSO NEGADO (SEM TOKEN) ──
    const unauthRes = await api('/api/colaboradores');
    logTest('16.1 Bloqueio de Acesso Não Autenticado', unauthRes.status === 401, `Status: ${unauthRes.status}`);

    console.log('\n=========================================');
    console.log(`📊 TOTAL DE TESTES: ${results.length}`);
    console.log(`✅ APROVADOS: ${results.filter(r => r.passed).length}`);
    console.log(`❌ FALHAS: ${results.filter(r => !r.passed).length}`);
    console.log('=========================================\n');
  } catch (err) {
    console.error('Erro nos testes:', err);
  } finally {
    server.close();
  }
}

runTests();
