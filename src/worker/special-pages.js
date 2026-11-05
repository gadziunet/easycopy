// Helper pages saved in the copy: _brak.html and short redirect pages.

import { DICTS, translator } from '../shared/i18n.js';
import { escapeAttr } from './html-tokenizer.js';

export const MISSING_PAGE = '_brak.html';

/** Reasons why a page of the archived site is not in the copy (ids stored in links). */
export const MISSING_REASON_IDS = ['glebokosc', 'limit', 'typ', 'wykluczone', 'robots', 'blad', 'pauza'];

/** Link to _brak.html with the address and the reason after #, e.g. _brak.html#u=…&r=glebokosc */
export function missingHref(relToMissingPage, url, reason) {
  return `${relToMissingPage}#u=${encodeURIComponent(url)}&r=${encodeURIComponent(reason)}`;
}

const STYLE = `
  :root { color-scheme: light dark; --bg: #f6f6f5; --card: #ffffff; --text: #1a1a1a; --muted: #555553; --line: #e4e4e2; --btn: #1a1a1a; --btn-text: #ffffff; }
  @media (prefers-color-scheme: dark) { :root { --bg: #161615; --card: #1f1f1e; --text: #eeeeec; --muted: #a8a8a4; --line: #333331; --btn: #eeeeec; --btn-text: #161615; } }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px;
         background: var(--bg); color: var(--text); font: 16px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; }
  main { width: 100%; max-width: 560px; background: var(--card); border: 1px solid var(--line); border-radius: 12px; padding: 32px; }
  h1 { margin: 0 0 8px; font-size: 22px; letter-spacing: -0.01em; }
  p { margin: 0 0 16px; color: var(--muted); }
  code { display: block; padding: 10px 12px; border-radius: 8px; background: var(--bg); color: var(--text);
         font: 13px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; word-break: break-all; margin-bottom: 20px; }
  .actions { display: flex; flex-wrap: wrap; gap: 12px; }
  a.btn { display: inline-flex; align-items: center; min-height: 44px; padding: 0 18px; border-radius: 8px; text-decoration: none; font-weight: 600; }
  a.primary { background: var(--btn); color: var(--btn-text); }
  a.secondary { border: 1px solid var(--line); color: var(--text); }
  .note { margin-top: 20px; font-size: 13px; }
`;

const escapeText = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Content of _brak.html – one page for all subpages that were not downloaded.
 * Written in `language`; the script switches to the visitor's browser language (en/pl).
 */
export function missingPageHtml({ startPagePath = 'index.html', language = 'en' } = {}) {
  const t = translator(language);
  const texts = Object.fromEntries(
    Object.entries(DICTS).map(([lang, d]) => [lang, { ...d.missingPage, reasons: d.missing }]),
  );
  const json = JSON.stringify(texts).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="${t.lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${escapeText(t('missingPage.title'))}</title>
<style>${STYLE}</style>
</head>
<body>
<main>
  <h1 id="heading">${escapeText(t('missingPage.heading'))}</h1>
  <p id="reason">${escapeText(t('missingPage.reasonDefault'))}</p>
  <code id="url" hidden></code>
  <div class="actions">
    <a class="btn primary" id="original" href="#" hidden target="_blank" rel="noopener noreferrer">${escapeText(t('missingPage.open'))}</a>
    <a class="btn secondary" id="home" href="${escapeAttr(startPagePath)}">${escapeText(t('missingPage.home'))}</a>
  </div>
  <noscript><p class="note">${escapeText(t('missingPage.noscript'))}</p></noscript>
</main>
<script>
(function () {
  var texts = ${json};
  var langs = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || '']);
  var lang = document.documentElement.lang;
  for (var i = 0; i < langs.length; i++) {
    var code = String(langs[i]).slice(0, 2).toLowerCase();
    if (texts[code]) { lang = code; break; }
  }
  var tx = texts[lang] || texts.en;
  document.documentElement.lang = lang;
  document.title = tx.title;
  document.getElementById('heading').textContent = tx.heading;
  document.getElementById('original').textContent = tx.open;
  document.getElementById('home').textContent = tx.home;
  var params = new URLSearchParams(location.hash.slice(1));
  var url = params.get('u') || '';
  var reason = params.get('r') || '';
  document.getElementById('reason').textContent = tx.reasons[reason] || tx.reasonDefault;
  if (/^https?:\\/\\//i.test(url)) {
    var box = document.getElementById('url');
    box.textContent = url;
    box.hidden = false;
    var link = document.getElementById('original');
    link.href = url;
    link.hidden = false;
  }
})();
</script>
</body>
</html>
`;
}

/** Short redirect page (e.g. to _brak.html or to a PDF under another address). labelKey: redirect.* */
export function redirectHtml(href, labelKey = 'toCopy', language = 'en') {
  const t = translator(language);
  const h = escapeAttr(href);
  return `<!doctype html>
<html lang="${t.lang}">
<head>
<meta charset="utf-8">
<meta http-equiv="refresh" content="0; url=${h}">
<meta name="robots" content="noindex">
<title>${escapeText(t('redirect.title'))}</title>
</head>
<body>
<p><a href="${h}">${escapeText(t(`redirect.${labelKey}`))}</a></p>
</body>
</html>
`;
}
