// Serwer archiwów: serwuje kopie z folderu pod /a/<nazwa>/ (najnowsza) i /a/<nazwa>/<wersja>/.
// Działa na osobnym porcie niż panel, więc dla przeglądarki to inne źródło (origin),
// a dodatkowo każda kopia dostaje nagłówek CSP „sandbox” – nie widzi sesji panelu.

import http from 'node:http';
import { createReadStream } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import { createHash, timingSafeEqual } from 'node:crypto';

import { NAME_RE, VERSION_RE, latestVersion, listArchives, readManifest } from './archives.js';
import { listPageHtml, escapeHtml } from './list-page.js';
import { languageFromHeader, normalizeLanguage, translator } from '../shared/i18n.js';
import { parseCookies } from '../shared/cookies.js';
import { isCompressible, isFont, mimeType } from './mime.js';

const MISSING_PAGE = '_brak.html';

// Kopie: bez dostępu do źródła (brak allow-same-origin), linki mogą otwierać nowe karty.
const SANDBOX_BASE = 'sandbox allow-forms allow-popups allow-popups-to-escape-sandbox';
const SANDBOX_JS = `${SANDBOX_BASE} allow-scripts`;
// Strony samego serwera (lista archiwów, błędy): bez skryptów, bez osadzania w ramkach.
const SERVER_CSP = "default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'none'";

function sha256(text) {
  return createHash('sha256').update(String(text)).digest();
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, {
    'content-type': 'text/html; charset=utf-8',
    'content-security-policy': SERVER_CSP,
    'x-content-type-options': 'nosniff',
    'cache-control': 'no-store',
    ...headers,
  });
  res.end(res.req.method === 'HEAD' ? undefined : body);
}

function errorPage(res, status, key, textKey = key) {
  const t = res.req.t;
  const title = t(`archiveServer.${key}Title`);
  const text = t(`archiveServer.${textKey}Text`);
  send(
    res,
    status,
    `<!doctype html><html lang="${t.lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(title)}</title>
<style>:root{color-scheme:light dark}body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;font:16px/1.5 system-ui,sans-serif}main{max-width:520px}h1{font-size:22px;margin:0 0 8px}a{color:inherit}</style></head>
<body><main><h1>${escapeHtml(title)}</h1><p>${escapeHtml(text)}</p><p><a href="/">${escapeHtml(t('archiveServer.backToList'))}</a></p></main></body></html>`,
  );
}

/** Rozbija ścieżkę na bezpieczne segmenty albo zwraca null (próba wyjścia poza katalog itp.). */
function safeSegments(rest) {
  const segments = [];
  for (const raw of rest.split('/')) {
    if (raw === '') continue;
    let seg;
    try {
      seg = decodeURIComponent(raw);
    } catch {
      return null;
    }
    if (seg === '.' || seg === '..' || /[\\/\0]/.test(seg)) return null;
    segments.push(seg);
  }
  return segments;
}

/** Zakres z nagłówka Range (tylko pojedynczy zakres bajtów). */
function parseRange(header, size) {
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m || (m[1] === '' && m[2] === '')) return 'invalid';
  let start;
  let end;
  if (m[1] === '') {
    start = Math.max(0, size - Number(m[2]));
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1);
  }
  if (start > end || start >= size) return 'invalid';
  return { start, end };
}

function pickEncoding(acceptEncoding = '') {
  const ae = acceptEncoding.toLowerCase();
  if (/\bbr\b/.test(ae)) return 'br';
  if (/\bgzip\b/.test(ae)) return 'gzip';
  return null;
}

/**
 * Tworzy funkcję obsługi żądań (można ją podpiąć pod własny serwer HTTP).
 * options: archiveRoot (wymagane), password (opcjonalne, Basic Auth), log (funkcja)
 */
