import { test } from 'node:test';
import assert from 'node:assert/strict';

import { rewriteHtml, parseSrcset, decodeEntities } from '../src/worker/html-tokenizer.js';
import { rewritePage } from '../src/worker/page-rewriter.js';
import { rewriteCss } from '../src/worker/css-rewriter.js';
import { Robots } from '../src/worker/robots.js';
import { detectBlock, parseRetryAfter } from '../src/worker/blocking.js';
import { buildUserAgent, parseSize, slugify } from '../src/worker/settings.js';

const ctx = (extra = {}) => ({
  baseUrl: 'https://example.com/blog/',
  planPage: (url) => (url.startsWith('https://example.com/') ? `LOCAL:${new URL(url).pathname}` : null),
  planResource: (url, kind) => `RES(${kind}):${url}`,
  isExternal: (url) => !url.startsWith('https://example.com/'),
  externalNewTab: false,
  ...extra,
});

test('tokenizer zostawia niezmienione fragmenty bez zmian', () => {
  const src = '<!doctype html><!-- <a href="x"> --><p class=a>Tekst</p><script>if (a<b) {"<a href=y>"}</script>';
  const out = rewriteHtml(src, { tag() {} });
  assert.equal(out, src);
});

test('tokenizer nie przepisuje znaczników wewnątrz <script> i komentarzy', () => {
  const src = '<script>var s = "<a href=\'/x\'>";</script><!-- <img src="/y"> --><a href="/z">z</a>';
  const seen = [];
  rewriteHtml(src, { tag: (t) => seen.push(`${t.name}:${t.get('href') ?? t.get('src') ?? ''}`) });
  assert.deepEqual(seen, ['script:', 'a:/z']);
});

test('encje w atrybutach są dekodowane i kodowane z powrotem', () => {
  assert.equal(decodeEntities('a?x=1&amp;y=2&#38;z=&#x33;'), 'a?x=1&y=2&z=3');
  const out = rewritePage('<a href="/s?a=1&amp;b=2">x</a>', {
    ...ctx(),
    planPage: (url) => `L:${new URL(url).search}`,
  });
  assert.equal(out, '<meta charset="utf-8"><a href="L:?a=1&amp;b=2">x</a>');
});

test('srcset', () => {
  assert.deepEqual(parseSrcset('a.png 1x, b.png 2x,c.png'), [
    { url: 'a.png', descriptor: '1x' },
    { url: 'b.png', descriptor: '2x' },
    { url: 'c.png', descriptor: '' },
  ]);
});

test('rewritePage: linki, zasoby, base, integrity, CSP, charset', () => {
  const src = `<html><head><base href="https://example.com/"><meta charset="windows-1250">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'">
<link rel="stylesheet" href="css/a.css" integrity="sha-1" crossorigin>
<link rel="canonical" href="/kanon"></head>
<body><a href="o-nas#zespol">O nas</a><a href="https://inna.example.org/">Inna</a>
<img src="i.png" srcset="i.png 1x, i2.png 2x" data-src="lazy.png">
<div style="background:url(bg.jpg)"></div><style>.a{background:url('s.jpg')}</style>
<form action="/szukaj"></form></body></html>`;
  const out = rewritePage(src, ctx());
  assert.ok(!out.includes('<base'), 'base usunięty');
  assert.ok(out.includes('<meta charset="utf-8">'), 'charset zmieniony na utf-8');
  assert.ok(!out.includes('Content-Security-Policy'), 'CSP usunięte');
  assert.ok(out.includes('href="RES(css):https://example.com/css/a.css"'));
  assert.ok(!out.includes('integrity'), 'integrity usunięte');
  assert.ok(out.includes('href="https://example.com/kanon"'), 'canonical absolutny');
  assert.ok(out.includes('href="LOCAL:/o-nas#zespol"'), 'kotwica zachowana');
  assert.ok(out.includes('href="https://inna.example.org/"'), 'link zewnętrzny bez zmian');
  assert.ok(out.includes('srcset="RES(asset):https://example.com/i.png 1x, RES(asset):https://example.com/i2.png 2x"'));
  assert.ok(out.includes('data-src="RES(asset):https://example.com/lazy.png"'));
  assert.ok(out.includes('url(&quot;RES(asset):https://example.com/bg.jpg&quot;)'), 'style w atrybucie');
  assert.ok(out.includes(`url("RES(asset):https://example.com/s.jpg")`), 'style w <style>');
  assert.ok(out.includes('action="https://example.com/szukaj"'));
});

