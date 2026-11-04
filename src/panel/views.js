// Widoki panelu (HTML renderowany po stronie serwera). Wszystkie dane są escapowane.

import { escapeHtml as e, plural } from '../server/list-page.js';
import { PRESETS, PROJECT_URL, VERSION, formatSize } from '../worker/settings.js';
import { MISSING_REASONS } from '../worker/special-pages.js';
import { DEPTH_OPTIONS, SIZE_OPTIONS } from './job-form.js';

export const STATUS = {
  queued: { label: 'W kolejce', dot: 'dashed' },
  running: { label: 'Pobieranie', dot: 'dashed' },
  complete: { label: 'Gotowe', dot: 'full' },
  limit: { label: 'Gotowe (limit)', dot: 'full' },
  paused: { label: 'Wstrzymane', dot: 'ring' },
  error: { label: 'Błąd', dot: 'ring' },
  aborted: { label: 'Przerwane', dot: 'ring' },
  cancelled: { label: 'Anulowane', dot: 'ring' },
};

const PRESET_DESC = {
  delikatny: { rate: '1 zapytanie / 2 s', desc: 'Cudze strony, małe serwery' },
  normalny: { rate: '2 zapytania / s', desc: 'Dobry wybór na start' },
  szybki: { rate: '5 zapytań / s', desc: 'Tylko własne strony' },
};

const BROWSER_LABELS = {
  easycopy: 'EasyCopy (domyślny, uczciwy)',
  chrome: 'Chrome',
  firefox: 'Firefox',
  safari: 'Safari',
  edge: 'Edge',
  custom: 'Własny…',
};
const OS_LABELS = { win: 'Windows', mac: 'macOS', linux: 'Linux', android: 'Android', ios: 'iOS' };

const LOGO = `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="13" height="16" rx="2"/><path d="M8 8h3M8 12h3"/><path d="M16 8h3a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-9"/></svg>`;
const ICON_PLUS = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
const ICON_EXT = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4h6v6M20 4 11 13M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>';
const ICON_PAUSE = '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>';

// ---------- pomocnicze ----------

