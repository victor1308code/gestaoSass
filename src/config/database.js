const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');
const { seedDatabase } = require('../services/seedService');

// No Vercel, o único diretório com permissão de escrita em runtime é /tmp
const dbPath = process.env.VERCEL
  ? path.join('/tmp', 'gestao_sass.db')
  : path.join(__dirname, '..', '..', 'gestao_sass.db');

const db = new DatabaseSync(dbPath);

// Configurações de concorrência e timeout para NUNCA dar "database is locked"
db.exec(`
  PRAGMA busy_timeout = 5000;
  PRAGMA foreign_keys = ON;

  -- 1. PLANOS DE ASSINATURA DO SAAS
  CREATE TABLE IF NOT EXISTS planos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    limite_colaboradores INTEGER NOT NULL DEFAULT 20,
    limite_usuarios INTEGER NOT NULL DEFAULT 3,
    preco_mensal REAL NOT NULL DEFAULT 0.0,
    recursos TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- 2. EMPRESAS (TENANTS)
  CREATE TABLE IF NOT EXISTS empresas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    razao_social TEXT NOT NULL,
    nome_fantasia TEXT NOT NULL,
    cnpj TEXT,
    slug TEXT UNIQUE NOT NULL,
    email_contato TEXT,
    telefone_contato TEXT,
    logo_url TEXT,
    cor_primaria TEXT DEFAULT '#4f46e5',
    plano_id INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'ativo',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (plano_id) REFERENCES planos (id)
  );

  -- 3. USUÁRIOS
  CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    empresa_id INTEGER,
    nome TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    senha_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'viewer',
    status TEXT NOT NULL DEFAULT 'ativo',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (empresa_id) REFERENCES empresas (id) ON DELETE CASCADE
  );

  -- 4. DEPARTAMENTOS / SETORES
  CREATE TABLE IF NOT EXISTS departamentos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    empresa_id INTEGER NOT NULL,
    parent_id INTEGER,
    nome TEXT NOT NULL,
    sigla TEXT,
    ramal TEXT,
    responsavel_id INTEGER,
    ordem INTEGER DEFAULT 0,
    cor TEXT DEFAULT '#4f46e5',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (empresa_id) REFERENCES empresas (id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES departamentos (id) ON DELETE SET NULL
  );

  -- 5. CARGOS & FUNÇÕES
  CREATE TABLE IF NOT EXISTS cargos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    empresa_id INTEGER NOT NULL,
    nome_cargo TEXT NOT NULL,
    nivel TEXT DEFAULT 'Pleno',
    cbo TEXT,
    descricao TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (empresa_id) REFERENCES empresas (id) ON DELETE CASCADE
  );

  -- 6. COLABORADORES (FUNCIONÁRIOS)
  CREATE TABLE IF NOT EXISTS colaboradores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    empresa_id INTEGER NOT NULL,
    matricula TEXT,
    nome TEXT NOT NULL,
    email TEXT,
    telefone TEXT,
    cargo_id INTEGER,
    departamento_id INTEGER,
    gestor_id INTEGER,
    data_admissao TEXT,
    status TEXT NOT NULL DEFAULT 'ativo',
    foto TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (empresa_id) REFERENCES empresas (id) ON DELETE CASCADE,
    FOREIGN KEY (cargo_id) REFERENCES cargos (id) ON DELETE SET NULL,
    FOREIGN KEY (departamento_id) REFERENCES departamentos (id) ON DELETE SET NULL,
    FOREIGN KEY (gestor_id) REFERENCES colaboradores (id) ON DELETE SET NULL
  );

  -- 7. DADOS PARA EMISSÃO DE CRACHÁS
  CREATE TABLE IF NOT EXISTS crachas_dados (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    colaborador_id INTEGER UNIQUE NOT NULL,
    empresa_id INTEGER NOT NULL,
    tipo_sanguineo TEXT,
    numero_via TEXT DEFAULT '1ª Via',
    filiacao_pai TEXT,
    filiacao_mae TEXT,
    naturalidade_cidade TEXT,
    naturalidade_uf TEXT,
    data_nascimento TEXT,
    rg TEXT,
    cpf TEXT,
    pis_pasep TEXT,
    data_emissao TEXT,
    qrcode_custom TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (colaborador_id) REFERENCES colaboradores (id) ON DELETE CASCADE,
    FOREIGN KEY (empresa_id) REFERENCES empresas (id) ON DELETE CASCADE
  );

  -- 8. HISTÓRICO & AUDITORIA DE MOVIMENTAÇÕES
  CREATE TABLE IF NOT EXISTS historico_movimentacoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    empresa_id INTEGER NOT NULL,
    colaborador_id INTEGER,
    colaborador_nome TEXT NOT NULL,
    usuario_id INTEGER,
    usuario_nome TEXT,
    tipo TEXT NOT NULL,
    descricao TEXT NOT NULL,
    detalhes_json TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (empresa_id) REFERENCES empresas (id) ON DELETE CASCADE
  );

  -- 9. ÍNDICES
  CREATE INDEX IF NOT EXISTS idx_usuarios_empresa ON usuarios (empresa_id);
  CREATE INDEX IF NOT EXISTS idx_departamentos_empresa ON departamentos (empresa_id);
  CREATE INDEX IF NOT EXISTS idx_cargos_empresa ON cargos (empresa_id);
  CREATE INDEX IF NOT EXISTS idx_colaboradores_empresa ON colaboradores (empresa_id);
  CREATE INDEX IF NOT EXISTS idx_colaboradores_dept ON colaboradores (departamento_id);
  CREATE INDEX IF NOT EXISTS idx_crachas_empresa ON crachas_dados (empresa_id);
  CREATE INDEX IF NOT EXISTS idx_historico_empresa ON historico_movimentacoes (empresa_id);
`);

// Garante que o banco seja populado com os dados demo
seedDatabase(db);

module.exports = db;
