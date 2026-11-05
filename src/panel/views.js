// Panel views (server-rendered HTML). All data is escaped; all text goes through t().

import { escapeHtml as e } from '../server/list-page.js';
import { LANGUAGES, localize } from '../shared/i18n.js';
import { PRESETS, PROJECT_URL, VERSION } from '../worker/settings.js';
import { DEPTH_OPTIONS, SIZE_OPTIONS } from './job-form.js';
import { logLabel } from './log-format.js';
import { FREQUENCIES, WEEKDAYS, describeSchedule } from './scheduler.js';

export const STATUS_DOTS = {
  queued: 'dashed',
  running: 'dashed',
  complete: 'full',
  limit: 'full',
  paused: 'ring',
  error: 'ring',
  aborted: 'ring',
  cancelled: 'ring',
};

const BROWSERS = ['easycopy', 'chrome', 'firefox', 'safari', 'edge', 'custom'];
const SYSTEMS = ['win', 'mac', 'linux', 'android', 'ios'];

const LOGO = `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="13" height="16" rx="2"/><path d="M8 8h3M8 12h3"/><path d="M16 8h3a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-9"/></svg>`;
const ICON_PLUS = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
const ICON_EXT = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4h6v6M20 4 11 13M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>';
const ICON_PAUSE = '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>';

// ---------- helpers ----------

function hostOf(url) {
  try {
    return new URL(url).host;
  } catch {
    return url ?? '';
  }
}

export function statusLabel(t, status) {
  return t.has(`status.${status}`) ? t(`status.${status}`) : status;
}

export function statusBadge(t, status) {
  return `<span class="status" data-field="status"><span class="dot ${STATUS_DOTS[status] ?? 'ring'}"></span><span>${e(statusLabel(t, status))}</span></span>`;
}

/** Progress 0–1: downloaded pages vs downloaded + waiting (at most the page limit). */
export function jobProgress(job) {
  if (job.status !== 'running') return job.status === 'queued' ? 0 : 1;
  const s = job.stats ?? {};
  const pages = s.pages ?? 0;
  let total = pages + (s.queuedPages ?? 0);
  const max = job.options?.maxPages;
  if (max > 0) total = Math.min(total, max);
  return total > 0 ? Math.min(1, pages / total) : 0;
}

function presetLabel(t, id) {
  return PRESETS[id] ? t(`presets.${id}.label`) : '—';
}

/** Job summary for the API and the views (texts already translated). */
export function jobSummary(t, job, archiveBase) {
  const s = job.stats ?? {};
  const scheduled = job.status === 'queued' && job.runAt > Date.now() + 1000;
  let detail;
  if (scheduled) detail = t('active.scheduledFor', { date: t.date(job.runAt) });
  else if (job.status === 'queued') detail = t('active.waiting');
  else {
    detail = `${t.count(s.pages ?? 0, 'units.pages')} · ${t.count(s.files ?? 0, 'units.files')} · ${t.size(s.bytes ?? 0)}`;
    if (s.queuedPages) detail += ` · ${t('active.queued', { count: s.queuedPages })}`;
  }
  const durationMs = job.startedAt ? (job.finishedAt ?? Date.now()) - job.startedAt : null;
  return {
    id: job.id,
    name: job.name,
    url: job.url,
    status: job.status,
    statusLabel: statusLabel(t, job.status),
    runAt: job.runAt,
    scheduled,
    progress: jobProgress(job),
    pages: s.pages ?? 0,
    files: s.files ?? 0,
    bytes: s.bytes ?? 0,
    bytesText: t.size(s.bytes ?? 0),
    failed: s.failed ?? 0,
    skipped: s.skipped ?? 0,
    queuedPages: s.queuedPages ?? 0,
    queuedFiles: s.queuedFiles ?? 0,
    detailText: detail,
    version: job.version,
    archiveUrl: job.version ? `${archiveBase}/a/${encodeURIComponent(job.name)}/${encodeURIComponent(job.version)}/` : null,
    error: job.error ? localize(t, job.error) : null,
    pause: job.pause,
    cancelRequested: job.cancelRequested,
    durationMs,
    durationText: t.duration(durationMs),
  };
}

/** Log entry for the API (translated). */
export function logEntry(t, l) {
  const { kind, problem } = logLabel(l);
  return { id: l.id, at: l.at, timeText: t.time(l.at), label: t(`log.labels.${logLabel(l).key}`), kind, problem, message: localize(t, l.message) };
}

function csrfForm(action, label, { cls = 'btn', confirm = null, fields = {} } = {}) {
  const hidden = Object.entries(fields).map(([k, v]) => `<input type="hidden" name="${e(k)}" value="${e(v)}">`).join('');
  return `<form method="post" action="${e(action)}" class="inline"${confirm ? ` data-confirm="${e(confirm)}"` : ''}>${hidden}<button type="submit" class="${cls}">${label}</button></form>`;
}

function languageLinks(t, path = '') {
  return `<nav class="lang-links" aria-label="${e(t('common.language'))}">${Object.entries(LANGUAGES)
    .map(([code, name]) => (code === t.lang ? `<strong>${e(name)}</strong>` : `<a href="${e(path)}?lang=${code}" hreflang="${code}" lang="${code}">${e(name)}</a>`))
    .join('<span aria-hidden="true">·</span>')}</nav>`;
}

// ---------- layout ----------