export function formatDate(ms) {
  if (!ms) return '—';
  return new Date(ms).toLocaleString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatTime(ms) {
  return new Date(ms).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function formatDuration(ms) {
  if (ms == null || ms < 0) return '—';
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ${s % 60} s`;
  return `${Math.floor(m / 60)} h ${m % 60} min`;
}

function hostOf(url) {
  try {
    return new URL(url).host;
  } catch {
    return url ?? '';
  }
}

export function statusBadge(status) {
  const st = STATUS[status] ?? { label: status, dot: 'ring' };
  return `<span class="status" data-field="status"><span class="dot ${st.dot}"></span><span>${e(st.label)}</span></span>`;
}

/** Postęp 0–1: pobrane strony wobec pobranych + czekających (najwyżej limit stron). */
export function jobProgress(job) {
  if (job.status !== 'running') return ['queued'].includes(job.status) ? 0 : 1;
  const s = job.stats ?? {};
  const pages = s.pages ?? 0;
  let total = pages + (s.queuedPages ?? 0);
  const max = job.options?.maxPages;
  if (max > 0) total = Math.min(total, max);
  return total > 0 ? Math.min(1, pages / total) : 0;
}

/** Krótki opis zadania do API i widoków. */
export function jobSummary(job, archiveBase) {
  const s = job.stats ?? {};
  return {
    id: job.id,
    name: job.name,
    url: job.url,
    status: job.status,
    statusLabel: STATUS[job.status]?.label ?? job.status,
    runAt: job.runAt,
    scheduled: job.status === 'queued' && job.runAt > Date.now() + 1000,
    progress: jobProgress(job),
    pages: s.pages ?? 0,
    files: s.files ?? 0,
    bytes: s.bytes ?? 0,
    failed: s.failed ?? 0,
    skipped: s.skipped ?? 0,
    queuedPages: s.queuedPages ?? 0,
    queuedFiles: s.queuedFiles ?? 0,
    version: job.version,
    archiveUrl: job.version ? `${archiveBase}/a/${encodeURIComponent(job.name)}/${encodeURIComponent(job.version)}/` : null,
    error: job.error,
    pause: job.pause,
    cancelRequested: job.cancelRequested,
    durationMs: job.startedAt ? (job.finishedAt ?? Date.now()) - job.startedAt : null,
  };
}

function csrfForm(action, label, { cls = 'btn', confirm = null, fields = {} } = {}) {
  const hidden = Object.entries(fields).map(([k, v]) => `<input type="hidden" name="${e(k)}" value="${e(v)}">`).join('');
  return `<form method="post" action="${e(action)}" class="inline"${confirm ? ` data-confirm="${e(confirm)}"` : ''}>${hidden}<button type="submit" class="${cls}">${label}</button></form>`;
}

// ---------- układ strony ----------

export function layout({ title, active = '', body, auth = false, warning = null }) {
  const nav = [
    ['/', 'Archiwa', 'archiwa'],
    ['/zadania', 'Zadania', 'zadania'],
  ]
    .map(([href, label, key]) => `<a href="${href}"${active === key ? ' class="active" aria-current="page"' : ''}>${label}</a>`)
    .join('');
  return `<!doctype html>
<html lang="pl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${e(title)} – EasyCopy</title>
<link rel="stylesheet" href="/static/app.css?v=${e(VERSION)}">
<script src="/static/app.js?v=${e(VERSION)}" defer></script>
</head>
<body>
<header class="top">
<div class="wrap bar">
<a href="/" class="brand">${LOGO}<span>EasyCopy</span></a>
<nav aria-label="Główne">${nav}</nav>
<div class="bar-actions">
${auth ? csrfForm('/wyloguj', 'Wyloguj', { cls: 'link' }) : ''}
<a href="/nowa" class="btn primary">${ICON_PLUS}Nowa kopia</a>
</div>
</div>
</header>
${warning ? `<div class="wrap"><p class="notice" role="alert">${e(warning)}</p></div>` : ''}
<main class="wrap">
${body}
</main>
<footer class="wrap foot">EasyCopy ${e(VERSION)} · <a href="${e(PROJECT_URL)}" rel="noopener noreferrer">Kod źródłowy</a> (licencja AGPL-3.0)</footer>
</body>
</html>
`;
}

// ---------- Archiwa ----------

function activeJobCard(job, archiveBase) {
  const s = jobSummary(job, archiveBase);
  const detail = s.scheduled
    ? `Zaplanowane na ${e(formatDate(s.runAt))}`
    : job.status === 'queued'
      ? 'Czeka na swoją kolej'
      : `${s.pages} stron · ${s.files} plików · ${e(formatSize(s.bytes))}${s.queuedPages ? ` · w kolejce ${s.queuedPages}` : ''}`;
  return `<div class="job-row" data-job="${s.id}">
<div class="job-name"><div class="strong">${e(job.name)}</div><div class="mono">${e(hostOf(job.url))}</div></div>
<div class="job-progress">
<progress max="1" value="${s.progress.toFixed(3)}" data-field="progress" aria-label="Postęp"></progress>
<div class="row-meta"><span data-field="detail">${detail}</span><span>Preset: ${e(PRESETS[job.options?.preset]?.label ?? '—')}</span></div>
</div>
<div class="job-actions"><a class="btn" href="/zadania/${s.id}">Szczegóły</a>${csrfForm(`/zadania/${s.id}/anuluj`, 'Anuluj', { confirm: 'Anulować to zadanie?' })}</div>
</div>`;
}

export function archivesPage({ archives, activeJobs, latestJobs, archiveBase }) {
  const active = activeJobs.length
    ? `<section class="card pad" aria-labelledby="w-toku" data-poll="active">
<h2 id="w-toku">W toku</h2>
${activeJobs.map((j) => activeJobCard(j, archiveBase)).join('\n')}
</section>`
    : '<section data-poll="active" hidden></section>';

  const total = archives.reduce((sum, a) => sum + (a.latestInfo?.bytes ?? 0), 0);
  const activeByName = new Map(activeJobs.map((j) => [j.name, j]));
  const rows = archives
    .map((a) => {
      const info = a.latestInfo ?? {};
      const jobId = latestJobs.get(a.name);
      const activeJob = activeByName.get(a.name);
      // wersja w trakcie pobierania nie ma jeszcze manifestu
      const status = activeJob && activeJob.version === a.latest ? 'running' : info.status && STATUS[info.status] ? info.status : null;
      const older = a.versions.filter((v) => v.version !== a.latest);
      return `<tr>
<td><div class="strong">${e(a.name)}</div><div class="mono">${e(hostOf(a.startUrl))}</div></td>
<td>${e(formatDate(info.createdAt ? Date.parse(info.createdAt) : null))}<div class="sub">${e(a.latest)}</div></td>
<td>${a.versions.length}${older.length ? `<details><summary>starsze</summary><ul class="plain">${older.map((v) => `<li><a href="${e(archiveBase)}/a/${e(a.name)}/${e(v.version)}/" target="_blank" rel="noopener noreferrer">${e(v.version)}</a></li>`).join('')}</ul></details>` : ''}</td>
<td>${info.pages ?? '—'}</td>
<td>${info.bytes != null ? e(formatSize(info.bytes)) : '—'}</td>
<td>${status ? statusBadge(status) : '—'}</td>
<td class="actions">
<a class="btn" href="${e(archiveBase)}/a/${e(a.name)}/" target="_blank" rel="noopener noreferrer">Otwórz ${ICON_EXT}</a>
${jobId && !activeJob ? csrfForm(`/zadania/${jobId}/ponow`, 'Nowa wersja') : ''}
${jobId ? `<a class="btn" href="/zadania/${jobId}">Szczegóły</a>` : ''}
</td>
</tr>`;
    })
    .join('\n');

  const table = archives.length
    ? `<div class="scroll"><table>
<thead><tr><th>Strona</th><th>Ostatnia kopia</th><th>Wersje</th><th>Strony</th><th>Rozmiar</th><th>Status</th><th class="actions">Akcje</th></tr></thead>
<tbody>${rows}</tbody></table></div>`
    : `<div class="empty"><p>Nie masz jeszcze żadnych kopii.</p><a class="btn primary" href="/nowa">${ICON_PLUS}Zrób pierwszą kopię</a></div>`;

  return `<div class="page-head">
<div><h1>Archiwa</h1><p class="lead">Kopie stron zapisane na tym serwerze. Otwierają się w nowej karcie.</p></div>
<div class="kpis"><span><strong>${archives.length}</strong> ${plural(archives.length, 'archiwum', 'archiwa', 'archiwów')}</span><span><strong>${e(formatSize(total))}</strong> zajęte</span></div>
</div>
${active}
<section class="card" aria-label="Wszystkie archiwa">${table}</section>
<p class="sub">Archiwa są dostępne w sieci lokalnej pod adresem <span class="mono">${e(archiveBase)}</span>.</p>`;
}

// ---------- Nowa kopia ----------

function field(name, label, input, { error, hint } = {}) {
  return `<div class="field${error ? ' has-error' : ''}">
<label for="${e(name)}">${label}</label>
${input}
${hint ? `<span class="hint">${hint}</span>` : ''}
${error ? `<span class="error" id="${e(name)}-error">${e(error)}</span>` : ''}
</div>`;
}

function select(name, options, value, attrs = '') {
  return `<select id="${e(name)}" name="${e(name)}" ${attrs}>${options
    .map((o) => `<option value="${e(o.value)}"${String(o.value) === String(value) ? ' selected' : ''}>${e(o.label)}</option>`)
    .join('')}</select>`;
}

function checkbox(name, label, checked, hint = '') {
  return `<label class="check"><input type="checkbox" name="${e(name)}"${checked ? ' checked' : ''}><span>${label}${hint ? ` <span class="sub">${hint}</span>` : ''}</span></label>`;
}

export function newJobPage({ values, errors = {} }) {
  const presets = Object.entries(PRESETS)
    .map(
      ([id, p]) => `<label class="preset">
<input type="radio" name="preset" value="${id}"${values.preset === id ? ' checked' : ''}>
<span class="preset-box"><span class="strong">${e(p.label)}</span><span class="sub">${e(PRESET_DESC[id].rate)}</span><span class="sub">${e(PRESET_DESC[id].desc)}</span></span>
</label>`,
    )
    .join('');
  const advancedOpen = Boolean(errors.ua || errors.os || errors.customUa || values.skip || values.exclude || !values.respectRobots || values.allowJs || values.externalNewTab || values.ua !== 'easycopy');

  return `<div class="narrow">
<a class="back" href="/">← Archiwa</a>
<h1>Nowa kopia strony</h1>
<p class="lead">Podaj adres i wybierz tempo. Resztę możesz zostawić domyślną.</p>
${Object.keys(errors).length ? '<p class="notice" role="alert">Popraw zaznaczone pola.</p>' : ''}
<form method="post" action="/nowa" class="stack" novalidate>

<section class="card pad stack">
${field('url', 'Adres strony', `<input id="url" name="url" type="url" inputmode="url" class="mono-input" value="${e(values.url)}" placeholder="https://www.example.com/" required${errors.url ? ' aria-invalid="true" aria-describedby="url-error"' : ''}>`, { error: errors.url })}
${field('name', 'Nazwa w panelu', `<input id="name" name="name" type="text" value="${e(values.name)}" placeholder="np. Strona firmy">`, { hint: 'Puste = nazwa z domeny. Adres archiwum: /a/&lt;nazwa&gt;/' })}
</section>

<section class="card pad stack" aria-labelledby="tempo">
<div><h2 id="tempo">Tempo pobierania</h2><p class="sub">Wolniej = mniejsze ryzyko blokady (np. Cloudflare).</p></div>
<div class="presets" role="radiogroup" aria-labelledby="tempo">${presets}</div>
${errors.preset ? `<span class="error">${e(errors.preset)}</span>` : ''}
</section>

<section class="card pad stack" aria-labelledby="zakres">
<h2 id="zakres">Zakres</h2>
<div class="grid4">
${field('depth', 'Jak daleko w głąb', select('depth', DEPTH_OPTIONS, values.depth), { error: errors.depth, hint: 'Ile kliknięć od strony startowej' })}
${field('maxPages', 'Limit stron', `<input id="maxPages" name="maxPages" type="number" min="0" value="${e(values.maxPages)}">`, { error: errors.maxPages, hint: '0 = bez limitu' })}
${field('maxSize', 'Limit rozmiaru', select('maxSize', SIZE_OPTIONS, values.maxSize), { error: errors.maxSize })}
</div>
${checkbox('sameDomain', 'Tylko ta domena', values.sameDomain, '(linki do innych stron prowadzą do oryginału)')}
</section>

<details class="card"${advancedOpen ? ' open' : ''}>
<summary>Ustawienia zaawansowane</summary>
<div class="pad stack">
<fieldset class="stack">
<legend>Identyfikacja (User-Agent)</legend>
<div class="grid2">
${field('ua', 'Przeglądarka', select('ua', Object.entries(BROWSER_LABELS).map(([value, label]) => ({ value, label })), values.ua, 'data-ua-browser'), { error: errors.ua })}
${field('os', 'System', select('os', Object.entries(OS_LABELS).map(([value, label]) => ({ value, label })), values.os, 'data-ua-os'), { error: errors.os })}
</div>
<div data-ua-custom${values.ua === 'custom' ? '' : ' hidden'}>
${field('customUa', 'Własny ciąg User-Agent', `<input id="customUa" name="customUa" type="text" class="mono-input" value="${e(values.customUa)}" placeholder="MojaAplikacja/1.0 (+https://example.com/bot)">`, { error: errors.customUa })}
</div>
<p class="sub">Zmiana przydaje się, gdy strona pokazuje inną wersję (np. mobilną) zależnie od przeglądarki. Nie omija zabezpieczeń typu Cloudflare – limity tempa działają zawsze.</p>
</fieldset>
${checkbox('respectRobots', 'Respektuj robots.txt', values.respectRobots)}
${checkbox('allowJs', 'Zezwól na JavaScript w archiwum', values.allowJs, '(skrypty i tak działają w izolacji)')}
${checkbox('externalNewTab', 'Zewnętrzne linki otwieraj w nowej karcie', values.externalNewTab)}
${field('skip', 'Pomijaj typy plików', `<input id="skip" name="skip" type="text" class="mono-input" value="${e(values.skip)}" placeholder="mp4, zip, iso">`)}
${field('exclude', 'Wyklucz adresy (wzorce)', `<input id="exclude" name="exclude" type="text" class="mono-input" value="${e(values.exclude)}" placeholder="/koszyk/*, /konto/*">`)}
</div>
</details>

<div class="form-actions">
<a class="btn" href="/">Anuluj</a>
<button type="submit" class="btn primary">Rozpocznij pobieranie</button>
</div>
</form>
</div>`;
}

// ---------- Zadania ----------

export function jobsPage({ jobs }) {
  const rows = jobs
    .map((j) => {
      const s = j.stats ?? {};
      return `<tr>
<td class="sub">#${j.id}</td>
<td><a class="strong" href="/zadania/${j.id}">${e(j.name)}</a><div class="mono">${e(hostOf(j.url))}</div></td>
<td>${statusBadge(j.status)}</td>
<td>${e(formatDate(j.createdAt))}</td>
<td>${e(formatDuration(j.startedAt ? (j.finishedAt ?? Date.now()) - j.startedAt : null))}</td>
<td>${s.pages ?? '—'}</td>
<td>${s.bytes != null ? e(formatSize(s.bytes)) : '—'}</td>
</tr>`;
    })
    .join('\n');
  return `<div class="page-head"><div><h1>Zadania</h1><p class="lead">Kolejka i historia pobierania (ostatnie 100).</p></div></div>
<section class="card">${jobs.length
    ? `<div class="scroll"><table><thead><tr><th>#</th><th>Strona</th><th>Status</th><th>Dodane</th><th>Czas</th><th>Strony</th><th>Rozmiar</th></tr></thead><tbody>${rows}</tbody></table></div>`
    : `<div class="empty"><p>Nie ma jeszcze żadnych zadań.</p><a class="btn primary" href="/nowa">${ICON_PLUS}Nowa kopia</a></div>`}
</section>`;
}

// ---------- Szczegóły zadania ----------

function settingsList(job) {
  const o = job.options ?? {};
  const rows = [
    ['Tempo', `${PRESETS[o.preset]?.label ?? '—'}${PRESETS[o.preset] ? ` (${PRESET_DESC[o.preset].rate})` : ''}`],
    ['Głębokość', o.maxDepth == null || o.maxDepth < 0 ? 'bez limitu' : String(o.maxDepth)],
    ['Limit', `${o.maxPages ? `${o.maxPages} stron` : 'bez limitu stron'} · ${o.maxBytes ? formatSize(o.maxBytes) : 'bez limitu rozmiaru'}`],
    ['Zakres', o.subdomains ? 'Domena z subdomenami' : 'Tylko ta domena'],
    ['robots.txt', o.respectRobots === false ? 'Ignorowany' : 'Respektowany'],
    ['JavaScript', o.allowJavaScript ? 'Włączony w archiwum' : 'Wyłączony w archiwum'],
    ['User-Agent', o.userAgent ? 'Własny' : BROWSER_LABELS[o.browser ?? 'easycopy']?.replace(' (domyślny, uczciwy)', '') + (o.browser && o.browser !== 'easycopy' ? ` · ${OS_LABELS[o.os] ?? ''}` : '')],
  ];
  if (o.skipExtensions?.length) rows.push(['Pomijane typy', o.skipExtensions.join(', ')]);
  if (o.exclude?.length) rows.push(['Wykluczenia', o.exclude.join(', ')]);
  return `<dl class="dl">${rows.map(([k, v]) => `<dt>${e(k)}</dt><dd>${e(v)}</dd>`).join('')}</dl>`;
}

function statusNotice(job) {
  if (job.status === 'paused') {
    const p = job.pause ?? {};
    return `<section class="card pad notice-card" role="status">
${ICON_PAUSE}
<div class="grow"><div class="strong">Zadanie wstrzymane – ${e(p.type === 'challenge' ? 'strona wymaga weryfikacji przeglądarki' : 'serwer ogranicza zapytania')}</div>
<p class="sub">${e(p.message ?? '')}${p.host ? ` (${e(p.host)})` : ''}. Pobieranie zatrzymano, żeby nie doprowadzić do blokady Twojego adresu IP. To, co już pobrano, jest w kopii.</p></div>
<div class="row-actions">
${csrfForm(`/zadania/${job.id}/ponow`, 'Ponów jako „Delikatny”', { cls: 'btn primary', fields: { preset: 'delikatny' } })}
${csrfForm(`/zadania/${job.id}/ponow`, 'Ponów za 10 min', { fields: { preset: 'delikatny', delay: '600' } })}
</div>
</section>`;
  }
  if (job.status === 'error' || job.status === 'aborted') {
    return `<section class="card pad notice-card" role="status"><div class="grow"><div class="strong">${e(STATUS[job.status].label)}</div><p class="sub">${e(job.error ?? '')}</p></div>
<div class="row-actions">${csrfForm(`/zadania/${job.id}/ponow`, 'Ponów', { cls: 'btn primary' })}</div></section>`;
  }
  return '';
}

export function jobPage({ job, log, versions, archiveBase }) {
  const s = jobSummary(job, archiveBase);
  const isActive = job.status === 'queued' || job.status === 'running';
  const actions = [
    s.archiveUrl ? `<a class="btn" href="${e(s.archiveUrl)}" target="_blank" rel="noopener noreferrer" data-field="archive-link">Otwórz kopię ${ICON_EXT}</a>` : '',
    isActive ? csrfForm(`/zadania/${job.id}/anuluj`, s.cancelRequested ? 'Anulowanie…' : 'Anuluj zadanie', { confirm: 'Anulować to zadanie? To, co już pobrano, zostanie w kopii.' }) : '',
    !isActive && !['paused', 'error', 'aborted'].includes(job.status) ? csrfForm(`/zadania/${job.id}/ponow`, 'Nowa wersja') : '',
  ].join('');

  const stat = (label, key, value) => `<div><div class="sub">${label}</div><div class="num" data-field="${key}">${value}</div></div>`;
  const logRows = log.map((l) => logRow(l)).join('');

  return `<div class="page-head">
<div class="min0"><a class="back" href="/zadania">← Zadania</a>
<h1>${e(job.name)}</h1>
<div class="mono">${e(job.url)}</div></div>
<div class="row-actions">${actions}</div>
</div>
${statusNotice(job)}
<div class="split" data-job-id="${job.id}" data-job-status="${e(job.status)}" data-log-after="${log.length ? log[log.length - 1].id : 0}">
<div class="main-col stack">
<section class="card pad stack" aria-labelledby="postep">
<div class="row-between"><h2 id="postep">Postęp</h2>${statusBadge(job.status)}</div>
<progress max="1" value="${s.progress.toFixed(3)}" data-field="progress" aria-label="Postęp"></progress>
<div class="stats">
${stat('Strony', 'pages', s.pages)}
${stat('Pliki', 'files', s.files)}
${stat('Rozmiar', 'bytes', e(formatSize(s.bytes)))}
${stat('Błędy', 'failed', s.failed)}
${stat('W kolejce', 'queued', s.queuedPages + s.queuedFiles)}
${stat('Czas', 'duration', e(formatDuration(s.durationMs)))}
</div>
</section>
<section class="card" aria-labelledby="dziennik">
<div class="pad row-between"><h2 id="dziennik">Dziennik</h2><span class="sub">ostatnie wpisy</span></div>
<div class="log" data-field="log">${logRows || '<div class="log-empty sub">Brak wpisów.</div>'}</div>
</section>
</div>
<aside class="side-col stack">
<section class="card pad"><h2>Ustawienia</h2>${settingsList(job)}<a class="small-link" href="/nowa?z=${job.id}">Nowa kopia z tymi ustawieniami</a></section>
<section class="card pad"><h2>Wersje</h2>${versions.length
    ? `<ul class="versions">${versions
        .map((v) => `<li><a href="${e(archiveBase)}/a/${e(job.name)}/${e(v.version)}/" target="_blank" rel="noopener noreferrer">${e(v.version)}</a><span class="sub">${v.bytes != null ? e(formatSize(v.bytes)) : ''}</span></li>`)
        .join('')}</ul>`
    : '<p class="sub">Jeszcze brak.</p>'}</section>
<section class="card pad"><h2>Informacje</h2><dl class="dl">
<dt>Dodane</dt><dd>${e(formatDate(job.createdAt))}</dd>
<dt>Start</dt><dd>${e(formatDate(job.startedAt))}</dd>
<dt>Koniec</dt><dd>${e(formatDate(job.finishedAt))}</dd>
${job.version ? `<dt>Wersja</dt><dd>${e(job.version)}</dd>` : ''}
${job.retryOf ? `<dt>Ponowienie</dt><dd><a href="/zadania/${job.retryOf}">#${job.retryOf}</a></dd>` : ''}
</dl></section>
</aside>
</div>`;
}

export function logRow(l) {
  const code = l.code === 'failed' || l.code === 'block' || l.code === 'paused' || l.level === 'error' ? 'warn' : '';
  return `<div class="log-row ${code}"><span class="sub">${e(formatTime(l.at))}</span><span class="log-msg">${e(l.message)}</span></div>`;
}

// ---------- logowanie i błędy ----------

export function loginPage({ error = null }) {
  return `<!doctype html>
<html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>Logowanie – EasyCopy</title>
<link rel="stylesheet" href="/static/app.css?v=${e(VERSION)}"></head>
<body class="center">
<main class="card pad login stack">
<div class="brand">${LOGO}<span>EasyCopy</span></div>
<h1>Logowanie</h1>
${error ? `<p class="notice" role="alert">${e(error)}</p>` : ''}
<form method="post" action="/logowanie" class="stack">
${field('password', 'Hasło', '<input id="password" name="password" type="password" autocomplete="current-password" required autofocus>')}
<button type="submit" class="btn primary">Zaloguj</button>
</form>
</main>
</body></html>`;
}

export function messagePage(title, text) {
  return `<div class="narrow"><h1>${e(title)}</h1><p class="lead">${e(text)}</p><p><a class="btn" href="/">← Archiwa</a></p></div>`;
}

export { MISSING_REASONS };
