// Strony pomocnicze zapisywane w kopii: _brak.html i krótkie strony-przekierowania.

import { escapeAttr } from './html-tokenizer.js';

export const MISSING_PAGE = '_brak.html';

/** Powody, dla których strona z archiwizowanej witryny nie trafiła do kopii. */
export const MISSING_REASONS = {
  glebokosc: 'Strona leży głębiej, niż pozwalało ustawienie głębokości.',
  limit: 'Osiągnięto limit stron lub rozmiaru kopii.',
  typ: 'Ten typ pliku był pominięty w ustawieniach.',
  wykluczone: 'Adres pasował do wzorca wykluczeń.',
  robots: 'Plik robots.txt witryny nie pozwala pobierać tej strony.',
  blad: 'Nie udało się pobrać strony (błąd serwera lub brak strony).',
  pauza: 'Pobieranie zostało wstrzymane, zanim doszło do tej strony.',
};

/** Link do _brak.html z adresem i powodem w części #, np. _brak.html#u=…&r=glebokosc */
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

/** Treść _brak.html – jedna strona dla wszystkich niepobranych podstron. */
export function missingPageHtml({ startPagePath = 'index.html' } = {}) {
  const reasons = JSON.stringify(MISSING_REASONS);
  return `<!doctype html>
<html lang="pl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Strona nie została zarchiwizowana</title>
<style>${STYLE}</style>
</head>
<body>
<main>
  <h1>Ta strona nie została zarchiwizowana</h1>
  <p id="reason">Ta podstrona nie jest częścią kopii.</p>
  <code id="url" hidden></code>
  <div class="actions">
    <a class="btn primary" id="original" href="#" hidden target="_blank" rel="noopener noreferrer">Otwórz oryginał</a>
    <a class="btn secondary" href="${escapeAttr(startPagePath)}">Strona główna kopii</a>
  </div>
  <noscript><p class="note">Włącz JavaScript, żeby zobaczyć adres oryginalnej strony.</p></noscript>
</main>
<script>
(function () {
  var reasons = ${reasons};
  var params = new URLSearchParams(location.hash.slice(1));
  var url = params.get('u') || '';
  var reason = params.get('r') || '';
  if (reasons[reason]) document.getElementById('reason').textContent = reasons[reason];
  if (/^https?:\\/\\//i.test(url)) {
    var code = document.getElementById('url');
    code.textContent = url;
    code.hidden = false;
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

/** Krótka strona przekierowująca (np. do _brak.html albo do pliku PDF pod innym adresem). */
export function redirectHtml(href, label = 'Przejdź dalej') {
  const h = escapeAttr(href);
  return `<!doctype html>
<html lang="pl">
<head>
<meta charset="utf-8">
<meta http-equiv="refresh" content="0; url=${h}">
<meta name="robots" content="noindex">
<title>Przekierowanie</title>
</head>
<body>
<p><a href="${h}">${label}</a></p>
</body>
</html>
`;
}
