import { test } from 'node:test';
import assert from 'node:assert/strict';

import { describeNetworkError, networkErrorKind } from '../src/worker/net-error.js';
import { localize, translator } from '../src/shared/i18n.js';

/** Error shaped like the one fetch() throws: TypeError('fetch failed') with the reason in cause. */
function fetchError(cause) {
  return Object.assign(new TypeError('fetch failed'), { cause });
}

test('network error kinds are read from err.cause', () => {
  assert.equal(networkErrorKind(fetchError(Object.assign(new Error('getaddrinfo ENOTFOUND example.com'), { code: 'ENOTFOUND' }))), 'dns');
  assert.equal(networkErrorKind(fetchError(Object.assign(new Error('x'), { code: 'EAI_AGAIN' }))), 'dnsTemporary');
  assert.equal(networkErrorKind(fetchError(Object.assign(new Error('x'), { code: 'ECONNREFUSED' }))), 'refused');
  assert.equal(networkErrorKind(fetchError(Object.assign(new Error('x'), { code: 'UND_ERR_CONNECT_TIMEOUT' }))), 'timeout');
  assert.equal(networkErrorKind(fetchError(Object.assign(new Error('x'), { code: 'CERT_HAS_EXPIRED' }))), 'tls');
  // several addresses (IPv4 + IPv6) failed: AggregateError with the codes inside
  const aggregate = new AggregateError([Object.assign(new Error('a'), { code: 'EHOSTUNREACH' })], 'all failed');
  assert.equal(networkErrorKind(fetchError(aggregate)), 'unreachable');
  // AbortSignal.timeout()
  assert.equal(networkErrorKind(new DOMException('timed out', 'TimeoutError')), 'timeout');
  assert.equal(networkErrorKind(new Error('something else')), null);
});

test('network error descriptions are translated in both languages', () => {
  const dns = describeNetworkError(fetchError(Object.assign(new Error('x'), { code: 'ENOTFOUND' })));
  assert.equal(localize(translator('en'), dns), 'address not found – check DNS');
  assert.equal(localize(translator('pl'), dns), 'nie znaleziono adresu – sprawdź DNS');
  const tls = describeNetworkError(fetchError(Object.assign(new Error('x'), { code: 'CERT_HAS_EXPIRED' })));
  assert.equal(localize(translator('en'), tls), 'certificate error (CERT_HAS_EXPIRED)');
  // unknown errors keep the original message and add the code
  assert.equal(describeNetworkError(fetchError(Object.assign(new Error('x'), { code: 'EWEIRD' }))), 'fetch failed (EWEIRD)');
  assert.equal(describeNetworkError(new Error('plain error')), 'plain error');
});

test('a failed start page shows the reason in the job error', async () => {
  const { describeFailure } = await import('../src/panel/log-format.js');
  const error = describeNetworkError(fetchError(Object.assign(new Error('x'), { code: 'ENOTFOUND' })));
  assert.equal(localize(translator('pl'), describeFailure({ error })), 'brak połączenia (nie znaleziono adresu – sprawdź DNS)');
});

test('a real connection to a closed port is reported as refused', async () => {
  const { createServer } = await import('node:net');
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  await new Promise((resolve) => server.close(resolve));
  const err = await fetch(`http://127.0.0.1:${port}/`).then(() => null, (e) => e);
  assert.equal(networkErrorKind(err), 'refused');
});
