// Web panel server (port 8080 by default).

import http from 'node:http';
import { readFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

import { listArchives, listVersions, readManifest } from '../server/archives.js';
import { createArchiveHandler } from '../server/archive-server.js';
import { languageFromHeader, msg, normalizeLanguage, translator } from '../shared/i18n.js';
import { createAuth, isSameOrigin, parseCookies } from './auth.js';
import { hashPassword, validatePassword, validateUsername, verifyPassword } from './accounts.js';
import { FORM_DEFAULTS, formFromJob, parseJobForm, scheduleFormValues } from './job-form.js';
import { deleteArchive, deleteVersion } from './archive-admin.js';
import { loadNotifySettings, parseNotifyForm, saveNotifySettings, sendToChannels, enabledChannels, testMessage } from './notify.js';
import { computeNextRun, describeSchedule } from './scheduler.js';
import { NAME_RE, VERSION_RE } from '../server/archives.js';
import {
  accountPage, archivesPage, jobPage, jobsPage, jobSummary, layout, logEntry, loginPage, messagePage, newJobPage, notificationsPage,
  schedulesPage, setupPage,
} from './views.js';

const STATIC = {
  '/static/app.css': { type: 'text/css; charset=utf-8', body: readFileSync(new URL('./static/app.css', import.meta.url)) },
  '/static/app.js': { type: 'text/javascript; charset=utf-8', body: readFileSync(new URL('./static/app.js', import.meta.url)) },
};

const CSP = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; "
  + "frame-ancestors 'none'; form-action 'self'; base-uri 'none'; object-src 'none'";

const BASE_HEADERS = {
  'content-security-policy': CSP,
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'same-origin',
  'cache-control': 'no-store',
};

const MAX_BODY = 64 * 1024;
const LANG_COOKIE = 'ec_lang';
const YEAR_S = 365 * 24 * 3600;
const langCookie = (lang) => `${LANG_COOKIE}=${lang}; Path=/; SameSite=Lax; Max-Age=${YEAR_S}`;

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(Object.assign(new Error('Request too large'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(new URLSearchParams(Buffer.concat(chunks).toString('utf8'))));
    req.on('error', reject);
  });
}

/**
 * options: db, archiveRoot, archivePort (8081; 0 = archiwa na porcie panelu pod /a/…),
 *          archivePassword (tryb jednego portu), archiveBaseUrl (opcjonalnie),
 *          warning (np. ostrzeżenie o systemie plików), log,
 *          defaultLanguage (EASYCOPY_LANG; otherwise the browser language, then English),
 *          fetchImpl (notification tests)
 */
