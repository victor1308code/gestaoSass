const express = require('express');
const path = require('path');
const session = require('express-session');
const ENV = require('./src/config/env');
const db = require('./src/config/database');
const { seedDatabase } = require('./src/services/seedService');
const apiRoutes = require('./src/routes/api');

const app = express();

app.disable('x-powered-by');
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'same-origin');
  next();
});

// Session configuration
app.use(session({
  secret: ENV.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production' && !process.env.VERCEL
  }
}));

// Servir arquivos estáticos do frontend
app.use(express.static(path.join(__dirname, 'public')));

// Auto-seed middleware for serverless cold start
let seeded = false;
app.use(async (req, res, next) => {
  if (!seeded) {
    try {
      await seedDatabase();
      seeded = true;
    } catch (e) {
      console.error('Seed error:', e);
    }
  }
  next();
});

// Rotas da API REST
app.use('/api', apiRoutes);

// Fallback SPA routing
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Tratamento de erros
app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err);
  res.status(500).json({ error: 'Erro interno no servidor.' });
});

// Inicialização local
if (!process.env.VERCEL) {
  seedDatabase().then(() => {
    app.listen(ENV.PORT, () => {
      console.log(`🚀 Servidor Gestão SaaS rodando na porta ${ENV.PORT}`);
    });
  }).catch(err => {
    console.error('Falha ao iniciar:', err);
  });
}

module.exports = app;