export function createArchiveHandler({ archiveRoot, password = null, log = () => {}, defaultLanguage = null }) {
  const root = path.resolve(archiveRoot);
  const fixedDefault = normalizeLanguage(defaultLanguage);
  // the panel's language cookie works here too (cookies don't depend on the port)
  const languageOf = (req) =>
    normalizeLanguage(parseCookies(req.headers.cookie).ec_lang) ?? fixedDefault ?? languageFromHeader(req.headers['accept-language']);
  const passwordHash = password ? sha256(password) : null;

  const authorized = (req) => {
    if (!passwordHash) return true;
    const m = /^Basic\s+(.+)$/i.exec(req.headers.authorization || '');
    if (!m) return false;
    const decoded = Buffer.from(m[1], 'base64').toString('utf8');
    const pass = decoded.slice(decoded.indexOf(':') + 1);
    return timingSafeEqual(sha256(pass), passwordHash);
  };

  async function serveFile(req, res, filePath, st, extraHeaders) {
    const type = mimeType(filePath);
    const etag = `W/"${st.size.toString(16)}-${Math.floor(st.mtimeMs).toString(16)}"`;
    const headers = {
      'content-type': type,
      etag,
      'last-modified': st.mtime.toUTCString(),
      'cache-control': 'no-cache',
      'accept-ranges': 'bytes',
      'x-content-type-options': 'nosniff',
      ...extraHeaders,
    };

    if (req.headers['if-none-match'] === etag) {
      res.writeHead(304, headers);
      return res.end();
    }

    const rangeHeader = req.headers.range;
    if (rangeHeader) {
      const range = parseRange(rangeHeader, st.size);
      if (range === 'invalid') {
        res.writeHead(416, { ...headers, 'content-range': `bytes */${st.size}` });
        return res.end();
      }
      res.writeHead(206, {
        ...headers,
        'content-range': `bytes ${range.start}-${range.end}/${st.size}`,
        'content-length': range.end - range.start + 1,
      });
      if (req.method === 'HEAD') return res.end();
      return createReadStream(filePath, range).pipe(res);
    }

    const encoding = isCompressible(type) && st.size > 1024 ? pickEncoding(req.headers['accept-encoding']) : null;
    if (encoding) {
      res.writeHead(200, { ...headers, 'content-encoding': encoding, vary: 'Accept-Encoding' });
      if (req.method === 'HEAD') return res.end();
      const compressor = encoding === 'br'
        ? zlib.createBrotliCompress({ params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 5 } })
        : zlib.createGzip({ level: 6 });
      return createReadStream(filePath).pipe(compressor).pipe(res);
    }

    res.writeHead(200, { ...headers, 'content-length': st.size, ...(isCompressible(type) ? { vary: 'Accept-Encoding' } : {}) });
    if (req.method === 'HEAD') return res.end();
    return createReadStream(filePath).pipe(res);
  }

  async function serveArchive(req, res, url) {
    // /a/<nazwa>[/<wersja>]/<ścieżka>
    const segments = safeSegments(url.pathname.slice('/a/'.length));
    if (!segments) return errorPage(res, 400, 'invalid');
    const [name, maybeVersion, ...restAfterVersion] = segments;
    if (!name || !NAME_RE.test(name)) return errorPage(res, 404, 'noArchive');

    let version;
    let rest;
    if (maybeVersion && VERSION_RE.test(maybeVersion)) {
      version = maybeVersion;
      rest = restAfterVersion;
    } else {
      version = await latestVersion(root, name);
      rest = segments.slice(1);
    }
    if (!version) return errorPage(res, 404, 'noArchive');

    let versionDir;
    try {
      versionDir = await realpath(path.join(root, name, version));
    } catch {
      return errorPage(res, 404, 'noVersion');
    }

    let filePath = path.join(versionDir, ...rest);
    let st;
    try {
      st = await stat(filePath);
    } catch {
      return errorPage(res, 404, 'noFile');
    }
    if (st.isDirectory()) {
      if (!url.pathname.endsWith('/')) {
        // linki względne w kopii wymagają ukośnika na końcu
        res.writeHead(301, { location: `${url.pathname}/${url.search}` });
        return res.end();
      }
      filePath = path.join(filePath, 'index.html');
      try {
        st = await stat(filePath);
      } catch {
        return errorPage(res, 404, 'noPage');
      }
    }
    if (!st.isFile()) return errorPage(res, 404, 'noFile');

    // ostatnia linia obrony: po rozwinięciu dowiązań plik musi leżeć w katalogu wersji
    const real = await realpath(filePath).catch(() => null);
    if (!real || !real.startsWith(versionDir + path.sep)) {
      return errorPage(res, 404, 'noFile');
    }

    const manifest = await readManifest(root, name, version);
    const isMissingPage = rest.length === 1 && rest[0] === MISSING_PAGE;
    const allowJs = isMissingPage || manifest?.settings?.allowJavaScript === true;
    const headers = {
      'content-security-policy': allowJs ? SANDBOX_JS : SANDBOX_BASE,
      'referrer-policy': 'no-referrer',
    };
    // dokument w sandboxie ma „puste” źródło (Origin: null) – czcionki wymagają wtedy CORS
    if (req.headers.origin === 'null') headers['access-control-allow-origin'] = 'null';

    return serveFile(req, res, real, st, headers);
  }

  return async function handler(req, res) {
    req.t = translator(languageOf(req));
    const started = Date.now();
    res.on('finish', () => log(`${req.method} ${req.url} ${res.statusCode} ${Date.now() - started} ms`));
    try {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        return send(res, 405, 'Method Not Allowed', { allow: 'GET, HEAD', 'content-type': 'text/plain; charset=utf-8' });
      }
      const url = new URL(req.url, 'http://localhost');

      if (url.pathname === '/healthz') return send(res, 200, 'ok', { 'content-type': 'text/plain; charset=utf-8' });
      if (url.pathname === '/favicon.ico') {
        res.writeHead(204);
        return res.end();
      }

      // czcionki pobierane z kopii w sandboxie idą bez danych logowania – przepuszczamy je bez hasła
      const fontFromSandbox = req.headers.origin === 'null' && isFont(url.pathname);
      if (!fontFromSandbox && !authorized(req)) {
        return send(res, 401, req.t('archiveServer.loginRequired'), {
          'www-authenticate': 'Basic realm="EasyCopy", charset="UTF-8"',
          'content-type': 'text/plain; charset=utf-8',
        });
      }

      if (url.pathname === '/') return send(res, 200, listPageHtml(req.t, await listArchives(root)));
      if (url.pathname === '/a' || url.pathname === '/a/') {
        res.writeHead(302, { location: '/' });
        return res.end();
      }
      if (url.pathname.startsWith('/a/')) return await serveArchive(req, res, url);
      return errorPage(res, 404, 'noPage', 'noArchive');
    } catch (err) {
      log(`Error: ${err.stack || err.message}`);
      if (!res.headersSent) return errorPage(res, 500, 'serverError');
      res.destroy();
    }
  };
}

/** Tworzy serwer HTTP archiwów (jeszcze nie nasłuchuje – wywołaj .listen()). */
export function createArchiveServer(options) {
  const server = http.createServer(createArchiveHandler(options));
  server.keepAliveTimeout = 5_000;
  return server;
}
