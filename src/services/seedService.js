const HASH_SENHA123 = '$2b$10$kKtlBptWLGLNfw9829y6ROUFxn9aNDDgr/e9BjPQEsGkcCJbqd1JG';
const HASH_ADMIN123 = '$2b$10$LKLglZCRHVpJtV7foLdkyeUnHHe3MfM8kJmK51TA1aY4.LZyIP3mq';

function seedDatabase(db) {
  if (!db) {
    db = require('../config/database');
  }

  try {
    // 1. Seed Planos
    const { totalPlanos } = db.prepare('SELECT COUNT(*) as totalPlanos FROM planos').get() || { totalPlanos: 0 };
    if (totalPlanos === 0) {
      const insertPlano = db.prepare(`
        INSERT INTO planos (nome, slug, limite_colaboradores, limite_usuarios, preco_mensal, recursos)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      insertPlano.run('Gratuito', 'free', 20, 3, 0.0, JSON.stringify({ organograma: true, carometro: true }));
      insertPlano.run('Profissional', 'pro', 100, 10, 149.0, JSON.stringify({ organograma: true, carometro: true }));
      insertPlano.run('Enterprise', 'enterprise', 99999, 999, 399.0, JSON.stringify({ organograma: true, carometro: true }));
    }

    // 2. Seed Super Admin
    const superAdmin = db.prepare("SELECT id FROM usuarios WHERE role = 'superadmin'").get();
    if (!superAdmin) {
      db.prepare(`
        INSERT INTO usuarios (empresa_id, nome, email, senha_hash, role, status)
        VALUES (NULL, 'Victor (SuperAdmin)', 'admin@gestaosass.com', ?, 'superadmin', 'ativo')
      `).run(HASH_ADMIN123);
    } else {
      db.prepare("UPDATE usuarios SET nome = 'Victor (SuperAdmin)' WHERE role = 'superadmin'").run();
    }

    // 3. Seed Empresa InovaTech
    const { totalEmpresas } = db.prepare('SELECT COUNT(*) as totalEmpresas FROM empresas').get() || { totalEmpresas: 0 };
    let empresaId = 1;
    if (totalEmpresas === 0) {
      const empresaResult = db.prepare(`
        INSERT INTO empresas (razao_social, nome_fantasia, cnpj, slug, email_contato, telefone_contato, logo_url, cor_primaria, plano_id, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 'ativo')
      `).run(
        'InovaTech Soluções Digitais LTDA',
        'InovaTech Soluções',
        '12.345.678/0001-90',
        'inovatech',
        'contato@inovatech.com.br',
        '(11) 3456-7890',
        'https://api.dicebear.com/7.x/identicon/svg?seed=inovatech',
        '#2563eb'
      );
      empresaId = empresaResult.lastInsertRowid;

      // Usuário Admin da Empresa -> Victor
      db.prepare(`
        INSERT INTO usuarios (empresa_id, nome, email, senha_hash, role, status)
        VALUES (?, 'Victor', 'admin@inovatech.com', ?, 'admin', 'ativo')
      `).run(empresaId, HASH_SENHA123);
    }

    // 4. Seed Departamentos e Colaboradores (20 Oficiais se vazio)
    const { totalColabs } = db.prepare('SELECT COUNT(*) as totalColabs FROM colaboradores WHERE empresa_id = ?').get(empresaId) || { totalColabs: 0 };
    if (totalColabs < 20) {
      // Limpa dados antigos da empresa
      db.prepare('DELETE FROM crachas_dados WHERE empresa_id = ?').run(empresaId);
      db.prepare('DELETE FROM colaboradores WHERE empresa_id = ?').run(empresaId);
      db.prepare('DELETE FROM departamentos WHERE empresa_id = ?').run(empresaId);
      db.prepare('DELETE FROM cargos WHERE empresa_id = ?').run(empresaId);

      // Departamentos Hierárquicos
      const dCEO = db.prepare(`INSERT INTO departamentos (empresa_id, parent_id, nome, sigla, ramal, cor, ordem) VALUES (?, NULL, 'Diretoria Executiva', 'DIR-EX', '100', '#1e3a8a', 1)`).run(empresaId).lastInsertRowid;
      const dTI = db.prepare(`INSERT INTO departamentos (empresa_id, parent_id, nome, sigla, ramal, cor, ordem) VALUES (?, ?, 'Tecnologia & Inovação', 'DITEC', '200', '#2563eb', 2)`).run(empresaId, dCEO).lastInsertRowid;
      const dRH = db.prepare(`INSERT INTO departamentos (empresa_id, parent_id, nome, sigla, ramal, cor, ordem) VALUES (?, ?, 'Recursos Humanos & Gente', 'DIR-RH', '300', '#db2777', 3)`).run(empresaId, dCEO).lastInsertRowid;
      const dCOM = db.prepare(`INSERT INTO departamentos (empresa_id, parent_id, nome, sigla, ramal, cor, ordem) VALUES (?, ?, 'Comercial & Expansão', 'DIR-COM', '400', '#059669', 4)`).run(empresaId, dCEO).lastInsertRowid;
      const dFIN = db.prepare(`INSERT INTO departamentos (empresa_id, parent_id, nome, sigla, ramal, cor, ordem) VALUES (?, ?, 'Financeiro & Operações', 'DIR-FIN', '500', '#d97706', 5)`).run(empresaId, dCEO).lastInsertRowid;

      const dDev = db.prepare(`INSERT INTO departamentos (empresa_id, parent_id, nome, sigla, ramal, cor, ordem) VALUES (?, ?, 'Engenharia de Software', 'DEV', '210', '#3b82f6', 1)`).run(empresaId, dTI).lastInsertRowid;
      const dCloud = db.prepare(`INSERT INTO departamentos (empresa_id, parent_id, nome, sigla, ramal, cor, ordem) VALUES (?, ?, 'Infraestrutura & Cloud', 'CLOUD', '220', '#0ea5e9', 2)`).run(empresaId, dTI).lastInsertRowid;
      const dTalentos = db.prepare(`INSERT INTO departamentos (empresa_id, parent_id, nome, sigla, ramal, cor, ordem) VALUES (?, ?, 'Gente, Cultura & DP', 'GENTE', '310', '#f43f5e', 1)`).run(empresaId, dRH).lastInsertRowid;
      const dVendas = db.prepare(`INSERT INTO departamentos (empresa_id, parent_id, nome, sigla, ramal, cor, ordem) VALUES (?, ?, 'Vendas Corporativas B2B', 'VENDAS', '410', '#10b981', 1)`).run(empresaId, dCOM).lastInsertRowid;

      // Cargos
      const insCargo = db.prepare('INSERT INTO cargos (empresa_id, nome_cargo, nivel, descricao) VALUES (?, ?, ?, ?)');
      const cCEO = insCargo.run(empresaId, 'Diretor Geral / CEO', 'C-Level', 'Liderança').lastInsertRowid;
      const cCTO = insCargo.run(empresaId, 'Diretor de Tecnologia (CTO)', 'C-Level', 'Tecnologia').lastInsertRowid;
      const cHeadRH = insCargo.run(empresaId, 'Diretora de Recursos Humanos (CHRO)', 'C-Level', 'RH').lastInsertRowid;
      const cCRO = insCargo.run(empresaId, 'Diretor Comercial (CRO)', 'C-Level', 'Vendas').lastInsertRowid;
      const cCFO = insCargo.run(empresaId, 'Diretor Financeiro (CFO)', 'C-Level', 'Finanças').lastInsertRowid;
      const cTechLead = insCargo.run(empresaId, 'Tech Lead / Arquiteto', 'Especialista', 'Engenharia').lastInsertRowid;
      const cSeniorDev = insCargo.run(empresaId, 'Engenheiro de Software Sênior', 'Sênior', 'Engenharia').lastInsertRowid;
      const cPlenoDev = insCargo.run(empresaId, 'Desenvolvedor Full Stack Pleno', 'Pleno', 'Engenharia').lastInsertRowid;
      const cJuniorDev = insCargo.run(empresaId, 'Desenvolvedor Frontend Júnior', 'Júnior', 'Engenharia').lastInsertRowid;
      const cDevOps = insCargo.run(empresaId, 'Especialista Cloud & DevOps', 'Sênior', 'Infra').lastInsertRowid;
      const cSecOps = insCargo.run(empresaId, 'Analista de Segurança & Redes', 'Pleno', 'Infra').lastInsertRowid;
      const cCoordRH = insCargo.run(empresaId, 'Coordenadora de Gente & Gestão', 'Coordenação', 'RH').lastInsertRowid;
      const cAnalistaDP = insCargo.run(empresaId, 'Analista de Departamento Pessoal', 'Pleno', 'RH').lastInsertRowid;
      const cAssistenteRH = insCargo.run(empresaId, 'Assistente de Recursos Humanos', 'Júnior', 'RH').lastInsertRowid;
      const cGerenteVendas = insCargo.run(empresaId, 'Gerente de Contas Corporativas', 'Gerência', 'Vendas').lastInsertRowid;
      const cExecutivoVendas = insCargo.run(empresaId, 'Executivo de Vendas B2B', 'Pleno', 'Vendas').lastInsertRowid;
      const cSDR = insCargo.run(empresaId, 'Analista de Pré-Vendas (SDR)', 'Júnior', 'Vendas').lastInsertRowid;
      const cCoordFin = insCargo.run(empresaId, 'Coordenador Financeiro', 'Coordenação', 'Finanças').lastInsertRowid;
      const cAnalistaContabil = insCargo.run(empresaId, 'Analista Contábil & Fiscal', 'Pleno', 'Finanças').lastInsertRowid;
      const cAssistenteAdm = insCargo.run(empresaId, 'Assistente Administrativo', 'Júnior', 'Operações').lastInsertRowid;

      // 20 Funcionários com Hierarquia e Documentos Oficiais Válidos (PIS 11 dígitos puro + CPF válido)
      const colabsData = [
        { n: "Victor Hugo Costa", m: "EMP-001", e: "victor.costa@inovatech.com", t: "(11) 98111-0001", c: cCEO, d: dCEO, g: null, adm: "2021-01-15", cpf: "529.000.001-14", pis: "17000000013", rg: "MG-12.345.678", s: "O+" },
        { n: "Rodrigo Mendes Castro", m: "EMP-002", e: "rodrigo.castro@inovatech.com", t: "(11) 98222-0002", c: cCTO, d: dTI, g: 0, adm: "2021-03-01", cpf: "529.000.002-03", pis: "17000000021", rg: "SP-23.456.789", s: "A+" },
        { n: "Mariana Alcantara Paes", m: "EMP-003", e: "mariana.paes@inovatech.com", t: "(11) 98333-0003", c: cHeadRH, d: dRH, g: 0, adm: "2021-04-10", cpf: "529.000.003-86", pis: "17000000030", rg: "RJ-34.567.890", s: "B+" },
        { n: "Carlos Eduardo Silva", m: "EMP-004", e: "carlos.silva@inovatech.com", t: "(11) 98444-0004", c: cCRO, d: dCOM, g: 0, adm: "2021-05-05", cpf: "529.000.004-67", pis: "17000000048", rg: "SP-45.678.901", s: "O+" },
        { n: "Fernando Pacheco Ramos", m: "EMP-005", e: "fernando.ramos@inovatech.com", t: "(11) 98555-0005", c: cCFO, d: dFIN, g: 0, adm: "2021-06-01", cpf: "529.000.005-48", pis: "17000000056", rg: "MG-56.789.012", s: "AB+" },
        { n: "Lucas Pinheiro Gomes", m: "EMP-006", e: "lucas.pinheiro@inovatech.com", t: "(11) 98666-0006", c: cTechLead, d: dDev, g: 1, adm: "2022-01-10", cpf: "529.000.006-29", pis: "17000000064", rg: "SP-67.890.123", s: "A-" },
        { n: "Juliana Moreira Lima", m: "EMP-007", e: "juliana.lima@inovatech.com", t: "(11) 98777-0007", c: cSeniorDev, d: dDev, g: 5, adm: "2022-02-01", cpf: "529.000.007-00", pis: "17000000072", rg: "RJ-78.901.234", s: "O+" },
        { n: "Gabriel Santana Rocha", m: "EMP-008", e: "gabriel.rocha@inovatech.com", t: "(11) 98888-0008", c: cPlenoDev, d: dDev, g: 5, adm: "2022-03-15", cpf: "529.000.008-90", pis: "17000000080", rg: "SP-89.012.345", s: "B+" },
        { n: "Ana Beatriz Fontes", m: "EMP-009", e: "ana.fontes@inovatech.com", t: "(11) 98999-0009", c: cJuniorDev, d: dDev, g: 5, adm: "2022-08-01", cpf: "529.000.009-71", pis: "17000000099", rg: "PR-90.123.456", s: "A+" },
        { n: "Eduardo Fagundes Neves", m: "EMP-010", e: "eduardo.neves@inovatech.com", t: "(11) 99111-0010", c: cDevOps, d: dCloud, g: 1, adm: "2022-02-10", cpf: "529.000.010-05", pis: "17000000102", rg: "SP-01.234.567", s: "O-" },
        { n: "Thiago Barbosa Santos", m: "EMP-011", e: "thiago.santos@inovatech.com", t: "(11) 99222-0011", c: cSecOps, d: dCloud, g: 9, adm: "2022-06-01", cpf: "529.000.011-96", pis: "17000000110", rg: "SC-13.524.678", s: "B-" },
        { n: "Leticia Duarte Toledo", m: "EMP-012", e: "leticia.toledo@inovatech.com", t: "(11) 99333-0012", c: cCoordRH, d: dTalentos, g: 2, adm: "2021-05-15", cpf: "529.000.012-77", pis: "17000000129", rg: "SP-24.635.789", s: "A+" },
        { n: "Marcio Rezende Costa", m: "EMP-013", e: "marcio.costa@inovatech.com", t: "(11) 99444-0013", c: cAnalistaDP, d: dTalentos, g: 11, adm: "2021-09-01", cpf: "529.000.013-58", pis: "17000000137", rg: "MG-35.746.890", s: "O+" },
        { n: "Camila Vasconcelos Prado", m: "EMP-014", e: "camila.prado@inovatech.com", t: "(11) 99555-0014", c: cAssistenteRH, d: dTalentos, g: 11, adm: "2023-02-01", cpf: "529.000.014-39", pis: "17000000145", rg: "SP-46.857.901", s: "AB-" },
        { n: "Beatriz Lima Miranda", m: "EMP-015", e: "beatriz.miranda@inovatech.com", t: "(11) 99666-0015", c: cGerenteVendas, d: dVendas, g: 3, adm: "2021-06-10", cpf: "529.000.015-10", pis: "17000000153", rg: "RJ-57.968.012", s: "A+" },
        { n: "Renato Albuquerque Dias", m: "EMP-016", e: "renato.dias@inovatech.com", t: "(11) 99777-0016", c: cExecutivoVendas, d: dVendas, g: 14, adm: "2021-10-01", cpf: "529.000.016-09", pis: "17000000161", rg: "SP-68.079.123", s: "O+" },
        { n: "Isabela Guimarães Nogueira", m: "EMP-017", e: "isabela.nogueira@inovatech.com", t: "(11) 99888-0017", c: cSDR, d: dVendas, g: 14, adm: "2023-01-15", cpf: "529.000.017-81", pis: "17000000170", rg: "RS-79.180.234", s: "B+" },
        { n: "Felipe Macedo Carvalho", m: "EMP-018", e: "felipe.carvalho@inovatech.com", t: "(11) 99999-0018", c: cCoordFin, d: dFIN, g: 4, adm: "2021-07-01", cpf: "529.000.018-62", pis: "17000000188", rg: "SP-80.291.345", s: "A-" },
        { n: "Patricia Antunes Souza", m: "EMP-019", e: "patricia.souza@inovatech.com", t: "(11) 99112-0019", c: cAnalistaContabil, d: dFIN, g: 17, adm: "2021-11-10", cpf: "529.000.019-43", pis: "17000000196", rg: "DF-91.302.456", s: "O+" },
        { n: "Danilo Faria Moreira", m: "EMP-020", e: "danilo.moreira@inovatech.com", t: "(11) 99223-0020", c: cAssistenteAdm, d: dFIN, g: 17, adm: "2023-04-01", cpf: "529.000.020-87", pis: "17000000200", rg: "SP-02.413.567", s: "A+" }
      ];

      const insertedIds = [];
      const insColab = db.prepare(`
        INSERT INTO colaboradores (empresa_id, matricula, nome, email, telefone, cargo_id, departamento_id, data_admissao, status, foto)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ativo', ?)
      `);

      for (const item of colabsData) {
        const photo = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(item.n)}`;
        const res = insColab.run(empresaId, item.m, item.n, item.e, item.t, item.c, item.d, item.adm, photo);
        insertedIds.push(res.lastInsertRowid);
      }

      // Vínculo hierárquico
      const updGestor = db.prepare('UPDATE colaboradores SET gestor_id = ? WHERE id = ?');
      for (let i = 0; i < colabsData.length; i++) {
        if (colabsData[i].g !== null) {
          updGestor.run(insertedIds[colabsData[i].g], insertedIds[i]);
        }
      }

      // Crachás e documentos
      const insCracha = db.prepare(`
        INSERT INTO crachas_dados (colaborador_id, empresa_id, tipo_sanguineo, rg, cpf, pis_pasep, data_emissao)
        VALUES (?, ?, ?, ?, ?, ?, '2024-01-10')
      `);
      for (let i = 0; i < colabsData.length; i++) {
        insCracha.run(insertedIds[i], empresaId, colabsData[i].s, colabsData[i].rg, colabsData[i].cpf, colabsData[i].pis);
      }
    }

    // 5. Seed Empresa TESTE01 (limpa e zerada para novos testes do zero)
    let teste01 = db.prepare("SELECT id FROM empresas WHERE slug = 'teste01'").get();
    let teste01Id;
    if (!teste01) {
      const empResult = db.prepare(`
        INSERT INTO empresas (razao_social, nome_fantasia, slug, email_contato, cor_primaria, plano_id, status)
        VALUES ('TESTE01 LTDA', 'TESTE01', 'teste01', 'admin@teste01.com', '#2563eb', 1, 'ativo')
      `).run();
      teste01Id = empResult.lastInsertRowid;
      db.prepare(`
        INSERT INTO usuarios (empresa_id, nome, email, senha_hash, role, status)
        VALUES (?, 'Admin TESTE01', 'admin@teste01.com', ?, 'admin', 'ativo')
      `).run(teste01Id, HASH_SENHA123);
    } else {
      teste01Id = teste01.id;
      db.prepare("UPDATE usuarios SET senha_hash = ? WHERE email = 'admin@teste01.com'").run(HASH_SENHA123);
    }
  } catch (err) {
    console.error('Erro ao executar seedDatabase:', err);
  }
}

module.exports = { seedDatabase };
