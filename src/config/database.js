const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');
const { seedDatabase } = require('../services/seedService');

// No Vercel, o único diretório com permissão de escrita em runtime é /tmp
const rootDbPath = path.join(__dirname, '..', '..', 'gestao_sass.db');
const tmpDbPath = path.join('/tmp', 'gestao_sass.db');

let dbPath = rootDbPath;
if (process.env.VERCEL) {
  dbPath = tmpDbPath;
  if (fs.existsSync(rootDbPath) && !fs.existsSync(tmpDbPath)) {
    try {
      fs.copyFileSync(rootDbPath, tmpDbPath);
    } catch (e) {
      console.error('Erro ao copiar banco para /tmp:', e);
    }
  }
}

const db = new DatabaseSync(dbPath);

// Configurações de concorrência e timeout para evitar bloqueios
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
    cor_primaria TEXT DEFAULT '#2563eb',
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
    cor TEXT DEFAULT '#2563eb',
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

  -- 9. DISPOSITIVOS CONTROL ID (TERMINAIS & CATRACAS)
  CREATE TABLE IF NOT EXISTS dispositivos_controlid (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    empresa_id INTEGER NOT NULL,
    nome TEXT NOT NULL,
    modelo TEXT NOT NULL DEFAULT 'iDFace',
    ip TEXT,
    porta INTEGER DEFAULT 80,
    identificador_uuid TEXT,
    chave_api TEXT,
    localizacao TEXT,
    status TEXT NOT NULL DEFAULT 'online',
    ultima_comunicacao DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (empresa_id) REFERENCES empresas (id) ON DELETE CASCADE
  );

  -- 10. REGRAS DE ACESSO POR DEPARTAMENTO
  CREATE TABLE IF NOT EXISTS regras_acesso_dispositivo (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    empresa_id INTEGER NOT NULL,
    dispositivo_id INTEGER NOT NULL,
    departamento_id INTEGER NOT NULL,
    horario_inicio TEXT DEFAULT '00:00',
    horario_fim TEXT DEFAULT '23:59',
    dias_semana TEXT DEFAULT '1,2,3,4,5',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (empresa_id) REFERENCES empresas (id) ON DELETE CASCADE,
    FOREIGN KEY (dispositivo_id) REFERENCES dispositivos_controlid (id) ON DELETE CASCADE,
    FOREIGN KEY (departamento_id) REFERENCES departamentos (id) ON DELETE CASCADE
  );

  -- 11. LOGS DE ACESSO EM TEMPO REAL (CONTROL ID)
  CREATE TABLE IF NOT EXISTS logs_acesso_controlid (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    empresa_id INTEGER NOT NULL,
    dispositivo_id INTEGER,
    dispositivo_nome TEXT,
    colaborador_id INTEGER,
    colaborador_nome TEXT,
    tipo_autenticacao TEXT DEFAULT 'facial',
    status_acesso TEXT NOT NULL DEFAULT 'liberado',
    foto_registro TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (empresa_id) REFERENCES empresas (id) ON DELETE CASCADE
  );

  -- 12. ADMISSÕES DIGITAIS (ONBOARDING)
  CREATE TABLE IF NOT EXISTS admissoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    empresa_id INTEGER NOT NULL,
    nome TEXT NOT NULL,
    email TEXT NOT NULL,
    telefone TEXT,
    token_acesso TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL DEFAULT 'pendente_candidato',
    dados_candidato TEXT,
    documentos_anexos TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (empresa_id) REFERENCES empresas (id) ON DELETE CASCADE
  );

  -- 13. ÍNDICES
  CREATE INDEX IF NOT EXISTS idx_usuarios_empresa ON usuarios (empresa_id);
  CREATE INDEX IF NOT EXISTS idx_departamentos_empresa ON departamentos (empresa_id);
  CREATE INDEX IF NOT EXISTS idx_cargos_empresa ON cargos (empresa_id);
  CREATE INDEX IF NOT EXISTS idx_colaboradores_empresa ON colaboradores (empresa_id);
  CREATE INDEX IF NOT EXISTS idx_colaboradores_dept ON colaboradores (departamento_id);
  CREATE INDEX IF NOT EXISTS idx_dispositivos_empresa ON dispositivos_controlid (empresa_id);
  CREATE INDEX IF NOT EXISTS idx_logs_acesso_empresa ON logs_acesso_controlid (empresa_id);
  CREATE INDEX IF NOT EXISTS idx_admissoes_empresa ON admissoes (empresa_id);
  CREATE INDEX IF NOT EXISTS idx_admissoes_token ON admissoes (token_acesso);
`);

// Popula o banco com os dados iniciais
seedDatabase(db);

module.exports = db;
