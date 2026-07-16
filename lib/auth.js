const crypto = require('crypto');
const { cookies } = require('next/headers');

const COOKIE_NAME = 'bazar_admin_session';
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // mantém alinhado ao maxAge do cookie no login

// Nunca cai num segredo padrão — sem ADMIN_PASSWORD configurada, nenhum
// token pode ser criado nem verificado.
function getSecret() {
  const secret = process.env.ADMIN_PASSWORD;
  if (typeof secret !== 'string' || secret.length === 0) {
    throw new Error('ADMIN_PASSWORD não configurada');
  }
  return secret;
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
    const secret = getSecret();
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    const parts = decoded.split(':');
    const hmac = parts.pop();
    const payload = parts.join(':');
    const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');

    const hmacBuf = Buffer.from(hmac || '', 'hex');
    const expectedBuf = Buffer.from(expected, 'hex');
    if (hmacBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(hmacBuf, expectedBuf)) {
      return false;
    }

    const timestamp = Number(payload.split(':')[1]);
    if (!Number.isFinite(timestamp)) return false;
    const age = Date.now() - timestamp;
    if (age < 0 || age > SESSION_MAX_AGE_MS) return false; // token no futuro ou expirado

    return true;
  } catch {
    // Sem ADMIN_PASSWORD configurada (getSecret lança) ou token malformado
    // — em qualquer caso, não autentica.
    return false;
  }
}

function isAdminRequest() {
  const token = cookies().get(COOKIE_NAME)?.value;
  return token ? verifySessionToken(token) : false;
}

module.exports = { COOKIE_NAME, SESSION_MAX_AGE_MS, createSessionToken, verifySessionToken, isAdminRequest };
