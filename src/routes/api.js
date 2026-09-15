const express = require('express');
const router = express.Router();

const { requireAuth } = require('../middlewares/auth');
const { requireTenant } = require('../middlewares/tenant');
const { requireRole } = require('../middlewares/roleCheck');
const { rateLimit } = require('../middlewares/rateLimit');

const authController = require('../controllers/authController');
const empresaController = require('../controllers/empresaController');
const departamentoController = require('../controllers/departamentoController');
const cargoController = require('../controllers/cargoController');
const colaboradorController = require('../controllers/colaboradorController');
const dashboardController = require('../controllers/dashboardController');
const historicoController = require('../controllers/historicoController');
const controlIdController = require('../controllers/controlIdController');

// Rate limiters específicos
const authLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 25, message: 'Muitas tentativas de autenticação. Aguarde 10 minutos.' });
const registerLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 15, message: 'Muitas criações de empresas. Aguarde antes de tentar novamente.' });

// ── 1. AUTENTICAÇÃO & CADASTRO ──────────────────────────────────────────────
router.post('/auth/login', authLimiter, authController.login);
router.post('/auth/register', registerLimiter, authController.registerEmpresa);
router.post('/auth/logout', authController.logout);
router.get('/auth/me', requireAuth, authController.me);
router.post('/auth/senha', requireAuth, authController.updatePassword);

// ── 2. EMPRESA (CONFIGURAÇÕES & USUÁRIOS) ──────────────────────────────────
router.get('/empresa', requireAuth, requireTenant, empresaController.getDetails);
router.put('/empresa', requireAuth, requireTenant, requireRole('admin'), empresaController.update);
router.get('/empresa/usuarios', requireAuth, requireTenant, requireRole('admin'), empresaController.listUsers);
router.post('/empresa/usuarios', requireAuth, requireTenant, requireRole('admin'), empresaController.createUser);
router.delete('/empresa/usuarios/:id', requireAuth, requireTenant, requireRole('admin'), empresaController.deleteUser);
router.post('/empresa/rehydrate', requireAuth, requireTenant, empresaController.rehydrate);
router.post('/empresa/reset-test', requireAuth, requireTenant, requireRole('admin'), empresaController.resetTestData);

// ── 3. DEPARTAMENTOS & HIERARQUIA ─────────────────────────────────────────
router.get('/departamentos', requireAuth, requireTenant, departamentoController.list);
router.get('/departamentos/tree', requireAuth, requireTenant, departamentoController.getTree);
router.post('/departamentos', requireAuth, requireTenant, requireRole('admin', 'gestor'), departamentoController.create);
router.put('/departamentos/:id', requireAuth, requireTenant, requireRole('admin', 'gestor'), departamentoController.update);
router.delete('/departamentos/:id', requireAuth, requireTenant, requireRole('admin'), departamentoController.delete);

// ── 4. CARGOS & FUNÇÕES ───────────────────────────────────────────────────
router.get('/cargos', requireAuth, requireTenant, cargoController.list);
router.post('/cargos', requireAuth, requireTenant, requireRole('admin', 'gestor'), cargoController.create);
router.put('/cargos/:id', requireAuth, requireTenant, requireRole('admin', 'gestor'), cargoController.update);
router.delete('/cargos/:id', requireAuth, requireTenant, requireRole('admin'), cargoController.delete);

// ── 5. COLABORADORES ──────────────────────────────────────────────────────
router.get('/colaboradores', requireAuth, requireTenant, colaboradorController.list);
router.get('/colaboradores/export/csv', requireAuth, requireTenant, colaboradorController.exportCsv);
router.get('/colaboradores/:id', requireAuth, requireTenant, colaboradorController.getById);
router.post('/colaboradores', requireAuth, requireTenant, requireRole('admin', 'gestor'), colaboradorController.create);
router.put('/colaboradores/:id', requireAuth, requireTenant, requireRole('admin', 'gestor'), colaboradorController.update);
router.put('/colaboradores/:id/mover', requireAuth, requireTenant, requireRole('admin', 'gestor'), colaboradorController.mover);
router.put('/colaboradores/:id/foto', requireAuth, requireTenant, requireRole('admin', 'gestor'), colaboradorController.updatePhoto);
router.delete('/colaboradores/:id', requireAuth, requireTenant, requireRole('admin'), colaboradorController.delete);
router.post('/colaboradores/import', requireAuth, requireTenant, requireRole('admin'), colaboradorController.importBatch);

// ── 6. INTEGRAÇÃO CONTROL ID (RHID CLOUD & CSV) ──────────────────────────
router.get('/controlid/export-csv', requireAuth, requireTenant, controlIdController.exportCsv);
router.post('/controlid/pull-cloud', requireAuth, requireTenant, requireRole('admin', 'gestor'), controlIdController.pullCloud);

// ── 7. DASHBOARD & HISTÓRICO ──────────────────────────────────────────────
const admissaoController = require('../controllers/admissaoController');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');

// Configuração do Multer (Upload de Arquivos com Blindagem de Segurança)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../public/uploads'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, crypto.randomBytes(16).toString('hex') + ext);
  }
});

const fileFilter = (req, file, cb) => {
  // Lista branca estrita de tipos MIME permitidos
  const allowedMimeTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Formato inválido. Apenas PDF, JPG e PNG são permitidos.'));
  }
};

const upload = multer({ 
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // Limite físico de 5MB por arquivo
  },
  fileFilter
});

// Middleware auxiliar para interceptar e formatar erros do Multer como JSON amigável
const handleSecureUpload = (req, res, next) => {
  const uploadMiddleware = upload.any();
  uploadMiddleware(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'Falha de segurança: Um dos arquivos excede o limite estrito de 5MB.' });
      }
      return res.status(400).json({ error: `Erro no envio: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ error: err.message });
    }
    next();
  });
};

// ── 7. DASHBOARD & HISTÓRICO ──────────────────────────────────────────────
router.get('/dashboard', requireAuth, requireTenant, dashboardController.getMetrics);
router.get('/historico', requireAuth, requireTenant, historicoController.list);

// ── 8. ADMISSÕES DIGITAIS (ONBOARDING) ────────────────────────────────────
// Rotas Públicas (para o Candidato acessando via Token)
router.get('/admissao/candidato/:token', admissaoController.getCandidatoByToken);
router.post('/admissao/candidato/:token/documentos', handleSecureUpload, admissaoController.enviarDocumentosCandidato);

// Status do sistema
router.get('/config/smtp-status', (req, res) => {
  res.json({ configurado: !!process.env.SMTP_HOST });
});

// Rotas Privadas (Painel do RH)
router.post('/admissao/iniciar', requireAuth, requireTenant, requireRole('admin', 'gestor'), admissaoController.iniciarAdmissao);
router.get('/admissao', requireAuth, requireTenant, requireRole('admin', 'gestor'), admissaoController.listarAdmissoes);
router.get('/admissao/:id', requireAuth, requireTenant, requireRole('admin', 'gestor'), admissaoController.getAdmissaoById);
router.post('/admissao/:id/contabilidade', requireAuth, requireTenant, requireRole('admin', 'gestor'), admissaoController.encaminharParaContabilidade);
router.post('/admissao/:id/finalizar', requireAuth, requireTenant, requireRole('admin', 'gestor'), admissaoController.finalizarAdmissao);
router.delete('/admissao/:id', requireAuth, requireTenant, requireRole('admin', 'gestor'), admissaoController.deleteAdmissao);

module.exports = router;
