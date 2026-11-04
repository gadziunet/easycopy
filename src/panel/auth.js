// Logowanie do panelu (opcjonalne hasło PANEL_PASSWORD) i ochrona formularzy.

import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

const COOKIE = 'ec_session';
const MAX_AGE_S = 30 * 24 * 3600;

const sha = (text) => createHash('sha256').update(String(text)).digest();

export function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
}

export function createAuth({ password, secret }) {
  const enabled = Boolean(password);
  const passwordHash = enabled ? sha(password) : null;
  const sign = (exp) => createHmac('sha256', secret).update(`ec1.${exp}`).digest('base64url');

  return {
    enabled,

    checkPassword(given) {
      return enabled && timingSafeEqual(sha(given ?? ''), passwordHash);
    },

    sessionCookie(secure) {
      const exp = Math.floor(Date.now() / 1000) + MAX_AGE_S;
      const value = `${exp}.${sign(exp)}`;
      return `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${MAX_AGE_S}${secure ? '; Secure' : ''}`;
    },

    clearCookie() {
      return `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`;
    },

    isLoggedIn(req) {
      if (!enabled) return true;
      const value = parseCookies(req.headers.cookie)[COOKIE];
      if (!value) return false;
      const [exp, sig] = value.split('.');
      if (!exp || !sig || Number(exp) < Date.now() / 1000) return false;
      const expected = Buffer.from(sign(exp));
      const given = Buffer.from(sig);
      return expected.length === given.length && timingSafeEqual(expected, given);
    },
  };
}

/**
 * Formularze (POST) przyjmujemy tylko z tej samej strony – inna strona otwarta w przeglądarce
 * nie może w Twoim imieniu dodać zadania ani niczego anulować (ochrona przed CSRF).
 */
export function isSameOrigin(req) {
  const host = req.headers.host;
  const source = req.headers.origin || req.headers.referer;
  if (!host || !source || source === 'null') return false;
  try {
    return new URL(source).host === host;
  } catch {
    return false;
  }
}