export function layout(t, { title, active = '', body, user = null, warning = null }) {
  const nav = [
    ['/', t('nav.archives'), 'archiwa'],
    ['/zadania', t('nav.jobs'), 'zadania'],
    ['/harmonogram', t('nav.schedule'), 'harmonogram'],
    ['/powiadomienia', t('nav.notifications'), 'powiadomienia'],
  ]
    .map(([href, label, key]) => `<a href="${href}"${active === key ? ' class="active" aria-current="page"' : ''}>${e(label)}</a>`)
    .join('');
  return `<!doctype html>
<html lang="${t.lang}">
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
<nav aria-label="${e(t('nav.main'))}">${nav}</nav>
<div class="bar-actions">
${user ? `<a href="/konto" class="user-link"${active === 'konto' ? ' aria-current="page"' : ''}>${e(user.username)}</a>${csrfForm('/wyloguj', e(t('common.logout')), { cls: 'link' })}` : ''}
<a href="/nowa" class="btn primary">${ICON_PLUS}${e(t('common.newCopy'))}</a>
</div>
</div>
</header>
${warning ? `<div class="wrap"><p class="notice" role="alert">${e(localize(t, warning))}</p></div>` : ''}
<main class="wrap">
${body}
</main>
<footer class="wrap foot">EasyCopy ${e(VERSION)} · <a href="${e(PROJECT_URL)}" rel="noopener noreferrer">${e(t('common.sourceCode'))}</a> ${e(t('common.license'))}</footer>
</body>
</html>
`;
}

// ---------- Archives ----------

function activeJobCard(t, job, archiveBase) {
  const s = jobSummary(t, job, archiveBase);
  const action = job.status === 'running'
    ? csrfForm(`/zadania/${s.id}/anuluj`, e(t('active.stop')), { confirm: t('active.stopConfirm') })
    : csrfForm(`/zadania/${s.id}/anuluj`, e(t('active.removeQueued')), { confirm: t('active.removeQueuedConfirm') });
  return `<div class="job-row" data-job="${s.id}">
<div class="job-name"><div class="strong">${e(job.name)}</div><div class="mono">${e(hostOf(job.url))}</div></div>
<div class="job-progress">
<progress max="1" value="${s.progress.toFixed(3)}" data-field="progress" aria-label="${e(t('active.progress'))}"></progress>
<div class="row-meta"><span data-field="detail">${e(s.detailText)}</span><span>${e(t('active.preset', { name: presetLabel(t, job.options?.preset) }))}</span></div>
</div>
<div class="job-actions"><a class="btn" href="/zadania/${s.id}">${e(t('common.details'))}</a>${action}</div>
</div>`;
}

export function archivesPage(t, { archives, activeJobs, latestJobs, archiveBase, schedules = new Map() }) {
  const active = activeJobs.length
    ? `<section class="card pad" aria-labelledby="w-toku" data-poll="active">
<h2 id="w-toku">${e(t('archives.inProgress'))}</h2>
${activeJobs.map((j) => activeJobCard(t, j, archiveBase)).join('\n')}
</section>`
    : '<section data-poll="active" hidden></section>';

  const total = archives.reduce((sum, a) => sum + (a.latestInfo?.bytes ?? 0), 0);
  const activeByName = new Map(activeJobs.map((j) => [j.name, j]));
  const rows = archives
    .map((a) => {
      const info = a.latestInfo ?? {};
      const jobId = latestJobs.get(a.name);
      const activeJob = activeByName.get(a.name);
      // a version that is still downloading has no manifest yet
      const status = activeJob && activeJob.version === a.latest ? 'running' : info.status && STATUS_DOTS[info.status] ? info.status : null;
      const older = a.versions.filter((v) => v.version !== a.latest);
      const sched = schedules.get(a.name);
      return `<tr>
<td><div class="strong">${e(a.name)}</div><div class="mono">${e(hostOf(a.startUrl))}</div></td>
<td>${e(t.date(info.createdAt ? Date.parse(info.createdAt) : null))}<div class="sub">${e(a.latest)}</div>${sched ? `<div class="sub">↻ ${e(describeSchedule(t, sched))}${sched.enabled ? '' : ` (${e(t('common.paused'))})`}</div>` : ''}</td>
<td>${a.versions.length}${older.length ? `<details><summary>${e(t('archives.older'))}</summary><ul class="plain">${older.map((v) => `<li><a href="${e(archiveBase)}/a/${e(a.name)}/${e(v.version)}/" target="_blank" rel="noopener noreferrer">${e(v.version)}</a></li>`).join('')}</ul></details>` : ''}</td>
<td>${info.pages ?? '—'}</td>
<td>${info.bytes != null ? e(t.size(info.bytes)) : '—'}</td>
<td>${status ? statusBadge(t, status) : '—'}</td>
<td class="actions">
<a class="btn" href="${e(archiveBase)}/a/${e(a.name)}/" target="_blank" rel="noopener noreferrer">${e(t('common.open'))} ${ICON_EXT}</a>
${jobId && !activeJob ? csrfForm(`/zadania/${jobId}/ponow`, e(t('archives.newVersion'))) : ''}
${jobId ? `<a class="btn" href="/zadania/${jobId}">${e(t('common.details'))}</a>` : ''}
${activeJob ? '' : csrfForm(`/archiwa/${a.name}/usun`, e(t('common.delete')), { cls: 'btn quiet', confirm: t('archives.deleteConfirm', { name: a.name, count: a.versions.length }) })}
</td>
</tr>`;
    })
    .join('\n');

  const table = archives.length
    ? `<div class="scroll"><table>
<thead><tr><th>${e(t('archives.colSite'))}</th><th>${e(t('archives.colLastCopy'))}</th><th>${e(t('archives.colVersions'))}</th><th>${e(t('archives.colPages'))}</th><th>${e(t('archives.colSize'))}</th><th>${e(t('archives.colStatus'))}</th><th class="actions">${e(t('archives.colActions'))}</th></tr></thead>
<tbody>${rows}</tbody></table></div>`
    : `<div class="empty"><p>${e(t('archives.empty'))}</p><a class="btn primary" href="/nowa">${ICON_PLUS}${e(t('archives.firstCopy'))}</a></div>`;

  const where = archiveBase
    ? e(t('archives.availableAt', { url: '\u0000' })).replace('\u0000', `<span class="mono">${e(archiveBase)}</span>`)
    : e(t('archives.availableSamePort', { path: '\u0000' })).replace('\u0000', '<span class="mono">/a/&lt;name&gt;/</span>');

  return `<div class="page-head">
<div><h1>${e(t('archives.title'))}</h1><p class="lead">${e(t('archives.lead'))}</p></div>
<div class="kpis"><span><strong>${archives.length}</strong> ${e(t('units.archives', { count: archives.length }))}</span><span><strong>${e(t.size(total))}</strong> ${e(t('archives.used'))}</span></div>
</div>
${active}
<section class="card" aria-label="${e(t('archives.allArchives'))}">${table}</section>
<p class="sub">${where}</p>`;
}

