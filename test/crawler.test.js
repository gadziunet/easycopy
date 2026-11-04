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

test('pełna kopia strony testowej', async () => {
  const site = await startTestSite();
  try {
    const r = await crawl(site, 'full', { maxDepth: 3, exclude: ['/wylaczone/*'], skipExtensions: ['mp4'] });
    assert.equal(r.manifest.status, 'complete');

    const index = await r.read('index.html');
    // strony
    assert.ok(index.includes('href="o-nas/index.html"'), 'link do /o-nas');
    assert.ok(index.includes('href="blog/index.html"'), 'link do blog/');
    assert.ok(index.includes('href="strona/index_page-2_sort-asc.html"'), 'parametry zapytania');
    assert.ok(index.includes('href="#top"'), 'kotwica bez zmian');
    assert.ok(index.includes('href="mailto:kontakt@example.com"'), 'mailto bez zmian');
    assert.ok(index.includes('href="https://external.example.org/x"'), 'zewnętrzny link do oryginału');
    // niepobrane strony z witryny → _brak.html
    assert.match(index, /href="_brak\.html#u=[^"]*wylaczone[^"]*&amp;r=wykluczone"/);
    assert.match(index, /href="_brak\.html#u=[^"]*film\.mp4[^"]*&amp;r=typ"/);
    // zasoby
    assert.ok(index.includes('href="css/style_ver-1.2.css"'), 'arkusz CSS');
    assert.ok(index.includes(`src="_ext/127.0.0.1_${site.port}/lib.js"`), 'skrypt z „CDN”');
    assert.ok(!index.includes('integrity'), 'integrity usunięte');
    assert.ok(index.includes('srcset="img/logo.png 1x, img/logo@2x.png 2x"'));
    assert.ok(index.includes('data-src="img/lazy.jpg"'));
    assert.ok(index.includes('url(&quot;img/bg.jpg&quot;)'));
    assert.ok(index.includes('url("img/hero.jpg")'));
    assert.ok(index.includes('Zażółć gęślą jaźń'));

    // CSS przepisany względem swojego położenia
    const css = await r.read('css/style_ver-1.2.css');
    assert.ok(css.includes('@import url("fonts.css")'));
    assert.ok(css.includes('url("../img/bg.jpg")'));
    assert.ok(css.includes('url(data:image/png;base64,AAAA)'));
    const fonts = await r.read('css/fonts.css');
    assert.ok(fonts.includes('url("../fonts/a.woff2")'));
    assert.ok(r.has('fonts/a.woff2'));
    assert.ok(r.has('img/logo@2x.png'));
    assert.ok(r.has(`_ext/127.0.0.1_${site.port}/lib.js`));

    // kodowanie ISO-8859-2 → UTF-8
    const blog = await r.read('blog/index.html');
    assert.ok(blog.includes('Zażółć gęślą jaźń'), 'polskie znaki po konwersji');
    assert.ok(blog.includes('charset=utf-8'));
    assert.ok(blog.includes('href="../o-nas/index.html"'));

    // głębokość: /gleboko jest na poziomie 4
    const jan = await r.read('o-nas/jan/index.html');
    assert.match(jan, /href="\.\.\/\.\.\/_brak\.html#u=[^"]*gleboko[^"]*&amp;r=glebokosc"/);
    assert.ok(!r.has('gleboko/index.html'));

    // robots.txt i 404 → strony-przekierowania do _brak.html
    const priv = await r.read('prywatne/index.html');
    assert.match(priv, /_brak\.html#u=.*&amp;r=robots/);
    const missing = await r.read('brak-strony/index.html');
    assert.match(missing, /_brak\.html#u=.*&amp;r=blad/);

    // PDF pod linkiem
    assert.equal(await r.read('plik.pdf'), '%PDF-1.4 test');

    // pliki pomocnicze
    assert.ok((await r.read('_brak.html')).includes('Ta strona nie została zarchiwizowana'));
    const m = JSON.parse(await r.read('manifest.json'));
    assert.equal(m.entry, 'index.html');
    assert.equal(m.notDownloaded[`${site.url}gleboko`], 'glebokosc');
    assert.ok(m.stats.pages >= 6);

    // /wylaczone nie było w ogóle pobierane
    assert.ok(!site.hits.has('localhost/wylaczone/tajne'));
    assert.ok(!site.hits.has('localhost/prywatne/'));
  } finally {
    await site.close();
  }
});

test('limit stron: reszta trafia do _brak.html z powodem „limit”', async () => {
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

test('jednorazowe 429: zwalnia, ponawia i kończy kopię', async () => {
  const site = await startTestSite({ blockMode: 'rate-once' });
  try {
    const r = await crawl(site, 'rate-once', { maxDepth: 1, maxBlocks: 3 });
    assert.equal(r.manifest.status, 'complete');
    assert.ok(r.has('index.html'));
    assert.equal(site.hits.get('localhost/'), 2, 'strona startowa pobrana ponownie po 429');
  } finally {
    await site.close();
  }
});

test('ciągłe 429: po 3 blokadach pobieranie zostaje wstrzymane', async () => {
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

test('strona weryfikacji Cloudflare: natychmiastowa pauza, bez prób obejścia', async () => {
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

test('archiveSite: katalog z datą i dowiązanie latest', async () => {
  const site = await startTestSite();
  try {
    const root = path.join(tmp, 'archiwa');
    const a = await archiveSite({ archiveRoot: root, name: 'Strona testowa', startUrl: site.url, maxDepth: 0, ...fast });
    const b = await archiveSite({ archiveRoot: root, name: 'Strona testowa', startUrl: site.url, maxDepth: 0, ...fast });
    assert.equal(a.name, 'strona-testowa');
    assert.match(a.version, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(b.version, `${a.version}-2`);
    assert.equal(await readlink(path.join(root, 'strona-testowa', 'latest')), b.version);
    // przy głębokości 0 wszystkie linki do podstron prowadzą do _brak.html
    const index = await readFile(path.join(b.dir, 'index.html'), 'utf8');
    assert.match(index, /href="_brak\.html#u=[^"]*o-nas&amp;r=glebokosc"/);
  } finally {
    await site.close();
  }
});
