import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import zlib from 'node:zlib';
import { mkdtemp, mkdir, writeFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { createArchiveServer } from '../src/server/archive-server.js';
import { compareVersions } from '../src/server/archives.js';

let tmp;
let root;

async function put(rel, content) {
  const full = path.join(root, ...rel.split('/'));
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, content);
}

const manifest = (extra) =>
  JSON.stringify({
    app: 'EasyCopy',
    startUrl: 'https://www.example.com/',
    entry: 'index.html',
    createdAt: '2026-11-03T10:00:00.000Z',
    status: 'complete',
    stats: { pages: 2, bytes: 4096 },
    settings: { allowJavaScript: false },
    ...extra,
  });

before(async () => {
  tmp = await mkdtemp(path.join(tmpdir(), 'easycopy-srv-'));
  root = path.join(tmp, 'archiwa');
  await put('tajne.txt', 'SEKRET');
  await put('strona/2026-11-03/index.html', '<!doctype html><title>stara</title><a href="o-nas/index.html">O nas</a>');
  await put('strona/2026-11-03/o-nas/index.html', '<p>O nas</p>');
  await put('strona/2026-11-03/_brak.html', '<p>brak</p>');
  await put('strona/2026-11-03/style.css', `body{color:red}\n${'/* wypełniacz */\n'.repeat(200)}`);
  await put('strona/2026-11-03/film.mp4', Buffer.from([...Array(100).keys()]));
  await put('strona/2026-11-03/fonts/a.woff2', 'WOFF2');
  await mkdir(path.join(root, 'strona/2026-11-03/pusty'), { recursive: true });
  await put('strona/2026-11-03/manifest.json', manifest());
  await symlink('../../tajne.txt', path.join(root, 'strona/2026-11-03/link.txt'));
  await put('strona/2026-11-04/index.html', '<title>nowa</title>');
  await put('strona/2026-11-04/manifest.json', manifest({ createdAt: '2026-11-04T10:00:00.000Z', settings: { allowJavaScript: true } }));
  await put('druga/2026-10-01/index.html', '<title>druga</title>');
  await put('druga/2026-10-01/manifest.json', manifest({ startUrl: 'https://blog.example.org/', createdAt: '2026-10-01T10:00:00.000Z' }));
  await mkdir(path.join(root, 'bez-wersji'), { recursive: true });
});

after(async () => {
  await rm(tmp, { recursive: true, force: true });
});

/** Surowe żądanie HTTP – bez normalizacji ścieżki i bez dekompresji. */
function request(port, pathname, headers = {}, method = 'GET') {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path: pathname, method, headers }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    });
    req.on('error', reject);
    req.end();
  });
}

async function withServer(options, fn) {
  const server = createArchiveServer({ archiveRoot: root, ...options });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  try {
    await fn(server.address().port);
  } finally {
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
  }
}

test('kolejność wersji', () => {
  assert.deepEqual(['2026-11-04-10', '2026-11-04', '2026-11-03', '2026-11-04-2'].sort(compareVersions), [
    '2026-11-03', '2026-11-04', '2026-11-04-2', '2026-11-04-10',
  ]);
});

test('lista archiwów', async () => {
  await withServer({}, async (port) => {
    const r = await request(port, '/');
    assert.equal(r.status, 200);
    const html = r.body.toString();
    assert.ok(html.includes('href="/a/strona/"'));
    assert.ok(html.includes('href="/a/druga/"'));
    assert.ok(html.includes('www.example.com'));
    assert.ok(html.includes('href="/a/strona/2026-11-03/"'), 'starsza wersja na liście');
    assert.ok(!html.includes('bez-wersji'), 'katalog bez wersji pominięty');
    assert.ok(html.includes('2 archiwa'));
    assert.match(r.headers['content-security-policy'], /default-src 'none'/);
  });
});

test('/a/<nazwa> → przekierowanie z ukośnikiem, potem wersja z dowiązania latest', async () => {
  await withServer({}, async (port) => {
    // bez dowiązania latest wygrywa najnowszy katalog
    let r = await request(port, '/a/strona/');
    assert.equal(r.status, 200);
    assert.ok(r.body.toString().includes('nowa'));

    await symlink('2026-11-03', path.join(root, 'strona/latest'));
    r = await request(port, '/a/strona');
    assert.equal(r.status, 301);
    assert.equal(r.headers.location, '/a/strona/');
    r = await request(port, '/a/strona/');
    assert.ok(r.body.toString().includes('stara'), 'latest → 2026-11-03');
    r = await request(port, '/a/strona/o-nas');
    assert.equal(r.status, 301);
    r = await request(port, '/a/strona/o-nas/');
    assert.ok(r.body.toString().includes('O nas'));
  });
});