// ---------- form ----------

function field(t, name, label, input, { error, hint } = {}) {
  return `<div class="field${error ? ' has-error' : ''}">
<label for="${e(name)}">${e(label)}</label>
${input}
${hint ? `<span class="hint">${e(hint)}</span>` : ''}
${error ? `<span class="error" id="${e(name)}-error">${e(t(error))}</span>` : ''}
</div>`;
}

function select(name, options, value, attrs = '') {
  return `<select id="${e(name)}" name="${e(name)}" ${attrs}>${options
    .map((o) => `<option value="${e(o.value)}"${String(o.value) === String(value) ? ' selected' : ''}>${e(o.label)}</option>`)
    .join('')}</select>`;
}

function checkbox(name, label, checked, hint = '') {
  return `<label class="check"><input type="checkbox" name="${e(name)}"${checked ? ' checked' : ''}><span>${e(label)}${hint ? ` <span class="sub">${e(hint)}</span>` : ''}</span></label>`;
}

const MODE_KEYS = { new: 'new', retry: 'retry', 'edit-job': 'editJob', schedule: 'schedule' };

/**
 * Copy settings form. Modes:
 *   new       – a new copy (default)
 *   retry     – change settings and download again (from a finished job)
 *   edit-job  – change a job that is still queued
 *   schedule  – edit a schedule
 */
