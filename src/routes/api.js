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

// Rate limiters específicos
const authLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 15, message: 'Muitas tentativas de autenticação. Aguarde 10 minutos.' });
const registerLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 10, message: 'Muitas criações de empresas. Aguarde antes de tentar novamente.' });

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

// ── 6. DASHBOARD & HISTÓRICO ──────────────────────────────────────────────
router.get('/dashboard', requireAuth, requireTenant, dashboardController.getMetrics);
router.get('/historico', requireAuth, requireTenant, historicoController.list);

module.exports = router;