export function createPanelHandler({
  db, archiveRoot, archivePort = 8081, archivePassword = null, archiveBaseUrl = null, warning = null, log = () => {},
  defaultLanguage = null, fetchImpl = fetch,
}) {
  // tryb jednego portu: panel sam wydaje archiwa (te same zabezpieczenia co osobny serwer)
  const archiveHandler = archivePort === 0 ? createArchiveHandler({ archiveRoot, password: archivePassword, defaultLanguage }) : null;
  const fixedDefault = normalizeLanguage(defaultLanguage);

  /** Language: account setting > cookie > EASYCOPY_LANG > browser (Accept-Language) > English. */
  const languageOf = (req) =>
    normalizeLanguage(req.user?.language)
    ?? normalizeLanguage(parseCookies(req.headers.cookie)[LANG_COOKIE])
    ?? fixedDefault
    ?? languageFromHeader(req.headers['accept-language']);
  const auth = createAuth({ db, secret: db.sessionSecret() });
  const isSecure = (req) => req.headers['x-forwarded-proto'] === 'https';

  const archiveBase = (req) => {
    if (archiveBaseUrl) return archiveBaseUrl.replace(/\/+$/, '');
    if (archiveHandler) return ''; // ten sam adres co panel: /a/<nazwa>/
    // ten sam host co panel, port serwera archiwów
    const host = (req.headers.host || 'localhost').replace(/:\d+$/, '');
    return `http://${host}:${archivePort}`;
  };

  const send = (res, status, body, headers = {}) => {
    res.writeHead(status, { 'content-type': 'text/html; charset=utf-8', ...BASE_HEADERS, ...headers });
    res.end(res.req.method === 'HEAD' ? undefined : body);
  };
  const page = (req, res, status, opts) => send(res, status, layout(req.t, { user: req.user ?? null, warning, ...opts }));
  const json = (res, status, data) => send(res, status, JSON.stringify(data), { 'content-type': 'application/json; charset=utf-8' });
  const redirect = (res, location, extra = {}) => {
    res.writeHead(303, { location, ...BASE_HEADERS, ...extra });
    res.end();
  };
  const message = (req, res, status, key) =>
    page(req, res, status, { title: req.t(`messages.${key}Title`), body: messagePage(req.t, `messages.${key}Title`, `messages.${key}Text`) });
  const notFound = (req, res) => message(req, res, 404, 'notFound');

  async function versionsOf(name) {
    const versions = [];
    for (const v of (await listVersions(archiveRoot, name)).reverse()) {
      const m = await readManifest(archiveRoot, name, v);
      versions.push({ version: v, bytes: m?.stats?.bytes ?? null });
    }
    return versions;
  }

  function saveSchedule(job, schedule, { enabled = true } = {}) {
    return db.saveSchedule({ name: job.name, url: job.url, options: job.options, ...schedule, enabled, nextRunAt: enabled ? computeNextRun(schedule) : null });
  }

  const schedulesByName = () => new Map(db.listSchedules().map((s) => [s.name, s]));

  function retry(job, params) {
    const options = { ...job.options };
    const preset = params.get('preset');
    if (preset && ['delikatny', 'normalny', 'szybki'].includes(preset)) options.preset = preset;
    const delay = Math.min(Math.max(Number(params.get('delay')) || 0, 0), 24 * 3600);
    return db.createJob({ url: job.url, name: job.name, options, runAt: Date.now() + delay * 1000, retryOf: job.id });
  }

  return async function handler(req, res) {
    const started = Date.now();
    res.on('finish', () => {
      if (!/^\/(api\/|static\/|healthz)/.test(req.url)) log(`${req.method} ${req.url} ${res.statusCode} ${Date.now() - started} ms`);
    });

    req.t = translator(languageOf(req));
    try {
      const url = new URL(req.url, 'http://localhost');
      const p = url.pathname;
      const method = req.method;

      // ?lang=pl – language choice from the sign-in page (remembered in a cookie)
      const chosen = normalizeLanguage(url.searchParams.get('lang'));
      if (chosen && method === 'GET' && !p.startsWith('/a/') && !p.startsWith('/api/')) {
        url.searchParams.delete('lang');
        return redirect(res, `${p}${url.search}`, { 'set-cookie': langCookie(chosen) });
      }

      if (p === '/healthz') return send(res, 200, 'ok', { 'content-type': 'text/plain; charset=utf-8' });
      // archiwa w trybie jednego portu – bez logowania do panelu: kopia w sandboxie i tak nie dostaje
      // ciasteczek panelu, więc obrazki i CSS by się nie ładowały. Chroni je ARCHIVE_PASSWORD.
      if (archiveHandler && (p === '/a' || p.startsWith('/a/'))) return archiveHandler(req, res);
      if (STATIC[p] && (method === 'GET' || method === 'HEAD')) {
        res.writeHead(200, { 'content-type': STATIC[p].type, 'cache-control': 'public, max-age=3600', 'x-content-type-options': 'nosniff' });
        return res.end(method === 'HEAD' ? undefined : STATIC[p].body);
      }
      if (p === '/favicon.ico') {
        res.writeHead(204);
        return res.end();
      }

      if (method === 'POST' && !isSameOrigin(req)) {
        return message(req, res, 403, 'forbidden');
      }

      // ---------- instalacja: pierwsze konto ----------
      const needsSetup = auth.needsSetup();
      if (p === '/instalacja') {
        if (!needsSetup) return redirect(res, '/');
        if (method === 'POST') {
          const params = await readBody(req);
          const username = (params.get('username') ?? '').trim();
          const password = params.get('password') ?? '';
          const errors = {
            username: validateUsername(username),
            password: validatePassword(password, params.get('repeat') ?? ''),
          };
          if (errors.username || errors.password) return send(res, 422, setupPage(req.t, { values: { username }, errors }));
          const id = db.createFirstUser(username, await hashPassword(password));
          if (!id) return redirect(res, '/logowanie'); // ktoś właśnie założył konto w innym oknie
          db.touchLogin(id);
          db.setLanguage(id, req.t.lang);
          // first run: the setup language becomes the language of notifications
          const ns = loadNotifySettings(db);
          saveNotifySettings(db, { ...ns, language: req.t.lang });
          log(`Administrator account created: "${username}"`);
          return redirect(res, '/', { 'set-cookie': auth.sessionCookie(db.getUser(id), isSecure(req)) });
        }
        return send(res, 200, setupPage(req.t, {}));
      }
      if (needsSetup) {
        if (p.startsWith('/api/')) return json(res, 503, { error: 'Setup required' });
        return redirect(res, '/instalacja');
      }

      // ---------- logowanie ----------
      if (p === '/logowanie') {
        if (method === 'POST') {
          const params = await readBody(req);
          const username = (params.get('username') ?? '').trim();
          const user = await auth.login(username, params.get('password') ?? '');
          if (user) {
            log(`Sign-in: ${user.username}`);
            return redirect(res, '/', { 'set-cookie': auth.sessionCookie(user, isSecure(req)) });
          }
          await sleep(800); // spowalnia zgadywanie hasła
          return send(res, 401, loginPage(req.t, { error: 'errors.login', username }));
        }
        if (auth.currentUser(req)) return redirect(res, '/');
        return send(res, 200, loginPage(req.t, {}));
      }
      if (p === '/wyloguj' && method === 'POST') return redirect(res, '/logowanie', { 'set-cookie': auth.clearCookie() });

      req.user = auth.currentUser(req);
      if (!req.user) {
        if (p.startsWith('/api/')) return json(res, 401, { error: 'Sign-in required' });
        return redirect(res, '/logowanie');
      }
      req.t = translator(languageOf(req));
      const t = req.t;

      // ---------- konto ----------
      if (p === '/konto/jezyk' && method === 'POST') {
        const lang = normalizeLanguage((await readBody(req)).get('language'));
        if (lang) db.setLanguage(req.user.id, lang);
        return redirect(res, '/konto?ok=jezyk', lang ? { 'set-cookie': langCookie(lang) } : {});
      }
      if (p === '/konto') {
        if (method === 'POST') {
          const params = await readBody(req);
          const errors = {};
          if (!(await verifyPassword(params.get('current') ?? '', req.user.password_hash))) errors.current = 'errors.currentPassword';
          errors.password = validatePassword(params.get('password') ?? '', params.get('repeat') ?? '');
          if (errors.current || errors.password) {
            return page(req, res, 422, { title: t('account.title'), active: 'konto', body: accountPage(t, { user: req.user, errors }) });
          }
          db.setPassword(req.user.id, await hashPassword(params.get('password')));
          log(`Password changed: ${req.user.username}`);
          // nowe ciasteczko dla tego urządzenia, pozostałe sesje wygasają
          return redirect(res, '/konto?ok=haslo', { 'set-cookie': auth.sessionCookie(db.getUser(req.user.id), isSecure(req)) });
        }
        const saved = { haslo: t('account.changed'), jezyk: t('account.languageSaved') }[url.searchParams.get('ok')] ?? null;
        return page(req, res, 200, { title: t('account.title'), active: 'konto', body: accountPage(t, { user: req.user, saved }) });
      }

      // ---------- notifications ----------
      if (p === '/powiadomienia') {
        const current = loadNotifySettings(db);
        if (method === 'POST') {
          const params = await readBody(req);
          const { settings, errors } = parseNotifyForm(params, current, t.lang);
          if (Object.keys(errors).length) {
            return page(req, res, 422, { title: t('notifications.title'), active: 'powiadomienia', body: notificationsPage(t, { settings, errors }) });
          }
          saveNotifySettings(db, settings);
          if (params.get('action') !== 'test') {
            log('Notification settings saved');
            return redirect(res, '/powiadomienia?ok=1');
          }
          let text;
          if (!enabledChannels(settings).length) text = t('notifications.testNone');
          else {
            const results = await sendToChannels(settings, testMessage(t, settings), { fetchImpl });
            const ok = results.filter((r) => r.ok).map((r) => r.name);
            const bad = results.filter((r) => !r.ok).map((r) => `${r.name}: ${r.error}`);
            text = [ok.length ? t('notifications.testOk', { channels: ok.join(', ') }) : '', bad.length ? t('notifications.testFailed', { errors: bad.join('; ') }) : '']
              .filter(Boolean)
              .join(' ');
            log(`Test notification: ${ok.join(', ') || '-'}${bad.length ? ` (failed: ${bad.join('; ')})` : ''}`);
          }
          return page(req, res, 200, { title: t('notifications.title'), active: 'powiadomienia', body: notificationsPage(t, { settings, message: text }) });
        }
        const saved = url.searchParams.has('ok') ? t('notifications.savedOk') : null;
        return page(req, res, 200, { title: t('notifications.title'), active: 'powiadomienia', body: notificationsPage(t, { settings: current, message: saved }) });
      }

      // ---------- strony ----------
      if (p === '/' && method === 'GET') {
        const [archives, activeJobs] = [await listArchives(archiveRoot), db.activeJobs()];
        return page(req, res, 200, {
          title: t('archives.title'),
          active: 'archiwa',
          body: archivesPage(t, { archives, activeJobs, latestJobs: db.latestJobByName(), archiveBase: archiveBase(req), schedules: schedulesByName() }),
        });
      }

      if (p === '/nowa') {
        if (method === 'POST') {
          const params = await readBody(req);
          const mode = params.get('_mode') === 'retry' ? 'retry' : 'new';
          const { values, errors, job, schedule } = parseJobForm(params);
          if (!job) return page(req, res, 422, { title: t('common.newCopy'), body: newJobPage(t, { values, errors, mode }) });
          job.options.language = t.lang;
          let saved = null;
          if (schedule) {
            saved = saveSchedule(job, schedule);
            log(`Schedule "${job.name}": ${describeSchedule(translator('en'), saved)}`);
          }
          const id = db.createJob({ ...job, scheduleId: saved?.id ?? null });
          if (saved) db.markScheduleRun(saved.id, { nextRunAt: saved.nextRunAt, jobId: id });
          log(`New job #${id}: ${job.url}`);
          return redirect(res, `/zadania/${id}`);
        }
        const from = Number(url.searchParams.get('z'));
        const source = from ? db.getJob(from) : null;
        const values = source
          ? { ...formFromJob(source), ...scheduleFormValues(db.getScheduleByName(source.name)) }
          : { ...FORM_DEFAULTS, url: url.searchParams.get('url') ?? '' };
        return page(req, res, 200, {
          title: t('common.newCopy'),
          body: newJobPage(t, { values, mode: source ? 'retry' : 'new', back: source ? `/zadania/${source.id}` : '/' }),
        });
      }

      // ---------- harmonogram ----------
      if (p === '/harmonogram' && method === 'GET') {
        const saved = { usuniety: t('schedules.deleted'), zapisany: t('schedules.saved') }[url.searchParams.get('ok')] ?? null;
        return page(req, res, 200, { title: t('schedules.title'), active: 'harmonogram', body: schedulesPage(t, { schedules: db.listSchedules(), saved }) });
      }
      const sm = /^\/harmonogram\/(\d+)\/(edytuj|wstrzymaj|wznow|usun)$/.exec(p);
      if (sm) {
        const s = db.getSchedule(Number(sm[1]));
        if (!s) return notFound(req, res);
        const action = sm[2];
        if (action === 'edytuj') {
          const formAction = `/harmonogram/${s.id}/edytuj`;
          if (method === 'POST') {
            const params = await readBody(req);
            params.set('name', s.name); // nazwa archiwum się nie zmienia
            const { values, errors, job, schedule } = parseJobForm(params);
            if (!schedule && !errors.repeat) errors.repeat = 'errors.repeatRequired';
            if (!job || Object.keys(errors).length) {
              return page(req, res, 422, { title: t('schedules.title'), active: 'harmonogram', body: newJobPage(t, { values, errors, mode: 'schedule', action: formAction, back: '/harmonogram' }) });
            }
            job.options.language = s.options?.language ?? t.lang;
            saveSchedule({ ...job, name: s.name }, schedule, { enabled: s.enabled });
            log(`Schedule "${s.name}" changed`);
            return redirect(res, '/harmonogram?ok=zapisany');
          }
          if (method === 'GET') {
            const values = { ...formFromJob({ url: s.url, name: s.name, options: s.options }), ...scheduleFormValues(s) };
            return page(req, res, 200, { title: t('schedules.title'), active: 'harmonogram', body: newJobPage(t, { values, mode: 'schedule', action: formAction, back: '/harmonogram' }) });
          }
        }
        if (method === 'POST' && (action === 'wstrzymaj' || action === 'wznow')) {
          const enable = action === 'wznow';
          db.setScheduleEnabled(s.id, enable, enable ? computeNextRun(s) : null);
          log(`Schedule "${s.name}": ${enable ? 'resumed' : 'paused'}`);
          return redirect(res, '/harmonogram');
        }
        if (method === 'POST' && action === 'usun') {
          db.deleteSchedule(s.id);
          log(`Schedule "${s.name}" deleted`);
          return redirect(res, '/harmonogram?ok=usuniety');
        }
      }

      // ---------- usuwanie archiwów ----------
      const am = /^\/archiwa\/([^/]+)(?:\/([^/]+))?\/usun$/.exec(p);
      if (am && method === 'POST') {
        const [, name, version] = am;
        if (!NAME_RE.test(name) || (version && !VERSION_RE.test(version))) return notFound(req, res);
        if (version) {
          const building = db.activeJobs().some((j) => j.name === name && j.version === version);
          if (building) return message(req, res, 409, 'versionBusy');
          const r = await deleteVersion(archiveRoot, name, version);
          log(`Version deleted: ${name}/${version}`);
          const back = db.latestJobByName().get(name);
          return redirect(res, r.archiveGone || !back ? '/' : `/zadania/${back}`);
        }
        if (db.hasActiveJob(name)) {
          return message(req, res, 409, 'archiveBusy');
        }
        await deleteArchive(archiveRoot, name);
        db.deleteJobsByName(name);
        db.deleteScheduleByName(name);
        log(`Archive deleted: "${name}"`);
        return redirect(res, '/');
      }

      if (p === '/zadania' && method === 'GET') {
        return page(req, res, 200, { title: t('jobs.title'), active: 'zadania', body: jobsPage(t, { jobs: db.listJobs({ limit: 100 }) }) });
      }

      const m = /^\/zadania\/(\d+)(?:\/(anuluj|ponow|edytuj|usun))?$/.exec(p);
      if (m) {
        const job = db.getJob(Number(m[1]));
        if (!job) return notFound(req, res);
        if (m[2] === 'edytuj') {
          if (job.status !== 'queued') return redirect(res, `/nowa?z=${job.id}`); // już ruszyło – nowa kopia z poprawkami
          const formAction = `/zadania/${job.id}/edytuj`;
          if (method === 'POST') {
            const { values, errors, job: changed } = parseJobForm(await readBody(req));
            if (!changed) return page(req, res, 422, { title: job.name, active: 'zadania', body: newJobPage(t, { values, errors, mode: 'edit-job', action: formAction, back: `/zadania/${job.id}` }) });
            changed.options.language = job.options?.language ?? t.lang;
            if (!db.updateQueuedJob(job.id, changed)) return redirect(res, `/nowa?z=${job.id}`); // właśnie wystartowało
            log(`Job #${job.id} settings changed`);
            return redirect(res, `/zadania/${job.id}`);
          }
          if (method === 'GET') {
            return page(req, res, 200, { title: job.name, active: 'zadania', body: newJobPage(t, { values: formFromJob(job), mode: 'edit-job', action: formAction, back: `/zadania/${job.id}` }) });
          }
        }
        if (m[2] === 'usun' && method === 'POST') {
          if (!db.deleteJob(job.id)) return message(req, res, 409, 'jobBusy');
          log(`Job #${job.id} deleted from history`);
          return redirect(res, '/zadania');
        }
        if (m[2] && method === 'POST') {
          const params = await readBody(req);
          if (m[2] === 'anuluj') {
            db.requestCancel(job.id);
            if (job.status === 'running') db.addLog(job.id, 'warn', msg('log.stopRequested'), 'stop');
            log(`Job #${job.id} stop requested`);
            return redirect(res, `/zadania/${job.id}`);
          }
          const id = retry(job, params);
          log(`Job #${job.id} retried as #${id}`);
          return redirect(res, `/zadania/${id}`);
        }
        if (!m[2] && method === 'GET') {
          return page(req, res, 200, {
            title: job.name,
            active: 'zadania',
            body: jobPage(t, { job, log: db.getLog(job.id, { limit: 300 }), versions: await versionsOf(job.name), archiveBase: archiveBase(req), schedule: db.getScheduleByName(job.name) }),
          });
        }
      }

      // ---------- API do odświeżania ----------
      if (p === '/api/aktywne' && method === 'GET') {
        return json(res, 200, db.activeJobs().map((j) => jobSummary(t, j, archiveBase(req))));
      }
      const api = /^\/api\/zadania\/(\d+)$/.exec(p);
      if (api && method === 'GET') {
        const job = db.getJob(Number(api[1]));
        if (!job) return json(res, 404, { error: 'No such job' });
        const after = Number(url.searchParams.get('po')) || 0;
        const entries = db.getLog(job.id, { afterId: after, limit: 300 }).map((l) => logEntry(t, l));
        return json(res, 200, { job: jobSummary(t, job, archiveBase(req)), log: entries });
      }

      if (method !== 'GET' && method !== 'HEAD' && method !== 'POST') {
        return send(res, 405, 'Method Not Allowed', { allow: 'GET, HEAD, POST', 'content-type': 'text/plain; charset=utf-8' });
      }
      return notFound(req, res);
    } catch (err) {
      log(`Error: ${err.stack || err.message}`);
      if (res.headersSent) return res.destroy();
      if (err.status === 413) return send(res, 413, 'Request too large', { 'content-type': 'text/plain; charset=utf-8' });
      return message(req, res, 500, 'serverError');
    }
  };
}

export function createPanelServer(options) {
  const server = http.createServer(createPanelHandler(options));
  server.keepAliveTimeout = 5_000;
  return server;
}