export function newJobPage(t, { values, errors = {}, mode = 'new', action = '/nowa', back = '/' }) {
  const presets = Object.keys(PRESETS)
    .map(
      (id) => `<label class="preset">
<input type="radio" name="preset" value="${id}"${values.preset === id ? ' checked' : ''}>
<span class="preset-box"><span class="strong">${e(t(`presets.${id}.label`))}</span><span class="sub">${e(t(`presets.${id}.rate`))}</span><span class="sub">${e(t(`presets.${id}.desc`))}</span></span>
</label>`,
    )
    .join('');
  const advancedOpen = Boolean(errors.ua || errors.os || errors.customUa || values.skip || values.exclude || !values.respectRobots || values.allowJs || values.externalNewTab || values.ua !== 'easycopy');
  const mk = `form.modes.${MODE_KEYS[mode]}`;
  const showSchedule = mode !== 'edit-job';
  const nameLocked = mode === 'schedule';
  const repeatOptions = ['none', ...Object.keys(FREQUENCIES)].map((value) => ({ value, label: t(`frequencies.${value}`) }));
  if (mode === 'schedule') repeatOptions.shift();
  const monthdays = Array.from({ length: 28 }, (_, i) => ({ value: String(i + 1), label: `${i + 1}.` }));
  const depthOptions = DEPTH_OPTIONS.map((d) => ({ value: d.value, label: t(`depth.${d.value === 'bez-limitu' ? 'all' : d.value}`) }));
  const sizeOptions = SIZE_OPTIONS.map((s) => ({ value: s.value, label: s.value === '0' ? t('sizeLimit.none') : s.label }));

  return `<div class="narrow wide">
<a class="back" href="${e(back)}">${e(t('common.back'))}</a>
<h1>${e(t(`${mk}.title`))}</h1>
<p class="lead">${e(t(`${mk}.lead`))}</p>
${Object.keys(errors).length ? `<p class="notice" role="alert">${e(t('form.fixErrors'))}</p>` : ''}
<form method="post" action="${e(action)}" class="stack" novalidate>
${mode === 'retry' ? '<input type="hidden" name="_mode" value="retry">' : ''}

<section class="card pad stack">
${field(t, 'url', t('form.url'), `<input id="url" name="url" type="url" inputmode="url" class="mono-input" value="${e(values.url)}" placeholder="https://www.example.com/" required${errors.url ? ' aria-invalid="true" aria-describedby="url-error"' : ''}>`, { error: errors.url })}
${nameLocked
    ? `<div class="field"><span class="label">${e(t('form.name'))}</span><div class="mono">${e(values.name)}</div><input type="hidden" name="name" value="${e(values.name)}"></div>`
    : field(t, 'name', t('form.name'), `<input id="name" name="name" type="text" value="${e(values.name)}" placeholder="${e(t('form.namePlaceholder'))}">`, { hint: t('form.nameHint') })}
</section>

<section class="card pad stack" aria-labelledby="tempo">
<div><h2 id="tempo">${e(t('form.speed'))}</h2><p class="sub">${e(t('form.speedHint'))}</p></div>
<div class="presets" role="radiogroup" aria-labelledby="tempo">${presets}</div>
${errors.preset ? `<span class="error">${e(t(errors.preset))}</span>` : ''}
</section>

<section class="card pad stack" aria-labelledby="zakres">
<h2 id="zakres">${e(t('form.scope'))}</h2>
<div class="grid4">
${field(t, 'depth', t('form.depth'), select('depth', depthOptions, values.depth), { error: errors.depth, hint: t('form.depthHint') })}
${field(t, 'maxPages', t('form.maxPages'), `<input id="maxPages" name="maxPages" type="number" min="0" value="${e(values.maxPages)}">`, { error: errors.maxPages, hint: t('form.maxPagesHint') })}
${field(t, 'maxSize', t('form.maxSize'), select('maxSize', sizeOptions, values.maxSize), { error: errors.maxSize })}
</div>
${checkbox('sameDomain', t('form.sameDomain'), values.sameDomain, t('form.sameDomainHint'))}
</section>

${showSchedule ? `<section class="card pad stack" aria-labelledby="powtarzaj" data-schedule>
<div><h2 id="powtarzaj">${e(t('form.repeat'))}</h2><p class="sub">${e(t('form.repeatHint'))}</p></div>
<div class="grid4">
${field(t, 'repeat', t('form.frequency'), select('repeat', repeatOptions, values.repeat, 'data-repeat'), { error: errors.repeat })}
<div data-repeat-show="weekly"${values.repeat === 'weekly' ? '' : ' hidden'}>${field(t, 'weekday', t('form.weekday'), select('weekday', WEEKDAYS.map((w) => ({ value: String(w), label: t(`weekdays.${w}.long`) })), values.weekday), { error: errors.weekday })}</div>
<div data-repeat-show="monthly"${values.repeat === 'monthly' ? '' : ' hidden'}>${field(t, 'monthday', t('form.monthday'), select('monthday', monthdays, values.monthday), { error: errors.monthday })}</div>
<div data-repeat-show="daily weekly monthly"${values.repeat === 'none' ? ' hidden' : ''}>${field(t, 'time', t('form.time'), `<input id="time" name="time" type="time" value="${e(values.time)}">`, { error: errors.time })}</div>
</div>
</section>` : ''}

<details class="card"${advancedOpen ? ' open' : ''}>
<summary data-expand="${e(t('form.expand'))}" data-collapse="${e(t('form.collapse'))}">${e(t('form.advanced'))}</summary>
<div class="pad stack">
<fieldset class="stack">
<legend>${e(t('form.identification'))}</legend>
<div class="grid2">
${field(t, 'ua', t('form.browser'), select('ua', BROWSERS.map((value) => ({ value, label: t(`browsers.${value}`) })), values.ua, 'data-ua-browser'), { error: errors.ua })}
${field(t, 'os', t('form.system'), select('os', SYSTEMS.map((value) => ({ value, label: t(`systems.${value}`) })), values.os, 'data-ua-os'), { error: errors.os })}
</div>
<div data-ua-custom${values.ua === 'custom' ? '' : ' hidden'}>
${field(t, 'customUa', t('form.customUa'), `<input id="customUa" name="customUa" type="text" class="mono-input" value="${e(values.customUa)}" placeholder="MyApp/1.0 (+https://example.com/bot)">`, { error: errors.customUa })}
</div>
<p class="sub">${e(t('form.uaHint'))}</p>
</fieldset>
${checkbox('respectRobots', t('form.respectRobots'), values.respectRobots)}
${checkbox('allowJs', t('form.allowJs'), values.allowJs, t('form.allowJsHint'))}
${checkbox('externalNewTab', t('form.externalNewTab'), values.externalNewTab)}
${field(t, 'skip', t('form.skip'), `<input id="skip" name="skip" type="text" class="mono-input" value="${e(values.skip)}" placeholder="mp4, zip, iso">`)}
${field(t, 'exclude', t('form.exclude'), `<input id="exclude" name="exclude" type="text" class="mono-input" value="${e(values.exclude)}" placeholder="/cart/*, /account/*">`)}
</div>
</details>

<div class="form-actions">
<a class="btn" href="${e(back)}">${e(t('common.cancel'))}</a>
<button type="submit" class="btn primary">${e(t(`${mk}.submit`))}</button>
</div>
</form>
</div>`;
}

// ---------- Jobs ----------

