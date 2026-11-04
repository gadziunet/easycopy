// Strona główna serwera archiwów: lista kopii.

import { PROJECT_URL, VERSION, formatSize } from '../worker/settings.js';

export function escapeHtml(text) {
  return String(text ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

const STATUS = {
  complete: { label: 'Gotowe', dot: 'full' },
  limit: { label: 'Gotowe (limit)', dot: 'full' },
  paused: { label: 'Wstrzymane', dot: 'ring' },
  aborted: { label: 'Przerwane', dot: 'ring' },
  error: { label: 'Błąd', dot: 'ring' },
  unknown: { label: '—', dot: 'none' },
};

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function plural(n, one, few, many) {
  if (n === 1) return one;
  const d = n % 10;
  const h = n % 100;
  return d >= 2 && d <= 4 && (h < 12 || h > 14) ? few : many;
}

function hostOf(url) {
  try {
    return new URL(url).host;
  } catch {
    return '';
  }
}

const STYLE = `
:root { color-scheme: light dark; --bg:#f6f6f5; --card:#fff; --text:#1a1a1a; --muted:#555553; --line:#e4e4e2; --soft:#f0f0ee; --btn:#1a1a1a; --btn-text:#fff; }
@media (prefers-color-scheme: dark) { :root { --bg:#161615; --card:#1f1f1e; --text:#eeeeec; --muted:#a8a8a4; --line:#333331; --soft:#2a2a28; --btn:#eeeeec; --btn-text:#161615; } }
* { box-sizing: border-box; }
body { margin:0; background:var(--bg); color:var(--text); font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif; }
header { background:var(--card); border-bottom:1px solid var(--line); }
.wrap { max-width:1200px; margin:0 auto; padding:0 24px; }
.bar { min-height:64px; display:flex; align-items:center; gap:10px; font-weight:700; font-size:17px; }
main { padding:32px 0 64px; display:flex; flex-direction:column; gap:24px; }
h1 { margin:0; font-size:28px; letter-spacing:-0.02em; }
.lead { margin:4px 0 0; color:var(--muted); }
.card { background:var(--card); border:1px solid var(--line); border-radius:12px; overflow:hidden; }
.scroll { overflow-x:auto; }
table { width:100%; min-width:760px; border-collapse:collapse; font-size:14px; }
th { text-align:left; font-weight:500; font-size:13px; color:var(--muted); padding:12px 16px; }
td { padding:14px 16px; border-top:1px solid var(--line); vertical-align:top; }
th:first-child, td:first-child { padding-left:24px; } th:last-child, td:last-child { padding-right:24px; text-align:right; }
.name { font-weight:600; }
.mono { font:12.5px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace; color:var(--muted); word-break:break-all; }
.sub { font-size:12.5px; color:var(--muted); }
.status { display:inline-flex; align-items:center; gap:8px; white-space:nowrap; }
.dot { width:9px; height:9px; border-radius:50%; flex:none; }
.dot.full { background:var(--text); } .dot.ring { border:2px solid var(--text); }
a.btn { display:inline-flex; align-items:center; min-height:40px; padding:0 14px; border:1px solid var(--line); border-radius:8px; color:var(--text); text-decoration:none; font-weight:500; white-space:nowrap; }
a.btn:hover { background:var(--soft); }
details { margin-top:6px; } summary { cursor:pointer; color:var(--muted); font-size:13px; }
details ul { list-style:none; margin:8px 0 0; padding:0; text-align:left; }
details li { display:flex; justify-content:space-between; gap:16px; padding:4px 0; font-size:13px; }
details a { color:var(--text); }
footer { padding:0 0 32px; font-size:13px; color:var(--muted); }
footer a { color:var(--muted); }
.empty { padding:48px 24px; text-align:center; color:var(--muted); }
code { font:13px ui-monospace,SFMono-Regular,Menlo,monospace; background:var(--soft); padding:2px 6px; border-radius:4px; }
`;

const LOGO = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="13" height="16" rx="2"/><path d="M8 8h3M8 12h3"/><path d="M16 8h3a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-9"/></svg>`;

function row(a) {
  const info = a.latestInfo ?? {};
  const st = STATUS[info.status] ?? STATUS.unknown;
  const older = a.versions.filter((v) => v.version !== a.latest);
  const versions = older.length
    ? `<details><summary>Starsze wersje (${older.length})</summary><ul>${older
        .map((v) => `<li><a href="/a/${escapeHtml(a.name)}/${escapeHtml(v.version)}/">${escapeHtml(v.version)}</a><span class="sub">${v.bytes != null ? escapeHtml(formatSize(v.bytes)) : ''}</span></li>`)
        .join('')}</ul></details>`
    : '';
  return `<tr>
<td><div class="name">${escapeHtml(a.name)}</div><div class="mono">${escapeHtml(hostOf(a.startUrl))}</div></td>
<td>${escapeHtml(formatDate(info.createdAt))}<div class="sub">${escapeHtml(a.latest)}</div></td>
<td>${a.versions.length}</td>
<td>${info.pages ?? '—'}</td>
<td>${info.bytes != null ? escapeHtml(formatSize(info.bytes)) : '—'}</td>
<td><span class="status"><span class="dot ${st.dot}"></span>${escapeHtml(st.label)}</span></td>
<td><a class="btn" href="/a/${escapeHtml(a.name)}/">Otwórz</a>${versions}</td>
</tr>`;
}

export function listPageHtml(archives) {
  const total = archives.reduce((s, a) => s + (a.latestInfo?.bytes ?? 0), 0);
  const body = archives.length
    ? `<div class="scroll"><table>
<thead><tr><th>Strona</th><th>Ostatnia kopia</th><th>Wersje</th><th>Strony</th><th>Rozmiar</th><th>Status</th><th>Akcje</th></tr></thead>
<tbody>${archives.map(row).join('\n')}</tbody></table></div>`
    : `<div class="empty">Nie ma jeszcze żadnych kopii. Zrób pierwszą poleceniem <code>easycopy https://www.example.com/</code></div>`;
  return `<!doctype html>
<html lang="pl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Archiwa – EasyCopy</title>
<style>${STYLE}</style>
</head>
<body>
<header><div class="wrap bar">${LOGO}<span>EasyCopy</span></div></header>
<main class="wrap">
<div>
<h1>Archiwa</h1>
<p class="lead">${archives.length} ${plural(archives.length, 'archiwum', 'archiwa', 'archiwów')} · ${escapeHtml(formatSize(total))} (najnowsze wersje)</p>
</div>
<section class="card" aria-label="Lista archiwów">
${body}
</section>
</main>
<footer class="wrap">EasyCopy ${escapeHtml(VERSION)} · <a href="${escapeHtml(PROJECT_URL)}" rel="noopener noreferrer">Kod źródłowy</a> (licencja AGPL-3.0)</footer>
</body>
</html>
`;
}
