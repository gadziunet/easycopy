// Detecting signals that the server is rate limiting or blocking us (e.g. Cloudflare).
// EasyCopy does not try to bypass such protections – it slows down or stops.

import { msg } from '../shared/i18n.js';

/** Retry-After: number of seconds or an HTTP date → milliseconds (null when missing). */
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
 * Returns { type: 'rate' | 'challenge', status, retryAfterMs, message } or null.
 * bodySample – the start of the response (text), to detect a "Just a moment…" page.
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