export function jobsPage(t, { jobs }) {
  const rows = jobs
    .map((j) => {
      const s = j.stats ?? {};
      return `<tr>
<td class="sub">#${j.id}</td>
<td><a class="strong" href="/zadania/${j.id}">${e(j.name)}</a><div class="mono">${e(hostOf(j.url))}</div></td>
<td>${statusBadge(t, j.status)}</td>
<td>${e(t.date(j.createdAt))}</td>
<td>${e(t.duration(j.startedAt ? (j.finishedAt ?? Date.now()) - j.startedAt : null))}</td>
<td>${s.pages ?? '—'}</td>
<td>${s.bytes != null ? e(t.size(s.bytes)) : '—'}</td>
</tr>`;
    })
    .join('\n');
  return `<div class="page-head"><div><h1>${e(t('jobs.title'))}</h1><p class="lead">${e(t('jobs.lead'))}</p></div></div>
<section class="card">${jobs.length
    ? `<div class="scroll"><table><thead><tr><th>#</th><th>${e(t('archives.colSite'))}</th><th>${e(t('archives.colStatus'))}</th><th>${e(t('jobs.colAdded'))}</th><th>${e(t('jobs.colTime'))}</th><th>${e(t('archives.colPages'))}</th><th>${e(t('archives.colSize'))}</th></tr></thead><tbody>${rows}</tbody></table></div>`
    : `<div class="empty"><p>${e(t('jobs.empty'))}</p><a class="btn primary" href="/nowa">${ICON_PLUS}${e(t('common.newCopy'))}</a></div>`}
</section>`;
}

// ---------- Job details ----------

function settingsList(t, job) {
  const o = job.options ?? {};
  const L = (k) => t(`settingsList.${k}`);
  const ua = o.userAgent
    ? L('uaCustom')
    : `${t(`browsers.${o.browser ?? 'easycopy'}`).replace(/ \(.*\)$/, '')}${o.browser && o.browser !== 'easycopy' ? ` · ${t(`systems.${o.os ?? 'win'}`)}` : ''}`;
  const rows = [
    [L('speed'), PRESETS[o.preset] ? `${t(`presets.${o.preset}.label`)} (${t(`presets.${o.preset}.rate`)})` : '—'],
    [L('depth'), o.maxDepth == null || o.maxDepth < 0 ? L('noLimit') : String(o.maxDepth)],
    [L('limit'), `${o.maxPages ? t.count(o.maxPages, 'units.pages') : L('noPageLimit')} · ${o.maxBytes ? t.size(o.maxBytes) : L('noSizeLimit')}`],
    [L('scope'), o.subdomains ? L('withSubdomains') : L('thisDomain')],
    [L('robots'), o.respectRobots === false ? L('ignored') : L('respected')],
    [L('js'), o.allowJavaScript ? L('jsOn') : L('jsOff')],
    [L('ua'), ua],
  ];
  if (o.skipExtensions?.length) rows.push([L('skipped'), o.skipExtensions.join(', ')]);
  if (o.exclude?.length) rows.push([L('excluded'), o.exclude.join(', ')]);
  return `<dl class="dl">${rows.map(([k, v]) => `<dt>${e(k)}</dt><dd>${e(v)}</dd>`).join('')}</dl>`;
}

function statusNotice(t, job) {
  if (job.status === 'paused') {
    const p = job.pause ?? {};
    const reason = t(p.type === 'challenge' ? 'job.reasonChallenge' : 'job.reasonRate');
    return `<section class="card pad notice-card" role="status">
${ICON_PAUSE}
<div class="grow"><div class="strong">${e(t('job.pausedTitle', { reason }))}</div>
<p class="sub">${e(localize(t, p.message ?? ''))}${p.host ? ` (${e(p.host)})` : ''}. ${e(t('job.pausedText'))}</p></div>
<div class="row-actions">
${csrfForm(`/zadania/${job.id}/ponow`, e(t('job.retryGentle')), { cls: 'btn primary', fields: { preset: 'delikatny' } })}
${csrfForm(`/zadania/${job.id}/ponow`, e(t('job.retryLater')), { fields: { preset: 'delikatny', delay: '600' } })}
</div>
</section>`;
  }
  if (job.status === 'error' || job.status === 'aborted') {
    return `<section class="card pad notice-card" role="status"><div class="grow"><div class="strong">${e(statusLabel(t, job.status))}</div><p class="sub">${e(localize(t, job.error ?? ''))}</p></div>
<div class="row-actions">${csrfForm(`/zadania/${job.id}/ponow`, e(t('job.retry')), { cls: 'btn primary' })}</div></section>`;
  }
  return '';
}

export function jobPage(t, { job, log, versions, archiveBase, schedule = null }) {
  const s = jobSummary(t, job, archiveBase);
  const isActive = job.status === 'queued' || job.status === 'running';
  const actions = [
    s.archiveUrl ? `<a class="btn" href="${e(s.archiveUrl)}" target="_blank" rel="noopener noreferrer" data-field="archive-link">${e(t('job.openCopy'))} ${ICON_EXT}</a>` : '',
    job.status === 'running' ? csrfForm(`/zadania/${job.id}/anuluj`, e(t(s.cancelRequested ? 'job.stopping' : 'job.stop')), { confirm: t('active.stopConfirm') }) : '',
    job.status === 'queued' ? `<a class="btn" href="/zadania/${job.id}/edytuj">${e(t('job.changeSettings'))}</a>` : '',
    job.status === 'queued' ? csrfForm(`/zadania/${job.id}/anuluj`, e(t('active.removeQueued')), { confirm: t('active.removeQueuedConfirm') }) : '',
    !isActive ? `<a class="btn" href="/nowa?z=${job.id}">${e(t('job.changeSettings'))}</a>` : '',
    !isActive && !['paused', 'error', 'aborted'].includes(job.status) ? csrfForm(`/zadania/${job.id}/ponow`, e(t('archives.newVersion'))) : '',
    !isActive ? csrfForm(`/zadania/${job.id}/usun`, e(t('job.deleteHistory')), { cls: 'btn quiet', confirm: t('job.deleteHistoryConfirm') }) : '',
  ].join('');

  const stat = (label, key, value) => `<div><div class="sub">${e(label)}</div><div class="num" data-field="${key}">${e(value)}</div></div>`;
  const logRows = log.map((l) => logRow(t, l)).join('');

  return `<div class="page-head">
