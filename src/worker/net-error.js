// Network errors in plain words: fetch() only says "fetch failed",
// the real reason (DNS, timeout, refused connection, certificate) is in err.cause.

import { msg } from '../shared/i18n.js';

const KINDS = {
  ENOTFOUND: 'dns',
  EAI_NONAME: 'dns',
  EAI_AGAIN: 'dnsTemporary',
  ETIMEDOUT: 'timeout',
  UND_ERR_CONNECT_TIMEOUT: 'timeout',
  UND_ERR_HEADERS_TIMEOUT: 'timeout',
  UND_ERR_BODY_TIMEOUT: 'timeout',
  ECONNREFUSED: 'refused',
  ECONNRESET: 'reset',
  UND_ERR_SOCKET: 'reset',
  EPIPE: 'reset',
  EHOSTUNREACH: 'unreachable',
  ENETUNREACH: 'unreachable',
};

/** Error code from the error or its cause (also from an AggregateError when several addresses failed). */
export function networkErrorCode(err) {
  for (let e = err, depth = 0; e && depth < 4; e = e.cause, depth++) {
    if (typeof e.code === 'string' && e.code !== 'ERR_ASSERTION') return e.code;
    const inner = Array.isArray(e.errors) ? e.errors.find((x) => typeof x?.code === 'string') : null;
    if (inner) return inner.code;
  }
  return null;
}

/** Error kind: 'dns' | 'dnsTemporary' | 'timeout' | 'refused' | 'reset' | 'unreachable' | 'tls' | null. */
export function networkErrorKind(err) {
  if (err?.name === 'TimeoutError') return 'timeout';
  const code = networkErrorCode(err);
  if (!code) return null;
  if (KINDS[code]) return KINDS[code];
  if (/CERT|SSL|TLS|SELF_SIGNED|UNABLE_TO_VERIFY|UNABLE_TO_GET_ISSUER/.test(code)) return 'tls';
  return null;
}

/** Description stored with msg() (translated when displayed); unknown errors keep the original message and code. */
export function describeNetworkError(err) {
  const kind = networkErrorKind(err);
  const code = networkErrorCode(err);
  if (kind === 'tls') return msg('netErrors.tls', { code });
  if (kind) return msg(`netErrors.${kind}`);
  const text = err?.message || String(err);
  return code && !text.includes(code) ? `${text} (${code})` : text;
}
