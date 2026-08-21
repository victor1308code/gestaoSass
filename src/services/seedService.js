const bcrypt = require('bcrypt');
const db = require('../config/database');

async function seedDatabase() {
  // 1. Seed Planos
  const { totalPlanos } = db.prepare('SELECT COUNT(*) as totalPlanos FROM planos').get();
  if (totalPlanos === 0) {
    console.log('🌱 Inicializando planos padrão do SaaS...');
    const insertPlano = db.prepare(`
      INSERT INTO planos (nome, slug, limite_colaboradores, limite_usuarios, preco_mensal, recursos)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    insertPlano.run(
      'Gratuito / Start',
      'free',
      15,
      2,
      0.0,
      JSON.stringify({ organograma: true, carometro: true, crachas: true, export_pdf: true })
    );

    insertPlano.run(
      'Profissional (Pro)',
      'pro',
      100,
      10,
      149.0,
      JSON.stringify({ organograma: true, carometro: true, crachas: true, export_pdf: true, export_zip: true, audit_logs: true, custom_branding: true })
    );

    insertPlano.run(
      'Enterprise Ilimitado',
      'enterprise',
      99999,
      999,
      399.0,
      JSON.stringify({ organograma: true, carometro: true, crachas: true, export_pdf: true, export_zip: true, audit_logs: true, custom_branding: true, api_access: true, suporte_dedicado: true })
    );
  }

  // 2. Seed Super Admin da Plataforma
  const superAdmin = db.prepare("SELECT id FROM usuarios WHERE role = 'superadmin'").get();
  if (!superAdmin) {
    console.log('🌱 Criando conta SuperAdmin Master do Gestão SaaS...');
    const hash = await bcrypt.hash('admin123', 10);
    db.prepare(`
      INSERT INTO usuarios (empresa_id, nome, email, senha_hash, role, status)
      VALUES (NULL, 'Super Administrador', 'admin@gestaosass.com', ?, 'superadmin', 'ativo')
    `).run(hash);
  }

  // 3. Seed Empresa de Demonstração (InovaTech Soluções)
  const { totalEmpresas } = db.prepare('SELECT COUNT(*) as totalEmpresas FROM empresas').get();
  if (totalEmpresas === 0) {
    console.log('🌱 Criando empresa de demonstração: InovaTech Soluções...');
    const proPlano = db.prepare("SELECT id FROM planos WHERE slug = 'pro'").get() || { id: 2 };
    
    const empresaResult = db.prepare(`
      INSERT INTO empresas (razao_social, nome_fantasia, cnpj, slug, email_contato, telefone_contato, logo_url, cor_primaria, plano_id, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ativo')
    `).run(
      'InovaTech Soluções Digitais LTDA',
      'InovaTech Soluções',
      '12.345.678/0001-90',
      'inovatech',
      'contato@inovatech.com.br',
      '(11) 3456-7890',
      'https://api.dicebear.com/7.x/identicon/svg?seed=inovatech',
      '#2563eb',
      proPlano.id
    );

    const empresaId = empresaResult.lastInsertRowid;

    // Criar Usuário Admin da Empresa
    const userHash = await bcrypt.hash('senha123', 10);
    db.prepare(`
      INSERT INTO usuarios (empresa_id, nome, email, senha_hash, role, status)
      VALUES (?, 'Carlos Henrique (Admin RH)', 'admin@inovatech.com', ?, 'admin', 'ativo')
    `).run(empresaId, userHash);

    // Criar Departamentos Hierárquicos
    const insertDept = db.prepare(`
      INSERT INTO departamentos (empresa_id, parent_id, nome, sigla, ramal, cor, ordem)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    // Nível 1: Presidência / CEO
    const ceoDept = insertDept.run(empresaId, null, 'Diretoria Executiva / CEO', 'DIR-EX', '100', '#1e3a8a', 1);
    const ceoId = ceoDept.lastInsertRowid;

    // Nível 2: Diretorias
    const tiDept = insertDept.run(empresaId, ceoId, 'Diretoria de Tecnologia e Produto', 'DITEC', '200', '#2563eb', 2);
    const tiId = tiDept.lastInsertRowid;

    const rhDept = insertDept.run(empresaId, ceoId, 'Recursos Humanos & Gestão de Pessoas', 'RH', '300', '#db2777', 3);
    const rhId = rhDept.lastInsertRowid;

    const comDept = insertDept.run(empresaId, ceoId, 'Diretoria Comercial & Expansão', 'COM', '400', '#059669', 4);
    const comId = comDept.lastInsertRowid;

    const finDept = insertDept.run(empresaId, ceoId, 'Diretoria Financeira & Administrativa', 'FIN', '500', '#d97706', 5);
    const finId = finDept.lastInsertRowid;

    // Nível 3: Gerências / Equipes de TI
    const devDept = insertDept.run(empresaId, tiId, 'Engenharia de Software', 'DEV', '210', '#3b82f6', 1);
    const devId = devDept.lastInsertRowid;

    const infraDept = insertDept.run(empresaId, tiId, 'Infraestrutura & DevOps', 'OPS', '220', '#60a5fa', 2);
    const infraId = infraDept.lastInsertRowid;

    // Gerências de Vendas
    const vendasDept = insertDept.run(empresaId, comId, 'Equipe de Vendas B2B', 'VND', '410', '#10b981', 1);
    const vendasId = vendasDept.lastInsertRowid;

    // Criar Cargos
    const insertCargo = db.prepare(`
      INSERT INTO cargos (empresa_id, nome_cargo, nivel, descricao)
      VALUES (?, ?, ?, ?)
    `);

    const cCEO = insertCargo.run(empresaId, 'Chief Executive Officer (CEO)', 'C-Level', 'Diretor Geral').lastInsertRowid;
    const cCTO = insertCargo.run(empresaId, 'Chief Technology Officer (CTO)', 'C-Level', 'Diretor de Tecnologia').lastInsertRowid;
    const cHeadRH = insertCargo.run(empresaId, 'Head de Recursos Humanos', 'Gerência', 'Líder de RH').lastInsertRowid;
    const cHeadCom = insertCargo.run(empresaId, 'Diretor Comercial (CRO)', 'C-Level', 'Diretor Comercial').lastInsertRowid;
    const cCFO = insertCargo.run(empresaId, 'Chief Financial Officer (CFO)', 'C-Level', 'Diretor Financeiro').lastInsertRowid;
    const cDevLead = insertCargo.run(empresaId, 'Tech Lead / Arquiteto de Software', 'Especialista', 'Líder Técnico').lastInsertRowid;
    const cDevSenior = insertCargo.run(empresaId, 'Desenvolvedor Full Stack Sênior', 'Sênior', 'Engenharia de Software').lastInsertRowid;
    const cDevPleno = insertCargo.run(empresaId, 'Desenvolvedor Frontend Pleno', 'Pleno', 'Engenharia de Software').lastInsertRowid;
    const cDevOps = insertCargo.run(empresaId, 'Engenheiro DevOps & Cloud', 'Sênior', 'Cloud & Infraestrutura').lastInsertRowid;
    const cVendedor = insertCargo.run(empresaId, 'Executivo de Contas B2B', 'Pleno', 'Vendas Corporativas').lastInsertRowid;
    const cAnalistaRH = insertCargo.run(empresaId, 'Analista de Gente e Gestão', 'Pleno', 'Recrutamento e Cultura').lastInsertRowid;

    // Criar Colaboradores de Exemplo
    const insertColab = db.prepare(`
      INSERT INTO colaboradores (empresa_id, matricula, nome, email, telefone, cargo_id, departamento_id, gestor_id, data_admissao, status, foto)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ativo', ?)
    `);

    const colab1 = insertColab.run(empresaId, 'EMP-001', 'Mariana Alcantara', 'mariana@inovatech.com', '(11) 98123-4567', cCEO, ceoId, null, '2021-01-15', 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&auto=format&fit=crop&q=80').lastInsertRowid;
    const colab2 = insertColab.run(empresaId, 'EMP-002', 'Rodrigo Mendes', 'rodrigo.mendes@inovatech.com', '(11) 98234-5678', cCTO, tiId, colab1, '2021-03-01', 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=400&auto=format&fit=crop&q=80').lastInsertRowid;
    const colab3 = insertColab.run(empresaId, 'EMP-003', 'Carlos Henrique', 'carlos.rh@inovatech.com', '(11) 98345-6789', cHeadRH, rhId, colab1, '2021-04-10', 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=400&auto=format&fit=crop&q=80').lastInsertRowid;
    const colab4 = insertColab.run(empresaId, 'EMP-004', 'Camila Vasconcelos', 'camila.vendas@inovatech.com', '(11) 98456-7890', cHeadCom, comId, colab1, '2021-06-01', 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&auto=format&fit=crop&q=80').lastInsertRowid;
    const colab5 = insertColab.run(empresaId, 'EMP-005', 'Fernando Pacheco', 'fernando.fin@inovatech.com', '(11) 98567-8901', cCFO, finId, colab1, '2021-08-15', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80').lastInsertRowid;
    const colab6 = insertColab.run(empresaId, 'EMP-006', 'Lucas Pinheiro', 'lucas.dev@inovatech.com', '(11) 98678-9012', cDevLead, devId, colab2, '2022-01-10', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&auto=format&fit=crop&q=80').lastInsertRowid;
    const colab7 = insertColab.run(empresaId, 'EMP-007', 'Juliana Moreira', 'juliana.dev@inovatech.com', '(11) 98789-0123', cDevSenior, devId, colab6, '2022-03-20', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80').lastInsertRowid;
    const colab8 = insertColab.run(empresaId, 'EMP-008', 'Gabriel Santana', 'gabriel.front@inovatech.com', '(11) 98890-1234', cDevPleno, devId, colab6, '2022-07-01', 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=400&auto=format&fit=crop&q=80').lastInsertRowid;
    const colab9 = insertColab.run(empresaId, 'EMP-009', 'Eduardo Fagundes', 'eduardo.ops@inovatech.com', '(11) 98901-2345', cDevOps, infraId, colab2, '2022-09-15', 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=400&auto=format&fit=crop&q=80').lastInsertRowid;
    const colab10 = insertColab.run(empresaId, 'EMP-010', 'Beatriz Lima', 'beatriz.vendas@inovatech.com', '(11) 99012-3456', cVendedor, vendasId, colab4, '2023-02-01', 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&auto=format&fit=crop&q=80').lastInsertRowid;
    const colab11 = insertColab.run(empresaId, 'EMP-011', 'Leticia Duarte', 'leticia.rh@inovatech.com', '(11) 99123-4567', cAnalistaRH, rhId, colab3, '2023-05-10', 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&auto=format&fit=crop&q=80').lastInsertRowid;

    // Criar Crachás de Exemplo
    const insertCracha = db.prepare(`
      INSERT INTO crachas_dados (colaborador_id, empresa_id, tipo_sanguineo, rg, cpf, data_nascimento, data_emissao)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    insertCracha.run(colab1, empresaId, 'O+', 'MG-12.345.678', '111.222.333-44', '1988-04-12', '2021-01-15');
    insertCracha.run(colab2, empresaId, 'A+', 'SP-23.456.789', '222.333.444-55', '1990-08-25', '2021-03-01');
    insertCracha.run(colab6, empresaId, 'B+', 'RJ-34.567.890', '333.444.555-66', '1993-11-03', '2022-01-10');

    // Registrar Histórico Inicial
    const insertHist = db.prepare(`
      INSERT INTO historico_movimentacoes (empresa_id, colaborador_id, colaborador_nome, usuario_id, usuario_nome, tipo, descricao)
      VALUES (?, ?, ?, NULL, 'Sistema', 'admissao', ?)
    `);

    insertHist.run(empresaId, colab1, 'Mariana Alcantara', 'Admissão inicial como CEO');
    insertHist.run(empresaId, colab2, 'Rodrigo Mendes', 'Admissão inicial como CTO');
    insertHist.run(empresaId, colab6, 'Lucas Pinheiro', 'Admissão inicial como Tech Lead');
    
    console.log('✅ Dados de demonstração do SaaS gerados com sucesso!');
  }
}

module.exports = { seedDatabase };