test('konkretna wersja i nagłówek sandbox zależny od manifestu', async () => {
  await withServer({}, async (port) => {
    const old = await request(port, '/a/strona/2026-11-03/');
    assert.equal(old.headers['content-security-policy'], 'sandbox allow-forms allow-popups allow-popups-to-escape-sandbox');
    assert.equal(old.headers['referrer-policy'], 'no-referrer');
    const withJs = await request(port, '/a/strona/2026-11-04/');
    assert.ok(withJs.body.toString().includes('nowa'));
    assert.match(withJs.headers['content-security-policy'], /allow-scripts/);
    const missing = await request(port, '/a/strona/2026-11-03/_brak.html');
    assert.match(missing.headers['content-security-policy'], /allow-scripts/, '_brak.html zawsze ze skryptami');
    assert.doesNotMatch(missing.headers['content-security-policy'], /allow-same-origin/);
  });
});

test('ochrona przed wyjściem poza katalog kopii', async () => {
  await withServer({}, async (port) => {
    for (const p of [
      '/a/strona/../tajne.txt',
      '/a/strona/2026-11-03/../../tajne.txt',
      '/a/strona/%2e%2e/%2e%2e/tajne.txt',
      '/a/strona/2026-11-03/..%2f..%2ftajne.txt',
      '/a/strona/2026-11-03/%5c..%5ctajne.txt',
      '/a/..%2ftajne.txt',
      '/a/strona/2026-11-03/link.txt',
      '/a/strona/2026-11-03/%00',
    ]) {
      const r = await request(port, p);
      assert.ok([400, 404].includes(r.status), `${p} → ${r.status}`);
      assert.ok(!r.body.toString().includes('SEKRET'), `${p} nie ujawnia pliku`);
    }
  });
});

test('brak listowania katalogów i nieznane adresy', async () => {
  await withServer({}, async (port) => {
    assert.equal((await request(port, '/a/strona/2026-11-03/pusty/')).status, 404);
    assert.equal((await request(port, '/a/nie-ma/')).status, 404);
    assert.equal((await request(port, '/a/bez-wersji/')).status, 404);
    assert.equal((await request(port, '/inne')).status, 404);
    assert.equal((await request(port, '/a/strona/', {}, 'POST')).status, 405);
    assert.equal((await request(port, '/healthz')).body.toString(), 'ok');
  });
});

test('Range (przewijanie wideo), HEAD, ETag i kompresja', async () => {
  await withServer({}, async (port) => {
    const part = await request(port, '/a/strona/2026-11-03/film.mp4', { range: 'bytes=10-19' });
    assert.equal(part.status, 206);
    assert.equal(part.headers['content-range'], 'bytes 10-19/100');
    assert.deepEqual([...part.body], [10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);
    assert.equal(part.headers['content-type'], 'video/mp4');
    const tail = await request(port, '/a/strona/2026-11-03/film.mp4', { range: 'bytes=-5' });
    assert.deepEqual([...tail.body], [95, 96, 97, 98, 99]);
    assert.equal((await request(port, '/a/strona/2026-11-03/film.mp4', { range: 'bytes=500-' })).status, 416);

    const head = await request(port, '/a/strona/2026-11-03/film.mp4', {}, 'HEAD');
    assert.equal(head.status, 200);
    assert.equal(head.headers['content-length'], '100');
    assert.equal(head.body.length, 0);

    const first = await request(port, '/a/strona/2026-11-03/style.css');
    const again = await request(port, '/a/strona/2026-11-03/style.css', { 'if-none-match': first.headers.etag });
    assert.equal(again.status, 304);

    const gz = await request(port, '/a/strona/2026-11-03/style.css', { 'accept-encoding': 'gzip' });
    assert.equal(gz.headers['content-encoding'], 'gzip');
    assert.ok(zlib.gunzipSync(gz.body).toString().startsWith('body{color:red}'));
    const br = await request(port, '/a/strona/2026-11-03/style.css', { 'accept-encoding': 'gzip, br' });
    assert.equal(br.headers['content-encoding'], 'br');
    assert.ok(zlib.brotliDecompressSync(br.body).toString().startsWith('body{color:red}'));
  });
});

test('hasło (Basic Auth) i czcionki z sandboxu', async () => {
  await withServer({ password: 'tajne-haslo' }, async (port) => {
    assert.equal((await request(port, '/')).status, 401);
    assert.match((await request(port, '/')).headers['www-authenticate'], /Basic/);
    const bad = `Basic ${Buffer.from('ktos:zle').toString('base64')}`;
    assert.equal((await request(port, '/', { authorization: bad })).status, 401);
    const good = `Basic ${Buffer.from('ktos:tajne-haslo').toString('base64')}`;
    assert.equal((await request(port, '/', { authorization: good })).status, 200);
    assert.equal((await request(port, '/a/strona/2026-11-03/', { authorization: good })).status, 200);
    // czcionka z dokumentu w sandboxie (Origin: null) – bez hasła, z CORS
    const font = await request(port, '/a/strona/2026-11-03/fonts/a.woff2', { origin: 'null' });
    assert.equal(font.status, 200);
    assert.equal(font.headers['access-control-allow-origin'], 'null');
    // inne pliki z Origin: null nadal wymagają hasła
    assert.equal((await request(port, '/a/strona/2026-11-03/style.css', { origin: 'null' })).status, 401);
    assert.equal((await request(port, '/healthz')).status, 200, 'healthcheck bez hasła');
  });
});
