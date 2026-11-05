// Serwer panelu WWW (domyślnie port 8080).

import http from 'node:http';
import { readFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

import { listArchives, listVersions, readManifest } from '../server/archives.js';
import { createArchiveHandler } from '../server/archive-server.js';
import { createAuth, isSameOrigin } from './auth.js';
import { hashPassword, validatePassword, validateUsername, verifyPassword } from './accounts.js';
import { FORM_DEFAULTS, formFromJob, parseJobForm, scheduleFormValues } from './job-form.js';
import { deleteArchive, deleteVersion } from './archive-admin.js';
import { logLabel } from './log-format.js';
import { computeNextRun, describeSchedule } from './scheduler.js';
import { NAME_RE, VERSION_RE } from '../server/archives.js';
import {
  accountPage, archivesPage, jobPage, jobsPage, jobSummary, layout, loginPage, messagePage, newJobPage, schedulesPage, setupPage,
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

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(Object.assign(new Error('Za duże żądanie'), { status: 413 }));
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
 *          warning (np. ostrzeżenie o systemie plików), log
 */
export function createPanelHandler({
  db, archiveRoot, archivePort = 8081, archivePassword = null, archiveBaseUrl = null, warning = null, log = () => {},
}) {
  // tryb jednego portu: panel sam wydaje archiwa (te same zabezpieczenia co osobny serwer)
  const archiveHandler = archivePort === 0 ? createArchiveHandler({ archiveRoot, password: archivePassword }) : null;
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
  const page = (req, res, status, opts) => send(res, status, layout({ user: req.user ?? null, warning, ...opts }));
  const json = (res, status, data) => send(res, status, JSON.stringify(data), { 'content-type': 'application/json; charset=utf-8' });
  const redirect = (res, location, extra = {}) => {
    res.writeHead(303, { location, ...BASE_HEADERS, ...extra });
    res.end();
  };
  const notFound = (req, res) => page(req, res, 404, { title: 'Nie znaleziono', body: messagePage('Nie ma takiej strony', 'Sprawdź adres albo wróć do listy archiwów.') });

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

    try {
      const url = new URL(req.url, 'http://localhost');
      const p = url.pathname;
      const method = req.method;

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
        return page(req, res, 403, { title: 'Odrzucone', body: messagePage('Odrzucone żądanie', 'Formularz nie pochodzi z tego panelu.') });
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
          if (errors.username || errors.password) return send(res, 422, setupPage({ values: { username }, errors }));
          const id = db.createFirstUser(username, await hashPassword(password));
          if (!id) return redirect(res, '/logowanie'); // ktoś właśnie założył konto w innym oknie
          db.touchLogin(id);
          log(`Utworzono konto administratora „${username}”`);
          return redirect(res, '/', { 'set-cookie': auth.sessionCookie(db.getUser(id), isSecure(req)) });
        }
        return send(res, 200, setupPage({}));
      }
      if (needsSetup) {
        if (p.startsWith('/api/')) return json(res, 503, { error: 'Panel wymaga instalacji' });
        return redirect(res, '/instalacja');
      }

      // ---------- logowanie ----------
      if (p === '/logowanie') {
        if (method === 'POST') {
          const params = await readBody(req);
          const username = (params.get('username') ?? '').trim();
          const user = await auth.login(username, params.get('password') ?? '');
          if (user) {
            log(`Logowanie: ${user.username}`);
            return redirect(res, '/', { 'set-cookie': auth.sessionCookie(user, isSecure(req)) });
          }
          await sleep(800); // spowalnia zgadywanie hasła
          return send(res, 401, loginPage({ error: 'Nieprawidłowy login lub hasło.', username }));
        }
        if (auth.currentUser(req)) return redirect(res, '/');
        return send(res, 200, loginPage({}));
      }
      if (p === '/wyloguj' && method === 'POST') return redirect(res, '/logowanie', { 'set-cookie': auth.clearCookie() });

      req.user = auth.currentUser(req);
      if (!req.user) {
        if (p.startsWith('/api/')) return json(res, 401, { error: 'Wymagane logowanie' });
        return redirect(res, '/logowanie');
      }

      // ---------- konto ----------
      if (p === '/konto') {
        if (method === 'POST') {
          const params = await readBody(req);
          const errors = {};
          if (!(await verifyPassword(params.get('current') ?? '', req.user.password_hash))) errors.current = 'Obecne hasło jest nieprawidłowe.';
          errors.password = validatePassword(params.get('password') ?? '', params.get('repeat') ?? '');
          if (errors.current || errors.password) {
            return page(req, res, 422, { title: 'Konto', active: 'konto', body: accountPage({ user: req.user, errors }) });
          }
          db.setPassword(req.user.id, await hashPassword(params.get('password')));
          log(`Zmiana hasła: ${req.user.username}`);
          // nowe ciasteczko dla tego urządzenia, pozostałe sesje wygasają
          return redirect(res, '/konto?zmienione=1', { 'set-cookie': auth.sessionCookie(db.getUser(req.user.id), isSecure(req)) });
        }
        return page(req, res, 200, { title: 'Konto', active: 'konto', body: accountPage({ user: req.user, saved: url.searchParams.has('zmienione') }) });
      }

      // ---------- strony ----------
      if (p === '/' && method === 'GET') {
        const [archives, activeJobs] = [await listArchives(archiveRoot), db.activeJobs()];
        return page(req, res, 200, {
          title: 'Archiwa',
          active: 'archiwa',
          body: archivesPage({ archives, activeJobs, latestJobs: db.latestJobByName(), archiveBase: archiveBase(req), schedules: schedulesByName() }),
        });
      }

      if (p === '/nowa') {
        if (method === 'POST') {
          const params = await readBody(req);
          const mode = params.get('_mode') === 'retry' ? 'retry' : 'new';
          const { values, errors, job, schedule } = parseJobForm(params);
          if (!job) return page(req, res, 422, { title: 'Nowa kopia', body: newJobPage({ values, errors, mode }) });
          let saved = null;
          if (schedule) {
            saved = saveSchedule(job, schedule);
            log(`Harmonogram „${job.name}”: ${describeSchedule(saved)}`);
          }
          const id = db.createJob({ ...job, scheduleId: saved?.id ?? null });
          if (saved) db.markScheduleRun(saved.id, { nextRunAt: saved.nextRunAt, jobId: id });
          log(`Nowe zadanie #${id}: ${job.url}`);
          return redirect(res, `/zadania/${id}`);
        }
        const from = Number(url.searchParams.get('z'));
        const source = from ? db.getJob(from) : null;
        const values = source
          ? { ...formFromJob(source), ...scheduleFormValues(db.getScheduleByName(source.name)) }
          : { ...FORM_DEFAULTS, url: url.searchParams.get('url') ?? '' };
        return page(req, res, 200, {
          title: 'Nowa kopia',
          body: newJobPage({ values, mode: source ? 'retry' : 'new', back: source ? `/zadania/${source.id}` : '/' }),
        });
      }

      // ---------- harmonogram ----------
      if (p === '/harmonogram' && method === 'GET') {
        const saved = { usuniety: 'Harmonogram usunięty.', zapisany: 'Harmonogram zapisany.' }[url.searchParams.get('ok')] ?? null;
        return page(req, res, 200, { title: 'Harmonogram', active: 'harmonogram', body: schedulesPage({ schedules: db.listSchedules(), saved }) });
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
            if (!schedule && !errors.repeat) errors.repeat = 'Wybierz, jak często robić kopię';
            if (!job || Object.keys(errors).length) {
              return page(req, res, 422, { title: 'Harmonogram', active: 'harmonogram', body: newJobPage({ values, errors, mode: 'schedule', action: formAction, back: '/harmonogram' }) });
            }
            saveSchedule({ ...job, name: s.name }, schedule, { enabled: s.enabled });
            log(`Harmonogram „${s.name}” zmieniony`);
            return redirect(res, '/harmonogram?ok=zapisany');
          }
          if (method === 'GET') {
            const values = { ...formFromJob({ url: s.url, name: s.name, options: s.options }), ...scheduleFormValues(s) };
            return page(req, res, 200, { title: 'Harmonogram', active: 'harmonogram', body: newJobPage({ values, mode: 'schedule', action: formAction, back: '/harmonogram' }) });
          }
        }
        if (method === 'POST' && (action === 'wstrzymaj' || action === 'wznow')) {
          const enable = action === 'wznow';
          db.setScheduleEnabled(s.id, enable, enable ? computeNextRun(s) : null);
          log(`Harmonogram „${s.name}”: ${enable ? 'wznowiony' : 'wstrzymany'}`);
          return redirect(res, '/harmonogram');
        }
        if (method === 'POST' && action === 'usun') {
          db.deleteSchedule(s.id);
          log(`Harmonogram „${s.name}” usunięty`);
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
          if (building) return page(req, res, 409, { title: 'Nie można usunąć', body: messagePage('Ta wersja właśnie się pobiera', 'Najpierw zatrzymaj zadanie, potem usuń wersję.') });
          const r = await deleteVersion(archiveRoot, name, version);
          log(`Usunięto wersję ${name}/${version}`);
          const back = db.latestJobByName().get(name);
          return redirect(res, r.archiveGone || !back ? '/' : `/zadania/${back}`);
        }
        if (db.hasActiveJob(name)) {
          return page(req, res, 409, { title: 'Nie można usunąć', body: messagePage('To archiwum właśnie się pobiera', 'Najpierw zatrzymaj zadanie (albo usuń je z kolejki), potem usuń archiwum.') });
        }
        await deleteArchive(archiveRoot, name);
        db.deleteJobsByName(name);
        db.deleteScheduleByName(name);
        log(`Usunięto archiwum „${name}”`);
        return redirect(res, '/');
      }

      if (p === '/zadania' && method === 'GET') {
        return page(req, res, 200, { title: 'Zadania', active: 'zadania', body: jobsPage({ jobs: db.listJobs({ limit: 100 }) }) });
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
            if (!changed) return page(req, res, 422, { title: job.name, active: 'zadania', body: newJobPage({ values, errors, mode: 'edit-job', action: formAction, back: `/zadania/${job.id}` }) });
            if (!db.updateQueuedJob(job.id, changed)) return redirect(res, `/nowa?z=${job.id}`); // właśnie wystartowało
            log(`Zmienione ustawienia zadania #${job.id}`);
            return redirect(res, `/zadania/${job.id}`);
          }
          if (method === 'GET') {
            return page(req, res, 200, { title: job.name, active: 'zadania', body: newJobPage({ values: formFromJob(job), mode: 'edit-job', action: formAction, back: `/zadania/${job.id}` }) });
          }
        }
        if (m[2] === 'usun' && method === 'POST') {
          if (!db.deleteJob(job.id)) return page(req, res, 409, { title: 'Nie można usunąć', body: messagePage('Zadanie jest w toku', 'Najpierw je zatrzymaj, potem usuń z historii.') });
          log(`Usunięto zadanie #${job.id} z historii`);
          return redirect(res, '/zadania');
        }
        if (m[2] && method === 'POST') {
          const params = await readBody(req);
          if (m[2] === 'anuluj') {
            db.requestCancel(job.id);
            if (job.status === 'running') db.addLog(job.id, 'warn', 'Zatrzymywanie na prośbę z panelu…', 'stop');
            log(`Zatrzymanie zadania #${job.id}`);
            return redirect(res, `/zadania/${job.id}`);
          }
          const id = retry(job, params);
          log(`Ponowienie zadania #${job.id} jako #${id}`);
          return redirect(res, `/zadania/${id}`);
        }
        if (!m[2] && method === 'GET') {
          return page(req, res, 200, {
            title: job.name,
            active: 'zadania',
            body: jobPage({ job, log: db.getLog(job.id, { limit: 300 }), versions: await versionsOf(job.name), archiveBase: archiveBase(req), schedule: db.getScheduleByName(job.name) }),
          });
        }
      }

      // ---------- API do odświeżania ----------
      if (p === '/api/aktywne' && method === 'GET') {
        return json(res, 200, db.activeJobs().map((j) => jobSummary(j, archiveBase(req))));
      }
      const api = /^\/api\/zadania\/(\d+)$/.exec(p);
      if (api && method === 'GET') {
        const job = db.getJob(Number(api[1]));
        if (!job) return json(res, 404, { error: 'Nie ma takiego zadania' });
        const after = Number(url.searchParams.get('po')) || 0;
        const entries = db.getLog(job.id, { afterId: after, limit: 300 }).map((l) => ({
          id: l.id,
          at: l.at,
          message: l.message,
          ...logLabel(l),
        }));
        return json(res, 200, { job: jobSummary(job, archiveBase(req)), log: entries });
      }

      if (method !== 'GET' && method !== 'HEAD' && method !== 'POST') {
        return send(res, 405, 'Method Not Allowed', { allow: 'GET, HEAD, POST', 'content-type': 'text/plain; charset=utf-8' });
      }
      return notFound(req, res);
    } catch (err) {
      log(`Błąd: ${err.stack || err.message}`);
      if (res.headersSent) return res.destroy();
      if (err.status === 413) return send(res, 413, 'Za duże żądanie', { 'content-type': 'text/plain; charset=utf-8' });
      return page(req, res, 500, { title: 'Błąd', body: messagePage('Błąd serwera', 'Coś poszło nie tak. Szczegóły są w logu.') });
    }
  };
}

export function createPanelServer(options) {
  const server = http.createServer(createPanelHandler(options));
  server.keepAliveTimeout = 5_000;
  return server;
}
