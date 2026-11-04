// Logowanie do panelu (konta w bazie) i ochrona formularzy.

import { createHmac, timingSafeEqual } from 'node:crypto';

import { DUMMY_HASH, verifyPassword } from './accounts.js';

const COOKIE = 'ec_session';
const MAX_AGE_S = 30 * 24 * 3600;

export function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    try {
      out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
    } catch {
      // uszkodzone ciasteczko – pomijamy
    }
  }
  return out;
}

/**
 * Sesja = id konta + data ważności + podpis HMAC. Podpis obejmuje klucz sesji konta,
 * więc zmiana hasła (nowy klucz) unieważnia wszystkie wcześniejsze sesje.
 */
export function createAuth({ db, secret }) {
  const sign = (uid, exp, sessionKey) => createHmac('sha256', secret).update(`ec2.${uid}.${exp}.${sessionKey}`).digest('base64url');

  return {
    needsSetup() {
      return db.countUsers() === 0;
    },

    /** Zwraca konto przy poprawnym loginie i haśle, inaczej null. */
    async login(username, password) {
      const user = username ? db.getUserByName(username) : null;
      const ok = await verifyPassword(password, user?.password_hash ?? DUMMY_HASH);
      if (!user || !ok) return null;
      db.touchLogin(user.id);
      return user;
    },

    sessionCookie(user, secure) {
      const exp = Math.floor(Date.now() / 1000) + MAX_AGE_S;
      const value = `${user.id}.${exp}.${sign(user.id, exp, user.session_key)}`;
      return `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${MAX_AGE_S}${secure ? '; Secure' : ''}`;
    },

    clearCookie() {
      return `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`;
    },

    /** Zalogowane konto z ciasteczka albo null. */
    currentUser(req) {
      const value = parseCookies(req.headers.cookie)[COOKIE];
      if (!value) return null;
      const [uid, exp, sig] = value.split('.');
      if (!uid || !exp || !sig || Number(exp) < Date.now() / 1000) return null;
      const user = db.getUser(Number(uid));
      if (!user) return null;
      const expected = Buffer.from(sign(user.id, exp, user.session_key));
      const given = Buffer.from(sig);
      return expected.length === given.length && timingSafeEqual(expected, given) ? user : null;
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
