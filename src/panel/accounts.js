// Konta panelu: hasła (scrypt z solą) i walidacja.

import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCb);
const PARAMS = { N: 16384, r: 8, p: 1 };
const KEY_LEN = 32;

export const USERNAME_RE = /^[a-zA-Z0-9._-]{3,32}$/;
export const MIN_PASSWORD = 8;
const MAX_PASSWORD = 200;

/** Hasło → „scrypt$N$r$p$sól$skrót” (do zapisania w bazie). */
export async function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = await scrypt(password.normalize('NFKC'), salt, KEY_LEN, PARAMS);
  return `scrypt$${PARAMS.N}$${PARAMS.r}$${PARAMS.p}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export async function verifyPassword(password, stored) {
  const parts = String(stored ?? '').split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, N, r, p, saltB64, hashB64] = parts;
  const expected = Buffer.from(hashB64, 'base64');
  const actual = await scrypt(String(password ?? '').normalize('NFKC'), Buffer.from(saltB64, 'base64'), expected.length, {
    N: Number(N), r: Number(r), p: Number(p),
  });
  return timingSafeEqual(actual, expected);
}

/** Skrót „na pusto” – logowanie na nieistniejący login trwa tyle samo co na istniejący. */
export const DUMMY_HASH = await hashPassword(randomBytes(16).toString('hex'));

export function validatePassword(password, repeat) {
  if (!password || password.length < MIN_PASSWORD) return `Hasło musi mieć co najmniej ${MIN_PASSWORD} znaków.`;
  if (password.length > MAX_PASSWORD) return 'Hasło jest za długie.';
  if (repeat !== undefined && password !== repeat) return 'Hasła nie są takie same.';
  return null;
}

export function validateUsername(username) {
  if (!USERNAME_RE.test(username ?? '')) return 'Login: 3–32 znaki, litery bez polskich znaków, cyfry, kropka, myślnik lub podkreślenie.';
  return null;
}

/** Losowe hasło do resetu z wiersza poleceń (bez łatwych do pomylenia znaków). */
export function randomPassword(length = 16) {
  const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(length);
  return [...bytes].map((b) => alphabet[b % alphabet.length]).join('');
}
