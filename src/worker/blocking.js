// Rozpoznawanie sygnałów, że serwer nas ogranicza albo blokuje (np. Cloudflare).
// EasyCopy nie próbuje obchodzić takich zabezpieczeń – zwalnia albo się zatrzymuje.

import { msg } from '../shared/i18n.js';

/** Retry-After: liczba sekund albo data HTTP → milisekundy (null, gdy brak). */
export function parseRetryAfter(value, now = Date.now()) {
  if (!value) return null;
  const v = value.trim();
  if (/^\d+$/.test(v)) return Number(v) * 1000;
  const t = Date.parse(v);
  if (Number.isNaN(t)) return null;
  return Math.max(0, t - now);
}

const CHALLENGE_MARKERS = [
  /<title>\s*just a moment\.{0,3}\s*<\/title>/i,
  /<title>\s*attention required!?\s*\|\s*cloudflare\s*<\/title>/i,
  /cdn-cgi\/challenge-platform/i,
  /cf-chl-(?:bypass|widget|opt)/i,
  /id="challenge-(?:form|running|stage)"/i,
];

/**
 * Zwraca { type: 'rate' | 'challenge', status, retryAfterMs, message } albo null.
 * bodySample – początek odpowiedzi (tekst), żeby rozpoznać stronę „Just a moment…”.
 */
export function detectBlock(status, headers, bodySample = '') {
  const get = (name) => (typeof headers.get === 'function' ? headers.get(name) : headers[name]);
  const retryAfterMs = parseRetryAfter(get('retry-after'));
  const mitigated = (get('cf-mitigated') || '').toLowerCase();

  if (mitigated) {
    return { type: 'challenge', status, retryAfterMs, message: msg('block.challengeCf', { kind: mitigated, status }) };
  }
  if (status === 429) {
    return { type: 'rate', status, retryAfterMs, message: msg('block.rate429') };
  }
  const looksLikeChallenge = bodySample && CHALLENGE_MARKERS.some((re) => re.test(bodySample));
  if (looksLikeChallenge && (status === 403 || status === 503 || status === 200)) {
    return { type: 'challenge', status, retryAfterMs, message: msg('block.challengePage', { status }) };
  }
  if (status === 503 && retryAfterMs != null) {
    return { type: 'rate', status, retryAfterMs, message: msg('block.unavailable503') };
  }
  return null;
}
