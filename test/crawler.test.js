import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, readlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { Crawler } from '../src/worker/crawler.js';
import { archiveSite } from '../src/worker/archive.js';
import { startTestSite } from './helpers/test-site.js';

let tmp;
before(async () => {
  tmp = await mkdtemp(path.join(tmpdir(), 'easycopy-test-'));
});
after(async () => {
  await rm(tmp, { recursive: true, force: true });
});

const fast = { rps: 1000, concurrency: 4, retryDelayMs: 10, blockBaseDelayMs: 10, slowDownIntervalMs: 10, timeoutMs: 5000 };

async function crawl(site, dirName, options = {}) {
  const outDir = path.join(tmp, dirName);
  const crawler = new Crawler({ startUrl: site.url, outDir, ...fast, ...options });
  const manifest = await crawler.run();
  const read = (p) => readFile(path.join(outDir, p), 'utf8');
  return { outDir, manifest, read, has: (p) => existsSync(path.join(outDir, p)) };
}

test('full copy of the test site', async () => {
  const site = await startTestSite();
  try {
    const r = await crawl(site, 'full', { maxDepth: 3, exclude: ['/wylaczone/*'], skipExtensions: ['mp4'] });
    assert.equal(r.manifest.status, 'complete');

    const index = await r.read('index.html');
    // pages
    assert.ok(index.includes('href="o-nas/index.html"'), 'link to /o-nas');
    assert.ok(index.includes('href="blog/index.html"'), 'link to blog/');
    assert.ok(index.includes('href="strona/index_page-2_sort-asc.html"'), 'parametry zapytania');
    assert.ok(index.includes('href="#top"'), 'anchor unchanged');
    assert.ok(index.includes('href="mailto:kontakt@example.com"'), 'mailto unchanged');
    assert.ok(index.includes('href="https://external.example.org/x"'), 'external link to the original');
    // subpages of the site that were not downloaded → _brak.html
    assert.match(index, /href="_brak\.html#u=[^"]*wylaczone[^"]*&amp;r=wykluczone"/);
    assert.match(index, /href="_brak\.html#u=[^"]*film\.mp4[^"]*&amp;r=typ"/);
    // resources
    assert.ok(index.includes('href="css/style_ver-1.2.css"'), 'arkusz CSS');
    assert.ok(index.includes(`src="_ext/127.0.0.1_${site.port}/lib.js"`), 'script from the "CDN"');
    assert.ok(!index.includes('integrity'), 'integrity removed');
    assert.ok(index.includes('srcset="img/logo.png 1x, img/logo@2x.png 2x"'));
    assert.ok(index.includes('data-src="img/lazy.jpg"'));
    assert.ok(index.includes('url(&quot;img/bg.jpg&quot;)'));
    assert.ok(index.includes('url("img/hero.jpg")'));
    assert.ok(index.includes('Zażółć gęślą jaźń'));

    // CSS rewritten relative to its own location
    const css = await r.read('css/style_ver-1.2.css');
    assert.ok(css.includes('@import url("fonts.css")'));
    assert.ok(css.includes('url("../img/bg.jpg")'));
    assert.ok(css.includes('url(data:image/png;base64,AAAA)'));
    const fonts = await r.read('css/fonts.css');
    assert.ok(fonts.includes('url("../fonts/a.woff2")'));
    assert.ok(r.has('fonts/a.woff2'));
    assert.ok(r.has('img/logo@2x.png'));
    assert.ok(r.has(`_ext/127.0.0.1_${site.port}/lib.js`));

    // ISO-8859-2 encoding → UTF-8
    const blog = await r.read('blog/index.html');
    assert.ok(blog.includes('Zażółć gęślą jaźń'), 'Polish characters after conversion');
    assert.ok(blog.includes('charset=utf-8'));
    assert.ok(blog.includes('href="../o-nas/index.html"'));

    // depth: /gleboko is at level 4
    const jan = await r.read('o-nas/jan/index.html');
    assert.match(jan, /href="\.\.\/\.\.\/_brak\.html#u=[^"]*gleboko[^"]*&amp;r=glebokosc"/);
    assert.ok(!r.has('gleboko/index.html'));

    // robots.txt and 404 → redirect pages to _brak.html
    const priv = await r.read('prywatne/index.html');
    assert.match(priv, /_brak\.html#u=.*&amp;r=robots/);
    const missing = await r.read('brak-strony/index.html');
    assert.match(missing, /_brak\.html#u=.*&amp;r=blad/);

    // PDF behind a link
    assert.equal(await r.read('plik.pdf'), '%PDF-1.4 test');

    // helper files
    assert.ok((await r.read('_brak.html')).includes('Ta strona nie została zarchiwizowana'));
    const m = JSON.parse(await r.read('manifest.json'));
    assert.equal(m.entry, 'index.html');
    assert.equal(m.notDownloaded[`${site.url}gleboko`], 'glebokosc');
    assert.ok(m.stats.pages >= 6);

    // /wylaczone was not downloaded at all
    assert.ok(!site.hits.has('localhost/wylaczone/tajne'));
    assert.ok(!site.hits.has('localhost/prywatne/'));
  } finally {
    await site.close();
  }
});

test('page limit: the rest goes to _brak.html with the reason "limit"', async () => {
  const site = await startTestSite();
  try {
    const r = await crawl(site, 'limit', { maxPages: 2, concurrency: 1 });
    assert.equal(r.manifest.status, 'limit');
    assert.equal(r.manifest.stats.pages, 2);
    const limited = r.manifest.files.filter((f) => f.reason === 'limit');
    assert.ok(limited.length > 0);
    const stub = await r.read(limited.find((f) => f.kind === 'page').path);
    assert.match(stub, /r=limit/);
  } finally {
    await site.close();
  }
});

test('a single 429: slows down, retries and finishes the copy', async () => {
  const site = await startTestSite({ blockMode: 'rate-once' });
  try {
    const r = await crawl(site, 'rate-once', { maxDepth: 1, maxBlocks: 3 });
    assert.equal(r.manifest.status, 'complete');
    assert.ok(r.has('index.html'));
    assert.equal(site.hits.get('localhost/'), 2, 'start page downloaded again after 429');
  } finally {
    await site.close();
  }
});

test('repeated 429: downloading is paused after 3 blocks', async () => {
  const site = await startTestSite({ blockMode: 'rate-always' });
  try {
    const r = await crawl(site, 'rate-always', { maxBlocks: 3, concurrency: 1 });
    assert.equal(r.manifest.status, 'paused');
    assert.equal(r.manifest.pause.type, 'rate');
    assert.equal(site.hits.get('localhost/'), 3);
  } finally {
    await site.close();
  }
});

test('Cloudflare verification page: immediate pause, no bypass attempts', async () => {
  const site = await startTestSite({ blockMode: 'challenge' });
  try {
    const r = await crawl(site, 'challenge', {});
    assert.equal(r.manifest.status, 'paused');
    assert.equal(r.manifest.pause.type, 'challenge');
    assert.equal(site.hits.get('localhost/'), 1);
  } finally {
    await site.close();
  }
});

test('archiveSite: dated directory and the latest symlink', async () => {
  const site = await startTestSite();
  try {
    const root = path.join(tmp, 'archiwa');
    const a = await archiveSite({ archiveRoot: root, name: 'Strona testowa', startUrl: site.url, maxDepth: 0, ...fast });
    const b = await archiveSite({ archiveRoot: root, name: 'Strona testowa', startUrl: site.url, maxDepth: 0, ...fast });
    assert.equal(a.name, 'strona-testowa');
    assert.match(a.version, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(b.version, `${a.version}-2`);
    assert.equal(await readlink(path.join(root, 'strona-testowa', 'latest')), b.version);
    // with depth 0 all links to subpages lead to _brak.html
    const index = await readFile(path.join(b.dir, 'index.html'), 'utf8');
    assert.match(index, /href="_brak\.html#u=[^"]*o-nas&amp;r=glebokosc"/);
  } finally {
    await site.close();
  }
});