test('rewritePage: opcja zewnętrznych linków w nowej karcie', () => {
  const src = '<a href="https://inna.example.org/">A</a><a href="https://inna.example.org/" target="_self">B</a><a href="/x">C</a>';
  const out = rewritePage(src, ctx({ externalNewTab: true }));
  assert.ok(out.includes('<a href="https://inna.example.org/" target="_blank" rel="noopener noreferrer">A</a>'));
  assert.ok(out.includes('target="_self">B'), 'istniejący target nie jest nadpisany');
  assert.ok(out.includes('<a href="LOCAL:/x">C</a>'), 'linki wewnętrzne bez target');
});

test('rewritePage: dodaje meta charset, gdy go brak', () => {
  assert.equal(rewritePage('<html><head><title>x</title></head></html>', ctx()), '<html><head><meta charset="utf-8"><title>x</title></head></html>');
});

test('rewriteCss: url() i @import, data: pomijane', () => {
  const css = '@charset "iso-8859-2";@import "a.css";@import url(b.css) screen;.x{background:url( "c.png" )}.y{background:url(data:image/png;base64,AA)}';
  const out = rewriteCss(css, (u, kind) => `${kind}:${u}`);
  assert.equal(
    out,
    '@charset "UTF-8";@import url("css:a.css");@import url("css:b.css") screen;.x{background:url("asset:c.png")}.y{background:url(data:image/png;base64,AA)}',
  );
});

test('robots.txt', () => {
  const r = new Robots('User-agent: *\nDisallow: /prywatne/\nAllow: /prywatne/publiczne\nCrawl-delay: 2\n', 'easycopy');
  assert.equal(r.isAllowed('/'), true);
  assert.equal(r.isAllowed('/prywatne/x'), false);
  assert.equal(r.isAllowed('/prywatne/publiczne'), true);
  assert.equal(r.crawlDelay, 2);
  const specific = new Robots('User-agent: *\nDisallow: /\n\nUser-agent: EasyCopy\nDisallow: /tylko-to\n', 'easycopy');
  assert.equal(specific.isAllowed('/cokolwiek'), true);
  assert.equal(specific.isAllowed('/tylko-to'), false);
});

test('wykrywanie blokad', () => {
  const h = (o) => new Headers(o);
  assert.equal(detectBlock(429, h({ 'retry-after': '5' })).retryAfterMs, 5000);
  assert.equal(detectBlock(403, h({ 'cf-mitigated': 'challenge' })).type, 'challenge');
  assert.equal(detectBlock(503, h({}), '<title>Just a moment...</title>').type, 'challenge');
  assert.equal(detectBlock(503, h({ 'retry-after': '10' })).type, 'rate');
  assert.equal(detectBlock(503, h({})), null);
  assert.equal(detectBlock(200, h({})), null);
  assert.equal(parseRetryAfter('Wed, 21 Oct 2015 07:28:10 GMT', Date.parse('Wed, 21 Oct 2015 07:28:00 GMT')), 10000);
});

test('ustawienia: User-Agent, rozmiary, nazwy', () => {
  assert.match(buildUserAgent(), /^EasyCopy\/\d/);
  assert.match(buildUserAgent({ browser: 'safari', os: 'ios' }), /iPhone.*Mobile\/15E148 Safari/);
  assert.match(buildUserAgent({ browser: 'firefox', os: 'linux' }), /X11; Linux x86_64; rv:/);
  assert.equal(buildUserAgent({ custom: 'Moj/1.0' }), 'Moj/1.0');
  assert.equal(parseSize('2GB'), 2 * 1024 ** 3);
  assert.equal(parseSize('500 MB'), 500 * 1024 ** 2);
  assert.equal(parseSize('1,5g'), 1.5 * 1024 ** 3);
  assert.equal(slugify('Strona główna – Żółw!'), 'strona-glowna-zolw');
});