<div class="min0"><a class="back" href="/zadania">${e(t('job.back'))}</a>
<h1>${e(job.name)}</h1>
<div class="mono">${e(job.url)}</div></div>
<div class="row-actions">${actions}</div>
</div>
${statusNotice(t, job)}
<div class="split" data-job-id="${job.id}" data-job-status="${e(job.status)}" data-log-after="${log.length ? log[log.length - 1].id : 0}">
<div class="main-col stack">
<section class="card pad stack" aria-labelledby="postep">
<div class="row-between"><h2 id="postep">${e(t('job.progress'))}</h2>${statusBadge(t, job.status)}</div>
<progress max="1" value="${s.progress.toFixed(3)}" data-field="progress" aria-label="${e(t('job.progress'))}"></progress>
<div class="stats">
${stat(t('job.statPages'), 'pages', s.pages)}
${stat(t('job.statFiles'), 'files', s.files)}
${stat(t('job.statSize'), 'bytes', s.bytesText)}
${stat(t('job.statErrors'), 'failed', s.failed)}
${stat(t('job.statQueued'), 'queued', s.queuedPages + s.queuedFiles)}
${stat(t('job.statTime'), 'duration', s.durationText)}
</div>
</section>
<section class="card" aria-labelledby="dziennik">
<div class="pad row-between"><h2 id="dziennik">${e(t('job.log'))}</h2>
<label class="log-filter">${e(t('job.show'))} <select data-log-filter><option value="all">${e(t('job.showAll'))}</option><option value="problems">${e(t('job.showProblems'))}</option></select></label></div>
<div class="log" data-field="log">${logRows || `<div class="log-empty sub">${e(t('job.noEntries'))}</div>`}</div>
</section>
</div>
<aside class="side-col stack">
<section class="card pad"><h2>${e(t('job.settings'))}</h2>${settingsList(t, job)}<a class="small-link" href="${job.status === 'queued' ? `/zadania/${job.id}/edytuj` : `/nowa?z=${job.id}`}">${e(t('job.changeSettings'))}</a></section>
<section class="card pad"><h2>${e(t('job.schedule'))}</h2>${schedule
    ? `<p class="schedule-line">↻ ${e(describeSchedule(t, schedule))}${schedule.enabled ? '' : ` <span class="sub">(${e(t('common.paused'))})</span>`}</p>
<p class="sub">${e(schedule.enabled ? t('job.nextRun', { date: t.date(schedule.nextRunAt) }) : t('job.schedulePaused'))}</p>
<a class="small-link" href="/harmonogram/${schedule.id}/edytuj">${e(t('job.editSchedule'))}</a>`
    : `<p class="sub">${e(t('job.once'))}</p><a class="small-link" href="/nowa?z=${job.id}">${e(t('job.setRepeat'))}</a>`}</section>
<section class="card pad"><h2>${e(t('job.versions'))}</h2>${versions.length
    ? `<ul class="versions">${versions
        .map((v) => {
          const building = isActive && job.version === v.version;
          return `<li><a href="${e(archiveBase)}/a/${e(job.name)}/${e(v.version)}/" target="_blank" rel="noopener noreferrer">${e(v.version)}</a><span class="v-meta"><span class="sub">${v.bytes != null ? e(t.size(v.bytes)) : ''}</span>${building ? '' : csrfForm(`/archiwa/${job.name}/${v.version}/usun`, e(t('common.delete')), { cls: 'link small', confirm: t('job.deleteVersionConfirm', { version: v.version }) })}</span></li>`;
        })
        .join('')}</ul>`
    : `<p class="sub">${e(t('job.noVersions'))}</p>`}</section>
<section class="card pad"><h2>${e(t('job.info'))}</h2><dl class="dl">
<dt>${e(t('job.added'))}</dt><dd>${e(t.date(job.createdAt))}</dd>
<dt>${e(t('job.start'))}</dt><dd>${e(t.date(job.startedAt))}</dd>
<dt>${e(t('job.end'))}</dt><dd>${e(t.date(job.finishedAt))}</dd>
${job.version ? `<dt>${e(t('job.version'))}</dt><dd>${e(job.version)}</dd>` : ''}
${job.retryOf ? `<dt>${e(t('job.retryOf'))}</dt><dd><a href="/zadania/${job.retryOf}">#${job.retryOf}</a></dd>` : ''}
${job.scheduleId ? `<dt>${e(t('job.source'))}</dt><dd>${e(t('job.fromSchedule'))}</dd>` : ''}
</dl></section>
</aside>
</div>`;
}

export function logRow(t, l) {
  const x = logEntry(t, l);
  return `<div class="log-row k-${x.kind}${x.problem ? ' problem' : ''}"><span class="sub">${e(x.timeText)}</span><span class="log-label">${e(x.label)}</span><span class="log-msg">${e(x.message)}</span></div>`;
}

// ---------- Schedule ----------

export function schedulesPage(t, { schedules, saved = null }) {
  const rows = schedules
    .map((s) => `<tr>
