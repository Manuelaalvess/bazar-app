const crypto = require('crypto');

const COOKIE_NAME = 'bazar_admin_session';

function getSecret() {
  return process.env.ADMIN_PASSWORD || 'troque-esta-senha';
}

// Gera um token assinado simples (HMAC) — não é um JWT completo, mas é
// suficiente para um painel admin de uso pessoal com um único usuário.
function createSessionToken() {
  const payload = `admin:${Date.now()}`;
  const hmac = crypto.createHmac('sha256', getSecret()).update(payload).digest('hex');
  return Buffer.from(`${payload}:${hmac}`).toString('base64url');
}

function verifySessionToken(token) {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    const parts = decoded.split(':');
    const hmac = parts.pop();
    const payload = parts.join(':');
    const expected = crypto.createHmac('sha256', getSecret()).update(payload).digest('hex');
    return hmac === expected;
  } catch {
    return false;
  }
}

module.exports = { COOKIE_NAME, createSessionToken, verifySessionToken };
