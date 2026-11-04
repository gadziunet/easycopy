// Lokalna strona testowa. Ten sam serwer odpowiada jako dwa hosty:
//   http://localhost:PORT   – archiwizowana witryna
//   http://127.0.0.1:PORT   – „zewnętrzny CDN”

import http from 'node:http';

const html = (body, head = '') =>
  `<!doctype html><html lang="pl"><head><meta charset="utf-8"><title>Test</title>${head}</head><body>${body}</body></html>`;

function iso88592(text) {
  // minimalne kodowanie ISO-8859-2 dla polskich znaków użytych w teście
  const map = { ą: 0xb1, ć: 0xe6, ę: 0xea, ł: 0xb3, ń: 0xf1, ó: 0xf3, ś: 0xb6, ź: 0xbc, ż: 0xbf, Ż: 0xaf };
  return Buffer.from([...text].map((ch) => map[ch] ?? ch.charCodeAt(0)));
}

export function startTestSite({ blockMode = null } = {}) {
  let port;
  const hits = new Map();

  const routes = (cdn) => ({
    '/': () => ({
      type: 'text/html; charset=utf-8',
      body: html(
        `
<a href="/o-nas">O nas</a>
<a href="blog/">Blog</a>
<a href="https://external.example.org/x">Zewnętrzny</a>
<a href="/plik.pdf">PDF</a>
<a href="#top">Do góry</a>
<a href="mailto:kontakt@example.com">Mail</a>
<a href="/strona?page=2&amp;sort=asc">Strona 2</a>
<a href="/wylaczone/tajne">Wykluczone</a>
<a href="/prywatne/">Prywatne</a>
<a href="/brak-strony">404</a>
<a href="/film.mp4">Film</a>
<img src="img/logo.png" srcset="img/logo.png 1x, img/logo@2x.png 2x" alt="">
<img data-src="/img/lazy.jpg" src="data:image/gif;base64,R0lGOD" alt="">
<div style="background-image: url('/img/bg.jpg')"></div>
<script src="${cdn}/lib.js" integrity="sha384-abc" crossorigin="anonymous"></script>
<p>Zażółć gęślą jaźń</p>
`,
        `<link rel="stylesheet" href="/css/style.css?ver=1.2" integrity="sha384-xyz">
<link rel="canonical" href="/">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'">
<style>.hero{background:url("/img/hero.jpg")}</style>`,
      ),
    }),
    '/o-nas': () => ({ type: 'text/html', body: html('<a href="/o-nas/zespol">Zespół</a><a href="/">Start</a>') }),
    '/o-nas/zespol': () => ({ type: 'text/html', body: html('<a href="jan">Jan</a>') }),
    '/o-nas/jan': () => ({ type: 'text/html', body: html('<a href="/gleboko">Głęboko</a>') }),
    '/gleboko': () => ({ type: 'text/html', body: html('Za głęboko') }),
    '/blog/': () => ({
      type: 'text/html; charset=iso-8859-2',
      body: Buffer.concat([
        Buffer.from('<!doctype html><html><head><meta http-equiv="Content-Type" content="text/html; charset=iso-8859-2"><title>Blog</title></head><body><p>'),
        iso88592('Zażółć gęślą jaźń'),
        Buffer.from('</p><a href="../o-nas">O nas</a></body></html>'),
      ]),
    }),
    '/strona': () => ({ type: 'text/html', body: html('Druga strona') }),
    '/wylaczone/tajne': () => ({ type: 'text/html', body: html('Nie powinno być pobrane') }),
    '/prywatne/': () => ({ type: 'text/html', body: html('Zablokowane przez robots') }),
    '/plik.pdf': () => ({ type: 'application/pdf', body: Buffer.from('%PDF-1.4 test') }),
    '/css/style.css': () => ({
      type: 'text/css',
      body: '@charset "utf-8";\n@import url("fonts.css");\nbody{background:url(../img/bg.jpg)}\n.x{background:url(data:image/png;base64,AAAA)}',
    }),
    '/css/fonts.css': () => ({ type: 'text/css', body: "@font-face{font-family:A;src:url('/fonts/a.woff2') format('woff2')}" }),
    '/img/logo.png': () => ({ type: 'image/png', body: Buffer.from('PNG1') }),
    '/img/logo@2x.png': () => ({ type: 'image/png', body: Buffer.from('PNG2') }),
    '/img/lazy.jpg': () => ({ type: 'image/jpeg', body: Buffer.from('JPG-lazy') }),
    '/img/bg.jpg': () => ({ type: 'image/jpeg', body: Buffer.from('JPG-bg') }),
    '/img/hero.jpg': () => ({ type: 'image/jpeg', body: Buffer.from('JPG-hero') }),
    '/fonts/a.woff2': () => ({ type: 'font/woff2', body: Buffer.from('WOFF2') }),
    '/robots.txt': () => ({ type: 'text/plain', body: 'User-agent: *\nDisallow: /prywatne/\n' }),
  });

  const cdnRoutes = {
    '/lib.js': () => ({ type: 'text/javascript', body: 'console.log("lib")' }),
  };

  const server = http.createServer((req, res) => {
    const u = new URL(req.url, `http://${req.headers.host}`);
    const key = `${u.hostname}${u.pathname}${u.search}`;
    hits.set(key, (hits.get(key) ?? 0) + 1);

    if (blockMode && u.hostname === 'localhost' && u.pathname !== '/robots.txt') {
      if (blockMode === 'rate-always' || (blockMode === 'rate-once' && hits.get(key) === 1)) {
        res.writeHead(429, { 'content-type': 'text/plain', 'retry-after': '0' });
        return res.end('Too Many Requests');
      }
      if (blockMode === 'challenge') {
        res.writeHead(403, { 'content-type': 'text/html', 'cf-mitigated': 'challenge', server: 'cloudflare' });
        return res.end('<html><head><title>Just a moment...</title></head><body></body></html>');
      }
    }

    const cdn = `http://127.0.0.1:${port}`;
    const table = u.hostname === '127.0.0.1' ? cdnRoutes : routes(cdn);
    const handler = table[u.pathname];
    if (!handler) {
      res.writeHead(404, { 'content-type': 'text/html' });
      return res.end('<h1>404</h1>');
    }
    const { type, body } = handler();
    res.writeHead(200, { 'content-type': type });
    res.end(body);
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      port = server.address().port;
      resolve({
        url: `http://localhost:${port}/`,
        cdn: `http://127.0.0.1:${port}`,
        port,
        hits,
        close: () => new Promise((r) => server.close(r)),
      });
    });
  });
}
