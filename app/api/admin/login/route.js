import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { COOKIE_NAME, createSessionToken } from '../../../../lib/auth';

// Limite de tentativas por IP em memória. Em ambientes serverless com
// múltiplas instâncias (ex.: Vercel) isso é "melhor esforço" — cada
// instância tem seu próprio contador — mas já barra brute force trivial.
const LOGIN_ATTEMPT_LIMIT = 10;
const LOGIN_ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const attemptsByIp = new Map();

function getClientIp(request) {
  const forwarded = request.headers.get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() || 'unknown';
}

function isRateLimited(ip) {
  const entry = attemptsByIp.get(ip);
  if (!entry || Date.now() > entry.resetAt) return false;
  return entry.count >= LOGIN_ATTEMPT_LIMIT;
}

function registerFailedAttempt(ip) {
  const now = Date.now();
  const entry = attemptsByIp.get(ip);
  if (!entry || now > entry.resetAt) {
    attemptsByIp.set(ip, { count: 1, resetAt: now + LOGIN_ATTEMPT_WINDOW_MS });
    return;
  }
  entry.count += 1;
}

// Comparação em tempo constante — evita vazar, por diferença de tempo de
// resposta, quantos caracteres da senha estão corretos.
function timingSafeCompare(a, b) {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) {
    crypto.timingSafeEqual(bufA, bufA); // mantém o tempo de execução parecido
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

export async function POST(request) {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (typeof adminPassword !== 'string' || adminPassword.length === 0) {
    // Nunca aprova login sem senha configurada no servidor.
    return NextResponse.json({ error: 'Configuração do servidor incompleta' }, { status: 500 });
  }

  const ip = getClientIp(request);
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: 'Muitas tentativas. Aguarde alguns minutos.' }, { status: 429 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Requisição inválida' }, { status: 400 });
  }
  const { password } = body ?? {};
  const valid = typeof password === 'string' && password.length > 0 && timingSafeCompare(password, adminPassword);

  if (!valid) {
    registerFailedAttempt(ip);
    return NextResponse.json({ error: 'Senha incorreta' }, { status: 401 });
  }

  const token = createSessionToken();
  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}