<td><div class="strong">${e(s.name)}</div><div class="mono">${e(hostOf(s.url))}</div></td>
<td>${e(describeSchedule(t, s))}</td>
<td>${s.enabled ? e(t.date(s.nextRunAt)) : `<span class="sub">${e(t('common.paused'))}</span>`}</td>
<td>${s.lastJobId ? `<a href="/zadania/${s.lastJobId}">#${s.lastJobId}</a>` : '—'}</td>
<td><span class="status"><span class="dot ${s.enabled ? 'full' : 'ring'}"></span><span>${e(t(s.enabled ? 'status.scheduleActive' : 'status.schedulePaused'))}</span></span></td>
<td class="actions">
<a class="btn" href="/harmonogram/${s.id}/edytuj">${e(t('common.edit'))}</a>
${csrfForm(`/harmonogram/${s.id}/${s.enabled ? 'wstrzymaj' : 'wznow'}`, e(t(s.enabled ? 'schedules.pause' : 'schedules.resume')))}
${csrfForm(`/harmonogram/${s.id}/usun`, e(t('common.delete')), { cls: 'btn quiet', confirm: t('schedules.deleteConfirm', { name: s.name }) })}
</td>
</tr>`)
    .join('\n');
  return `<div class="page-head"><div><h1>${e(t('schedules.title'))}</h1><p class="lead">${e(t('schedules.lead'))}</p></div></div>
${saved ? `<p class="notice" role="status">${e(saved)}</p>` : ''}
<section class="card">${schedules.length
    ? `<div class="scroll"><table><thead><tr><th>${e(t('archives.colSite'))}</th><th>${e(t('schedules.colRepeat'))}</th><th>${e(t('schedules.colNext'))}</th><th>${e(t('schedules.colLast'))}</th><th>${e(t('archives.colStatus'))}</th><th class="actions">${e(t('archives.colActions'))}</th></tr></thead><tbody>${rows}</tbody></table></div>`
    : `<div class="empty"><p>${e(t('schedules.empty'))}</p><p class="sub">${e(t('schedules.emptyHint'))}</p><a class="btn primary" href="/nowa">${ICON_PLUS}${e(t('common.newCopy'))}</a></div>`}
</section>`;
}

// ---------- Notifications ----------

export function notificationsPage(t, { settings, errors = {}, message = null }) {
  const ch = settings.channels;
  const secret = (name, label, value, hint) =>
    field(t, name, label, `<input id="${name}" name="${name}" type="password" autocomplete="off" value="" placeholder="${value ? e(t('notifications.secretKept')) : ''}">`, { hint, error: errors[name] });
  const text = (name, label, value, { hint, placeholder = '' } = {}) =>
    field(t, name, label, `<input id="${name}" name="${name}" type="url" class="mono-input" value="${e(value ?? '')}" placeholder="${e(placeholder)}">`, { hint, error: errors[name] });
  const channel = (id, title, body) => `<fieldset class="stack channel">
<legend>${e(title)}</legend>
${checkbox(`${id}.enabled`, t('notifications.enabled'), ch[id].enabled)}
${body}
</fieldset>`;

  return `<div class="narrow wide">
<h1>${e(t('notifications.title'))}</h1>
<p class="lead">${e(t('notifications.lead'))}</p>
${message ? `<p class="notice" role="status">${e(message)}</p>` : ''}
${Object.keys(errors).length ? `<p class="notice" role="alert">${e(t('form.fixErrors'))}</p>` : ''}
<form method="post" action="/powiadomienia" class="stack" novalidate>
<section class="card pad stack">
<h2>${e(t('notifications.events'))}</h2>
<div class="grid2">
${checkbox('ev.complete', t('notifications.evComplete'), settings.events.complete)}
${checkbox('ev.limit', t('notifications.evLimit'), settings.events.limit)}
${checkbox('ev.paused', t('notifications.evPaused'), settings.events.paused)}
${checkbox('ev.error', t('notifications.evError'), settings.events.error)}
</div>
${checkbox('scheduledOnly', t('notifications.scheduledOnly'), settings.scheduledOnly)}
${text('panelUrl', t('notifications.panelUrl'), settings.panelUrl, { hint: t('notifications.panelUrlHint'), placeholder: 'https://easycopy.example.com' })}
</section>
<section class="card pad stack">
<h2>${e(t('notifications.channels'))}</h2>
<div class="channels">
${channel('ntfy', 'ntfy', `${text('ntfy.url', t('notifications.ntfyUrl'), ch.ntfy.url, { hint: t('notifications.ntfyUrlHint'), placeholder: 'https://ntfy.sh/…' })}${secret('ntfy.token', t('notifications.ntfyToken'), ch.ntfy.token)}`)}
${channel('gotify', 'Gotify', `${text('gotify.url', t('notifications.gotifyUrl'), ch.gotify.url, { placeholder: 'https://gotify.example.com' })}${secret('gotify.token', t('notifications.gotifyToken'), ch.gotify.token)}`)}
${channel('pushover', 'Pushover', `${secret('pushover.user', t('notifications.pushoverUser'), ch.pushover.user)}${secret('pushover.token', t('notifications.pushoverToken'), ch.pushover.token)}`)}
${channel('discord', 'Discord', secret('discord.url', t('notifications.discordUrl'), ch.discord.url))}
${channel('webhook', t('notifications.webhookTitle'), text('webhook.url', t('notifications.webhookUrl'), ch.webhook.url, { hint: t('notifications.webhookHint'), placeholder: 'https://example.com/hook' }))}
</div>
<p class="sub">${e(t('notifications.tokensNote'))}</p>
</section>
<div class="form-actions">
<button type="submit" name="action" value="save" class="btn primary first">${e(t('notifications.save'))}</button>
<button type="submit" name="action" value="test" class="btn">${e(t('notifications.test'))}</button>
</div>
</form>
</div>`;
}

// ---------- setup, sign-in, account ----------

/** Simple page without the menu (setup, sign-in). */
function authShell(t, title, body, path) {
  return `<!doctype html>
