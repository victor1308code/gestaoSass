require('dotenv').config({ quiet: true });

const ENV = {
  PORT: process.env.PORT || 4000,
  SESSION_SECRET: process.env.SESSION_SECRET || 'gestao_sass_super_secret_key_2026_change_in_prod',
  NODE_ENV: process.env.NODE_ENV || 'development'
};

module.exports = ENV;
