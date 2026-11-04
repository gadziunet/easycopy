import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createSite, isInScope, relativeLink, urlToLocalPath } from '../src/shared/url-map.js';

const site = createSite('https://www.example.com/');

test('strony zapisują się jako index.html w katalogach', () => {
  assert.equal(urlToLocalPath('https://example.com/', 'page', site), 'index.html');
  assert.equal(urlToLocalPath('https://www.example.com/o-nas/', 'page', site), 'o-nas/index.html');
  assert.equal(urlToLocalPath('https://www.example.com/o-nas', 'page', site), 'o-nas/index.html');
  assert.equal(urlToLocalPath('https://www.example.com/kontakt.php', 'page', site), 'kontakt.html');
  assert.equal(urlToLocalPath('https://www.example.com/o-nas.html', 'page', site), 'o-nas.html');
});

test('parametry zapytania stają się częścią nazwy pliku', () => {
  assert.equal(urlToLocalPath('https://www.example.com/blog?page=2', 'page', site), 'blog/index_page-2.html');
  assert.equal(urlToLocalPath('https://www.example.com/s.css?ver=6.1', 'css', site), 's_ver-6.1.css');
  const long = urlToLocalPath(`https://www.example.com/a?${'x'.repeat(200)}=1`, 'page', site);
  assert.match(long, /^a\/index_q[0-9a-f]{8}\.html$/);
});

test('zasoby z innych domen trafiają do _ext/', () => {
  assert.equal(urlToLocalPath('https://cdn.example.net/x.css', 'css', site), '_ext/cdn.example.net/x.css');
  assert.equal(
    urlToLocalPath('https://fonts.googleapis.com/css2?family=Inter', 'css', site),
    '_ext/fonts.googleapis.com/css2_family-Inter.css',
  );
});

test('pliki bez rozszerzenia dostają .bin, a linki do plików zachowują rozszerzenie', () => {
  assert.equal(urlToLocalPath('https://www.example.com/obrazek', 'asset', site), 'obrazek.bin');
  assert.equal(urlToLocalPath('https://www.example.com/plik.pdf', 'page', site), 'plik.pdf');
});

test('polskie znaki i niebezpieczne nazwy', () => {
  assert.equal(urlToLocalPath('https://www.example.com/zdj%C4%99cie%201.jpg', 'asset', site), 'zdjęcie 1.jpg');
  assert.equal(urlToLocalPath('https://www.example.com/a/%2e%2e/b.png', 'asset', site), 'b.png'); // URL sam usuwa ..
  assert.equal(urlToLocalPath('https://www.example.com/a:b*c.png', 'asset', site), 'a-b-c.png');
});

test('linki względne są kodowane', () => {
  assert.equal(relativeLink('blog/index.html', 'img/zdjęcie 1.jpg'), '../img/zdj%C4%99cie%201.jpg');
  assert.equal(relativeLink('index.html', 'o-nas/index.html'), 'o-nas/index.html');
  assert.equal(relativeLink('o-nas/index.html', 'o-nas/index.html'), 'index.html');
});

test('zakres witryny: www i subdomeny', () => {
  assert.ok(isInScope('https://example.com/x', site));
  assert.ok(isInScope('http://www.example.com/x', site));
  assert.ok(!isInScope('https://blog.example.com/x', site));
  assert.ok(isInScope('https://blog.example.com/x', createSite('https://example.com/', { subdomains: true })));
  assert.ok(!isInScope('https://example.org/', site));
});