<html lang="${t.lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>${e(title)} – EasyCopy</title>
<link rel="stylesheet" href="/static/app.css?v=${e(VERSION)}"></head>
<body class="center">
<main class="card pad login stack">
<div class="row-between"><div class="brand">${LOGO}<span>EasyCopy</span></div>${languageLinks(t, path)}</div>
${body}
</main>
</body></html>`;
}

function errorList(t, errors) {
  const list = Object.values(errors).filter(Boolean).map((x) => t(x.key ?? x, x.params ?? {}));
  return list.length ? `<p class="notice" role="alert">${list.map(e).join('<br>')}</p>` : '';
}

const passwordInput = (name, autocomplete, extra = '') =>
  `<input id="${name}" name="${name}" type="password" autocomplete="${autocomplete}" minlength="8" required${extra}>`;

export function setupPage(t, { values = {}, errors = {} }) {
  return authShell(t, t('setup.title'), `<div class="stack-tight">
<p class="step">${e(t('setup.step'))}</p>
<h1>${e(t('setup.heading'))}</h1>
<p class="sub">${e(t('setup.lead'))}</p>
</div>
${errorList(t, errors)}
<form method="post" action="/instalacja" class="stack" novalidate>
${field(t, 'username', t('setup.username'), `<input id="username" name="username" type="text" autocomplete="username" autocapitalize="none" spellcheck="false" value="${e(values.username ?? 'admin')}" required${errors.username ? ' aria-invalid="true"' : ''}>`, { hint: t('setup.usernameHint') })}
${field(t, 'password', t('setup.password'), passwordInput('password', 'new-password', errors.password ? ' aria-invalid="true"' : ''), { hint: t('setup.passwordHint') })}
${field(t, 'repeat', t('setup.repeat'), passwordInput('repeat', 'new-password'))}
<button type="submit" class="btn primary">${e(t('setup.submit'))}</button>
</form>
<p class="sub">${e(t('setup.forgot', { cmd: '\u0000' })).replace('\u0000', '<code>easycopy reset-password</code>')}</p>`, '/instalacja');
}

export function loginPage(t, { error = null, username = '' }) {
  return authShell(t, t('login.title'), `<h1>${e(t('login.title'))}</h1>
${error ? `<p class="notice" role="alert">${e(t(error))}</p>` : ''}
<form method="post" action="/logowanie" class="stack">
${field(t, 'username', t('setup.username'), `<input id="username" name="username" type="text" autocomplete="username" autocapitalize="none" spellcheck="false" value="${e(username)}" required${username ? '' : ' autofocus'}>`)}
${field(t, 'password', t('setup.password'), `<input id="password" name="password" type="password" autocomplete="current-password" required${username ? ' autofocus' : ''}>`)}
<button type="submit" class="btn primary">${e(t('login.submit'))}</button>
</form>`, '/logowanie');
}

export function accountPage(t, { user, errors = {}, saved = null }) {
  return `<div class="narrow">
<div><h1>${e(t('account.title'))}</h1><p class="lead">${e(t('account.signedInAs', { user: '\u0000' })).replace('\u0000', `<strong>${e(user.username)}</strong>`)}</p></div>
${saved ? `<p class="notice" role="status">${e(saved)}</p>` : ''}
${errorList(t, errors)}
<form method="post" action="/konto/jezyk" class="card pad stack">
<h2>${e(t('common.language'))}</h2>
<div class="grid2">
${field(t, 'language', t('common.language'), select('language', Object.entries(LANGUAGES).map(([value, label]) => ({ value, label })), t.lang), { hint: t('account.languageHint') })}
</div>
<div class="form-actions"><button type="submit" class="btn">${e(t('common.save'))}</button></div>
</form>
<form method="post" action="/konto" class="card pad stack">
<h2>${e(t('account.changePassword'))}</h2>
${field(t, 'current', t('account.current'), '<input id="current" name="current" type="password" autocomplete="current-password" required>')}
<div class="grid2">
${field(t, 'password', t('account.newPassword'), passwordInput('password', 'new-password'), { hint: t('setup.passwordHint') })}
${field(t, 'repeat', t('account.repeatNew'), passwordInput('repeat', 'new-password'))}
</div>
<div class="form-actions"><button type="submit" class="btn primary">${e(t('account.submit'))}</button></div>
</form>
<section class="card pad stack">
<h2>${e(t('account.info'))}</h2>
<dl class="dl"><dt>${e(t('account.created'))}</dt><dd>${e(t.date(user.created_at))}</dd><dt>${e(t('account.lastLogin'))}</dt><dd>${e(t.date(user.last_login_at))}</dd></dl>
</section>
</div>`;
}

export function messagePage(t, titleKey, textKey) {
  return `<div class="narrow"><h1>${e(t(titleKey))}</h1><p class="lead">${e(t(textKey))}</p><p><a class="btn" href="/">${e(t('common.backToArchives'))}</a></p></div>`;
}
