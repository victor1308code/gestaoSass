const bcrypt = require('bcrypt');

const HASH_SENHA123 = '$2b$10$kKtlBptWLGLNfw9829y6ROUFxn9aNDDgr/e9BjPQEsGkcCJbqd1JG';
const HASH_ADMIN123 = '$2b$10$LKLglZCRHVpJtV7foLdkyeUnHHe3MfM8kJmK51TA1aY4.LZyIP3mq';

function seedDatabase(db) {
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
        VALUES (NULL, 'Super Administrador', 'admin@gestaosass.com', ?, 'superadmin', 'ativo')
      `).run(HASH_ADMIN123);
    }

    // 3. Seed Empresa InovaTech
    const { totalEmpresas } = db.prepare('SELECT COUNT(*) as totalEmpresas FROM empresas').get() || { totalEmpresas: 0 };
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
        '#4f46e5'
      );

      const empresaId = empresaResult.lastInsertRowid;

      // Usuário Admin da Empresa
      db.prepare(`
        INSERT INTO usuarios (empresa_id, nome, email, senha_hash, role, status)
        VALUES (?, 'Carlos Henrique (Admin RH)', 'admin@inovatech.com', ?, 'admin', 'ativo')
      `).run(empresaId, HASH_SENHA123);

      // Departamentos
      const insertDept = db.prepare(`
        INSERT INTO departamentos (empresa_id, parent_id, nome, sigla, ramal, cor, ordem)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      const ceoId = insertDept.run(empresaId, null, 'Diretoria Executiva / CEO', 'DIR-EX', '100', '#1e3a8a', 1).lastInsertRowid;
      const tiId = insertDept.run(empresaId, ceoId, 'Diretoria de Tecnologia e Produto', 'DITEC', '200', '#4f46e5', 2).lastInsertRowid;
      const rhId = insertDept.run(empresaId, ceoId, 'Recursos Humanos & Gestão de Pessoas', 'RH', '300', '#db2777', 3).lastInsertRowid;
      const comId = insertDept.run(empresaId, ceoId, 'Diretoria Comercial & Expansão', 'COM', '400', '#059669', 4).lastInsertRowid;
      const devId = insertDept.run(empresaId, tiId, 'Engenharia de Software', 'DEV', '210', '#3b82f6', 1).lastInsertRowid;

      // Cargos
      const insertCargo = db.prepare(`
        INSERT INTO cargos (empresa_id, nome_cargo, nivel, descricao)
        VALUES (?, ?, ?, ?)
      `);

      const cCEO = insertCargo.run(empresaId, 'Chief Executive Officer (CEO)', 'C-Level', 'Diretoria').lastInsertRowid;
      const cCTO = insertCargo.run(empresaId, 'Chief Technology Officer (CTO)', 'C-Level', 'Tecnologia').lastInsertRowid;
      const cHeadRH = insertCargo.run(empresaId, 'Head de Recursos Humanos', 'Gerência', 'RH').lastInsertRowid;
      const cDevLead = insertCargo.run(empresaId, 'Tech Lead / Especialista', 'Sênior', 'Engenharia').lastInsertRowid;

      // Colaboradores
      const insertColab = db.prepare(`
        INSERT INTO colaboradores (empresa_id, matricula, nome, email, telefone, cargo_id, departamento_id, data_admissao, status, foto)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ativo', ?)
      `);

      insertColab.run(empresaId, 'EMP-001', 'Mariana Alcantara', 'mariana@inovatech.com', '(11) 98123-4567', cCEO, ceoId, '2021-01-15', 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&auto=format&fit=crop&q=80');
      insertColab.run(empresaId, 'EMP-002', 'Rodrigo Mendes', 'rodrigo.mendes@inovatech.com', '(11) 98234-5678', cCTO, tiId, '2021-03-01', 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=400&auto=format&fit=crop&q=80');
      insertColab.run(empresaId, 'EMP-003', 'Carlos Henrique', 'carlos.rh@inovatech.com', '(11) 98345-6789', cHeadRH, rhId, '2021-04-10', 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=400&auto=format&fit=crop&q=80');
      insertColab.run(empresaId, 'EMP-006', 'Lucas Pinheiro', 'lucas.dev@inovatech.com', '(11) 98678-9012', cDevLead, devId, '2022-01-10', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&auto=format&fit=crop&q=80');
    }
  } catch (err) {
    console.error('Erro ao executar seedDatabase:', err);
  }
}

module.exports = { seedDatabase };
