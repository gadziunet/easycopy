// Panel login (accounts in the database) and form protection.

import { createHmac, timingSafeEqual } from 'node:crypto';

import { DUMMY_HASH, verifyPassword } from './accounts.js';
import { parseCookies } from '../shared/cookies.js';

const COOKIE = 'ec_session';
const MAX_AGE_S = 30 * 24 * 3600;

export { parseCookies };

/**
 * Session = account id + expiry time + HMAC signature. The signature includes the account's session key,
 * so changing the password (new key) invalidates all earlier sessions.
 */
export function createAuth({ db, secret }) {
  const sign = (uid, exp, sessionKey) => createHmac('sha256', secret).update(`ec2.${uid}.${exp}.${sessionKey}`).digest('base64url');

  return {
    needsSetup() {
      return db.countUsers() === 0;
    },

    /** Returns the account for a correct username and password, otherwise null. */
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

    /** Logged-in account from the cookie, or null. */
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
 * Forms (POST) are accepted only from the same site – another site open in the browser
 * cannot add a job or cancel anything on your behalf (CSRF protection).
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
