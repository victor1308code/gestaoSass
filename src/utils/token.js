const crypto = require('crypto');
const ENV = require('../config/env');

const SECRET = ENV.SESSION_SECRET || 'gestao_saas_jwt_super_secret_2026';

function signToken(payload, expiresInMs = 7 * 24 * 60 * 60 * 1000) { // 7 dias
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const exp = Date.now() + expiresInMs;
  const data = Buffer.from(JSON.stringify({ ...payload, exp })).toString('base64url');
  const signature = crypto.createHmac('sha256', SECRET).update(`${header}.${data}`).digest('base64url');
  return `${header}.${data}.${signature}`;
}

function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  
  const [header, data, signature] = parts;
  const expectedSignature = crypto.createHmac('sha256', SECRET).update(`${header}.${data}`).digest('base64url');
  
  if (signature !== expectedSignature) return null;
  
  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch (e) {
    return null;
  }
}

module.exports = { signToken, verifyToken };
