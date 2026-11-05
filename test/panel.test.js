import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { openDatabase } from '../src/panel/db.js';
import { parseJobForm, formFromJob } from '../src/panel/job-form.js';
import { runJob } from '../src/panel/runner.js';
import { workerLoop } from '../src/panel/worker-process.js';
import { createPanelServer } from '../src/panel/panel-server.js';
import { runResetPassword } from '../src/panel/reset-password.js';
import { computeNextRun, schedulerTick } from '../src/panel/scheduler.js';
import { logLabel, describeFailure } from '../src/panel/log-format.js';
import { localize, translator } from '../src/shared/i18n.js';

const PL = translator('pl');
const pl = (text) => localize(PL, text);
import { startTestSite } from './helpers/test-site.js';

let tmp;
before(async () => {
  tmp = await mkdtemp(path.join(tmpdir(), 'easycopy-panel-'));
});
after(async () => {
  await rm(tmp, { recursive: true, force: true });
});

const fast = { rps: 1000, concurrency: 4, retryDelayMs: 10, blockBaseDelayMs: 10, slowDownIntervalMs: 10, timeoutMs: 5000 };

test('baza: kolejka, anulowanie, odzyskiwanie po restarcie, rotacja dziennika', () => {
  const db = openDatabase(':memory:');
  const later = db.createJob({ url: 'https://www.example.com/', name: 'b', runAt: Date.now() + 60_000 });
  const first = db.createJob({ url: 'https://www.example.com/', name: 'a' });
  const second = db.createJob({ url: 'https://www.example.org/', name: 'c' });
  assert.equal(db.claimNextJob().id, first, 'najpierw zadanie dodane wcześniej');
  assert.equal(db.requestCancel(second).status, 'cancelled', 'zadanie z kolejki anulowane od razu');
  assert.equal(db.claimNextJob(), null, 'zaplanowane na później jeszcze czeka');
  assert.equal(db.claimNextJob(Date.now() + 120_000).id, later);
  assert.equal(db.requestCancel(first).cancelRequested, true, 'uruchomione dostaje prośbę o zatrzymanie');
  assert.equal(db.recoverInterrupted(), 2);
  assert.equal(db.getJob(first).status, 'aborted');
  for (let i = 0; i < 10; i++) db.addLog(first, 'info', `wpis ${i}`);
  db.pruneLogs({ perJob: 3 });
  assert.deepEqual(db.getLog(first).map((l) => l.message), ['wpis 7', 'wpis 8', 'wpis 9']);
  assert.equal(db.sessionSecret(), db.sessionSecret(), 'sekret sesji stały');
  db.close();
});

test('formularz: walidacja i opcje zadania', () => {
  const bad = parseJobForm(new URLSearchParams({ url: 'ftp://x', maxPages: '-1', ua: 'custom' }));
  assert.ok(bad.errors.url && bad.errors.maxPages && bad.errors.customUa);
  assert.equal(bad.job, null);

  const ok = parseJobForm(new URLSearchParams({
    url: 'www.example.com/blog/', name: 'Mój Blog', preset: 'delikatny', depth: '2', maxPages: '100', maxSize: '500MB',
    respectRobots: 'on', skip: '.MP4, zip', exclude: '/koszyk/*', ua: 'safari', os: 'ios',
  }));
  assert.deepEqual(ok.errors, {});
  assert.equal(ok.job.url, 'https://www.example.com/blog/');
  assert.equal(ok.job.name, 'moj-blog');
  assert.equal(ok.job.options.subdomains, true, 'brak „tylko ta domena” = z subdomenami');
  assert.deepEqual(ok.job.options.skipExtensions, ['mp4', 'zip']);
  assert.equal(ok.job.options.maxBytes, 500 * 1024 ** 2);
  assert.equal(ok.job.options.browser, 'safari');
  const back = formFromJob({ url: ok.job.url, name: ok.job.name, options: ok.job.options });
  assert.equal(back.preset, 'delikatny');
  assert.equal(back.maxSize, '500MB');
  assert.equal(back.sameDomain, false);
});

test('worker: wykonuje zadanie z kolejki i zapisuje postęp oraz dziennik', async () => {
  const site = await startTestSite();
  const archiveRoot = path.join(tmp, 'a1');
  const db = openDatabase(path.join(tmp, 'w1.db'));
  try {
    const id = db.createJob({ url: site.url, name: 'testowa', options: { maxDepth: 1, ...fast } });
    let stop = false;
    const loop = workerLoop({ dbFile: db.file, archiveRoot, isStopping: () => stop, log: () => {} });
    for (let i = 0; i < 100 && ['queued', 'running'].includes(db.getJob(id).status); i++) await new Promise((r) => setTimeout(r, 100));
    stop = true;
    await loop;
    const job = db.getJob(id);
    assert.equal(job.status, 'complete');
    assert.match(job.version, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(job.stats.pages >= 2);
    assert.ok(existsSync(path.join(archiveRoot, 'testowa', job.version, 'index.html')));
    const log = db.getLog(id).map((l) => pl(l.message)).join('\n');
    assert.match(log, /Start pobierania:/);
    assert.match(log, /Gotowe: \d+ stron/);
  } finally {
    db.close();
    await site.close();
  }
});

test('worker: anulowanie w trakcie pobierania', async () => {
  const site = await startTestSite();
  const db = openDatabase(path.join(tmp, 'w2.db'));
  try {
    const id = db.createJob({ url: site.url, name: 'anulowana', options: {} });
    const job = db.claimNextJob();
    setTimeout(() => db.requestCancel(id), 300);
    const status = await runJob(db, job, { archiveRoot: path.join(tmp, 'a2'), crawlerOverrides: { rps: 2, concurrency: 1 } });
    assert.equal(status, 'cancelled');
    assert.equal(db.getJob(id).status, 'cancelled');
    assert.equal(pl(db.getJob(id).error), 'Zatrzymane w panelu');
  } finally {
    db.close();
    await site.close();
  }
});

// ---------- HTTP ----------

function request(port, method, pathname, { headers = {}, body = null } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, method, path: pathname, headers }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString() }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

const cookieOf = (res) => (res.headers['set-cookie'] ?? [])[0]?.split(';')[0] ?? null;

async function withPanel(fn, { dbFile = ':memory:', archiveRoot = path.join(tmp, 'panel-a'), ...options } = {}) {
  const db = openDatabase(dbFile);
  const server = createPanelServer({ db, archiveRoot, defaultLanguage: 'pl', ...options });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const origin = `http://127.0.0.1:${port}`;
  const form = (data, extra = {}) => ({
    headers: { 'content-type': 'application/x-www-form-urlencoded', origin, host: `127.0.0.1:${port}`, ...extra },
    body: new URLSearchParams(data).toString(),
  });
  try {
    await fn({ port, db, form });
  } finally {
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
    db.close();
  }
}

/** Zakłada konto w kreatorze i zwraca ciasteczko sesji. */
async function setup(port, form, username = 'admin', password = 'tajne-haslo') {
  const res = await request(port, 'POST', '/instalacja', form({ username, password, repeat: password }));
  assert.equal(res.status, 303);
  return cookieOf(res);
}

test('kreator instalacji: pierwsze konto, tylko raz', async () => {
  await withPanel(async ({ port, db, form }) => {
    // pusta baza → wszystko prowadzi do kreatora
    const home = await request(port, 'GET', '/');
    assert.equal(home.status, 303);
    assert.equal(home.headers.location, '/instalacja');
    assert.equal((await request(port, 'GET', '/logowanie')).headers.location, '/instalacja');
    assert.equal((await request(port, 'GET', '/api/aktywne')).status, 503);
    assert.equal((await request(port, 'GET', '/healthz')).status, 200, 'healthcheck działa przed instalacją');
    const page = await request(port, 'GET', '/instalacja');
    assert.equal(page.status, 200);
    assert.ok(page.body.includes('Utwórz konto administratora'));

    // walidacja
    const short = await request(port, 'POST', '/instalacja', form({ username: 'ad', password: 'krotkie', repeat: 'inne' }));
    assert.equal(short.status, 422);
    assert.ok(short.body.includes('Login: 3–32 znaki'));
    assert.ok(short.body.includes('co najmniej 8 znaków'));
    const mismatch = await request(port, 'POST', '/instalacja', form({ username: 'admin', password: 'tajne-haslo', repeat: 'inne-haslo' }));
    assert.ok(mismatch.body.includes('Hasła nie są takie same'));
    // z obcej strony
    assert.equal((await request(port, 'POST', '/instalacja', form({ username: 'zly', password: 'tajne-haslo', repeat: 'tajne-haslo' }, { origin: 'https://zla-strona.example' }))).status, 403);
    assert.equal(db.countUsers(), 0);

    const cookie = await setup(port, form);
    assert.ok(cookie, 'po instalacji od razu zalogowany');
    assert.equal(db.countUsers(), 1);
    const user = db.getUserByName('admin');
    assert.match(user.password_hash, /^scrypt\$/, 'hasło zapisane jako skrót scrypt');
    assert.ok(!user.password_hash.includes('tajne-haslo'));

    // kreator nie działa drugi raz
    assert.equal((await request(port, 'GET', '/instalacja')).headers.location, '/');
    const again = await request(port, 'POST', '/instalacja', form({ username: 'intruz', password: 'tajne-haslo', repeat: 'tajne-haslo' }));
    assert.equal(again.status, 303);
    assert.equal(db.countUsers(), 1);
    assert.equal(db.getUserByName('intruz'), null);

    const logged = await request(port, 'GET', '/', { headers: { cookie } });
    assert.equal(logged.status, 200);
    assert.ok(logged.body.includes('admin'), 'login w nagłówku');
  });
});

test('logowanie, wylogowanie i zmiana hasła', async () => {
  await withPanel(async ({ port, form }) => {
    const first = await setup(port, form);
    assert.equal((await request(port, 'GET', '/')).headers.location, '/logowanie', 'bez ciasteczka – logowanie');
    assert.equal((await request(port, 'GET', '/api/aktywne')).status, 401);

    const bad = await request(port, 'POST', '/logowanie', form({ username: 'admin', password: 'zle-haslo' }));
    assert.equal(bad.status, 401);
    assert.ok(bad.body.includes('Nieprawidłowy login lub hasło'));
    assert.equal((await request(port, 'POST', '/logowanie', form({ username: 'nie-ma', password: 'tajne-haslo' }))).status, 401);

    const good = await request(port, 'POST', '/logowanie', form({ username: 'ADMIN', password: 'tajne-haslo' }));
    assert.equal(good.status, 303, 'login bez rozróżniania wielkości liter');
    assert.match(good.headers['set-cookie'][0], /HttpOnly; SameSite=Strict/);
    const second = cookieOf(good);
    assert.equal((await request(port, 'GET', '/', { headers: { cookie: second } })).status, 200);
    assert.equal((await request(port, 'GET', '/', { headers: { cookie: 'ec_session=1.9999999999.podrobione' } })).status, 303);

    // zmiana hasła: złe obecne hasło
    const wrong = await request(port, 'POST', '/konto', { ...form({ current: 'zle', password: 'nowe-haslo-123', repeat: 'nowe-haslo-123' }, { cookie: second }) });
    assert.equal(wrong.status, 422);
    assert.ok(wrong.body.includes('Obecne hasło jest nieprawidłowe'));
    // poprawnie – inne sesje wygasają, ta dostaje nowe ciasteczko
    const changed = await request(port, 'POST', '/konto', form({ current: 'tajne-haslo', password: 'nowe-haslo-123', repeat: 'nowe-haslo-123' }, { cookie: second }));
    assert.equal(changed.status, 303);
    const third = cookieOf(changed);
    assert.equal((await request(port, 'GET', '/', { headers: { cookie: first } })).status, 303, 'stara sesja unieważniona');
    assert.equal((await request(port, 'GET', '/', { headers: { cookie: third } })).status, 200);
    assert.equal((await request(port, 'POST', '/logowanie', form({ username: 'admin', password: 'tajne-haslo' }))).status, 401);
    assert.equal((await request(port, 'POST', '/logowanie', form({ username: 'admin', password: 'nowe-haslo-123' }))).status, 303);

    const out = await request(port, 'POST', '/wyloguj', form({}, { cookie: third }));
    assert.match(out.headers['set-cookie'][0], /Max-Age=0/);
  });
});

test('panel: strony, dodanie zadania, ochrona formularzy', async () => {
  await withPanel(async ({ port, db, form }) => {
    const cookie = await setup(port, form);
    const get = (p) => request(port, 'GET', p, { headers: { cookie } });
    const post = (p, data, extra = {}) => request(port, 'POST', p, form(data, { cookie, ...extra }));

    const home = await get('/');
    assert.equal(home.status, 200);
    assert.match(home.headers['content-security-policy'], /script-src 'self'/);
    assert.ok(home.body.includes('Nie masz jeszcze żadnych kopii'));
    assert.equal((await get('/nowa')).status, 200);
    assert.equal((await get('/konto')).status, 200);
    assert.equal((await request(port, 'GET', '/static/app.css')).status, 200);

    const csrf = await post('/nowa', { url: 'https://www.example.com/' }, { origin: 'https://zla-strona.example' });
    assert.equal(csrf.status, 403);
    assert.equal(db.listJobs().length, 0);

    const invalid = await post('/nowa', { url: '' });
    assert.equal(invalid.status, 422);
    assert.ok(invalid.body.includes('Podaj pełny adres strony'));

    const created = await post('/nowa', { url: 'https://www.example.com/', preset: 'normalny', depth: '1', maxPages: '10', maxSize: '0', sameDomain: 'on', respectRobots: 'on', ua: 'easycopy', os: 'win' });
    assert.equal(created.status, 303);
    assert.equal(created.headers.location, '/zadania/1');
    const job = db.getJob(1);
    assert.equal(job.name, 'example-com');
    assert.equal(job.options.maxDepth, 1);

    const page = await get('/zadania/1');
    assert.equal(page.status, 200);
    assert.ok(page.body.includes('data-job-status="queued"'));
    assert.ok((await get('/')).body.includes('W toku'));

    const api = JSON.parse((await get('/api/aktywne')).body);
    assert.equal(api.length, 1);
    assert.equal(api[0].statusLabel, 'W kolejce');

    const retry = await post('/zadania/1/ponow', { preset: 'delikatny', delay: '600' });
    assert.equal(retry.headers.location, '/zadania/2');
    assert.equal(db.getJob(2).options.preset, 'delikatny');
    assert.ok(db.getJob(2).runAt > Date.now() + 500_000);
    assert.equal(db.getJob(2).retryOf, 1);
    await post('/zadania/1/anuluj', {});
    assert.equal(db.getJob(1).status, 'cancelled');

    assert.equal((await get('/zadania/999')).status, 404);
  });
});

test('reset-password: nowe hasło z wiersza poleceń', async () => {
  const dataDir = path.join(tmp, 'reset');
  const dbFile = path.join(dataDir, 'easycopy.db');
  await withPanel(async ({ port, form }) => {
    await setup(port, form, 'admin', 'stare-haslo-1');
  }, { dbFile });

  const lines = [];
  const orig = console.log;
  const lang = process.env.EASYCOPY_LANG;
  process.env.EASYCOPY_LANG = 'pl';
  console.log = (m) => lines.push(String(m));
  try {
    await runResetPassword(['--data-dir', dataDir]);
    await runResetPassword(['admin', '--data-dir', dataDir, '--password', 'reczne-haslo-9']);
  } finally {
    console.log = orig;
  }
  const generated = /Hasło: (\S+)/.exec(lines.join('\n'))[1];
  assert.equal(generated.length, 16);
  await assert.rejects(runResetPassword(['nie-ma', '--data-dir', dataDir]), /Nie ma konta/);
  await assert.rejects(runResetPassword(['admin', '--data-dir', dataDir, '--password', 'krotkie']), /co najmniej 8/);
  process.env.EASYCOPY_LANG = 'en';
  await assert.rejects(runResetPassword(['admin', '--data-dir', dataDir, '--password', 'short']), /at least 8/);
  if (lang === undefined) delete process.env.EASYCOPY_LANG;
  else process.env.EASYCOPY_LANG = lang;

  await withPanel(async ({ port, form }) => {
    assert.equal((await request(port, 'POST', '/logowanie', form({ username: 'admin', password: 'stare-haslo-1' }))).status, 401);
    assert.equal((await request(port, 'POST', '/logowanie', form({ username: 'admin', password: 'reczne-haslo-9' }))).status, 303);
  }, { dbFile });
});

test('jeden port: archiwa w panelu pod /a/', async () => {
  const archiveRoot = path.join(tmp, 'jeden-port');
  const { mkdir, writeFile } = await import('node:fs/promises');
  const dir = path.join(archiveRoot, 'strona', '2026-11-04');
  await mkdir(path.join(dir, 'o-nas'), { recursive: true });
  await writeFile(path.join(dir, 'index.html'), '<title>kopia</title>');
  await writeFile(path.join(dir, 'o-nas', 'index.html'), '<p>O nas</p>');
  await writeFile(path.join(dir, 'manifest.json'), JSON.stringify({ startUrl: 'https://www.example.com/', createdAt: '2026-11-04T10:00:00Z', status: 'complete', stats: { pages: 2, bytes: 100 } }));

  await withPanel(async ({ port, form }) => {
    // archiwa działają bez konta w panelu i nawet przed instalacją
    const arch = await request(port, 'GET', '/a/strona/');
    assert.equal(arch.status, 200);
    assert.ok(arch.body.includes('kopia'));
    assert.match(arch.headers['content-security-policy'], /^sandbox/);
    assert.equal((await request(port, 'GET', '/a/strona')).status, 301);
    assert.equal((await request(port, 'GET', '/a/strona/o-nas/')).status, 200);
    assert.equal((await request(port, 'GET', '/a/strona/%2e%2e/%2e%2e/')).status !== 200, true);
    // panel nadal wymaga instalacji/logowania
    assert.equal((await request(port, 'GET', '/')).headers.location, '/instalacja');

    const cookie = await setup(port, form);
    const home = await request(port, 'GET', '/', { headers: { cookie } });
    assert.ok(home.body.includes('href="/a/strona/"'), 'linki do archiwów względne, bez drugiego portu');
    assert.ok(home.body.includes('pod tym samym adresem co panel'));
  }, { archiveRoot, archivePort: 0 });

  // z hasłem do archiwów
  await withPanel(async ({ port }) => {
    assert.equal((await request(port, 'GET', '/a/strona/')).status, 401);
    const auth = `Basic ${Buffer.from('x:haslo-archiwow').toString('base64')}`;
    assert.equal((await request(port, 'GET', '/a/strona/', { headers: { authorization: auth } })).status, 200);
  }, { archiveRoot, archivePort: 0, archivePassword: 'haslo-archiwow' });
});

test('harmonogram: następny termin i zakładanie zadań', () => {
  const from = new Date(2026, 10, 4, 15, 0).getTime(); // środa 4.11, 15:00
  const at = (ms) => { const d = new Date(ms); return [d.getDate(), d.getHours(), d.getMinutes()]; };
  assert.deepEqual(at(computeNextRun({ frequency: 'daily', time: '03:00' }, from)), [5, 3, 0]);
  assert.deepEqual(at(computeNextRun({ frequency: 'daily', time: '16:30' }, from)), [4, 16, 30]);
  assert.deepEqual(at(computeNextRun({ frequency: 'weekly', time: '03:00', weekday: 1 }, from)), [9, 3, 0]);
  assert.deepEqual(at(computeNextRun({ frequency: 'weekly', time: '14:00', weekday: 3 }, from)), [11, 14, 0]);
  assert.equal(new Date(computeNextRun({ frequency: 'monthly', time: '14:00', monthday: 4 }, from)).getMonth(), 11);

  const db = openDatabase(':memory:');
  const s = db.saveSchedule({ name: 'strona', url: 'https://www.example.com/', options: { preset: 'delikatny' }, frequency: 'daily', time: '03:00', nextRunAt: from - 1000 });
  db.saveSchedule({ name: 'pozniej', url: 'https://www.example.org/', options: {}, frequency: 'daily', time: '03:00', nextRunAt: from + 60_000 });
  const created = schedulerTick(db, from);
  assert.equal(created.length, 1, 'tylko harmonogram, którego termin minął');
  const job = db.getJob(created[0]);
  assert.equal(job.name, 'strona');
  assert.equal(job.options.preset, 'delikatny');
  assert.equal(job.scheduleId, s.id);
  assert.match(pl(db.getLog(job.id)[0].message), /harmonogramu/);
  assert.ok(db.getSchedule(s.id).nextRunAt > from, 'następny termin przesunięty');
  assert.equal(db.getSchedule(s.id).lastJobId, job.id);

  // poprzednia kopia trwa → termin pominięty, bez dokładania zadań
  db.markScheduleRun(s.id, { nextRunAt: from });
  assert.deepEqual(schedulerTick(db, from + 1), []);
  assert.equal(db.listJobs().length, 1);

  // wstrzymany harmonogram nic nie robi
  db.setScheduleEnabled(s.id, false, null);
  db.requestCancel(job.id);
  const later = schedulerTick(db, from + 10 * 86_400_000);
  assert.ok(later.every((id) => db.getJob(id).name !== 'strona'), 'wstrzymany harmonogram nie zakłada zadań');
  db.close();
});

test('czytelny dziennik: etykiety i opisy błędów', () => {
  assert.equal(PL(`log.labels.${logLabel({ code: 'page' }).key}`), '✓ Pobrano');
  assert.equal(logLabel({ code: 'failed' }).problem, true);
  assert.equal(logLabel({ code: 'skipped' }).problem, false);
  assert.equal(PL(`log.labels.${logLabel({ level: 'info' }).key}`), '· Info');
  assert.equal(pl(describeFailure({ httpStatus: 404 })), 'nie ma go na serwerze (404)');
  assert.equal(pl(describeFailure({ httpStatus: 403 })), 'serwer nie daje dostępu (403)');
  assert.equal(pl(describeFailure({ httpStatus: 502 })), 'błąd serwera (502)');
  assert.match(pl(describeFailure({ error: 'timeout' })), /brak połączenia/);
});

test('panel: harmonogram, edycja zadania w kolejce, usuwanie', async () => {
  const archiveRoot = path.join(tmp, 'usuwanie');
  const { mkdir, writeFile, symlink } = await import('node:fs/promises');
  for (const v of ['2026-11-03', '2026-11-04']) {
    const dir = path.join(archiveRoot, 'strona', v);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, 'index.html'), v);
    await writeFile(path.join(dir, 'manifest.json'), JSON.stringify({ startUrl: 'https://www.example.com/', createdAt: `${v}T10:00:00Z`, status: 'complete', stats: { pages: 1, bytes: 10 } }));
  }
  await symlink('2026-11-04', path.join(archiveRoot, 'strona', 'latest'));

  await withPanel(async ({ port, db, form }) => {
    const cookie = await setup(port, form);
    const get = (p) => request(port, 'GET', p, { headers: { cookie } });
    const post = (p, data = {}) => request(port, 'POST', p, form(data, { cookie }));
    const base = { url: 'https://www.example.com/', name: 'strona', preset: 'normalny', depth: '1', maxPages: '10', maxSize: '0', sameDomain: 'on', respectRobots: 'on', ua: 'easycopy', os: 'win' };

    // nowa kopia z harmonogramem
    const created = await post('/nowa', { ...base, repeat: 'weekly', weekday: '1', time: '03:00' });
    assert.equal(created.status, 303);
    const sched = db.getScheduleByName('strona');
    assert.equal(sched.frequency, 'weekly');
    assert.equal(db.getJob(1).scheduleId, sched.id);
    assert.equal(db.getScheduleByName('strona').lastJobId, 1, 'pierwsza kopia przypisana do harmonogramu');
    assert.ok((await get('/harmonogram')).body.includes('Co tydzień, pon. 03:00'));
    assert.ok((await get('/')).body.includes('↻ Co tydzień'));

    // edycja harmonogramu – nazwy nie da się zmienić
    const edited = await post(`/harmonogram/${sched.id}/edytuj`, { ...base, name: 'inna-nazwa', preset: 'delikatny', repeat: 'daily', time: '04:30' });
    assert.equal(edited.status, 303);
    assert.equal(db.getSchedule(sched.id).name, 'strona');
    assert.equal(db.getSchedule(sched.id).time, '04:30');
    assert.equal(db.getSchedule(sched.id).options.preset, 'delikatny');
    await post(`/harmonogram/${sched.id}/wstrzymaj`);
    assert.equal(db.getSchedule(sched.id).enabled, false);
    await post(`/harmonogram/${sched.id}/wznow`);
    assert.equal(db.getSchedule(sched.id).enabled, true);

    // poprawa ustawień zadania w kolejce
    assert.equal((await get('/zadania/1/edytuj')).status, 200);
    const fixed = await post('/zadania/1/edytuj', { ...base, preset: 'szybki', depth: '2' });
    assert.equal(fixed.status, 303);
    assert.equal(db.getJob(1).options.preset, 'szybki');
    assert.equal(db.getJob(1).options.maxDepth, 2);

    // zadanie w toku blokuje usuwanie archiwum
    const blocked = await post('/archiwa/strona/usun');
    assert.equal(blocked.status, 409);
    assert.ok(existsSync(path.join(archiveRoot, 'strona')));
    assert.equal((await post('/zadania/1/usun')).status, 409, 'aktywnego zadania nie usuwamy z historii');

    // zatrzymanie (z kolejki) i usunięcie z historii
    await post('/zadania/1/anuluj');
    assert.equal(db.getJob(1).status, 'cancelled');
    assert.ok((await get('/zadania/1')).body.includes('Zatrzymane'));
    const delJob = await post('/zadania/1/usun');
    assert.equal(delJob.headers.location, '/zadania');
    assert.equal(db.getJob(1), null);

    // usunięcie wersji – latest przechodzi na poprzednią
    await post('/archiwa/strona/2026-11-04/usun');
    assert.ok(!existsSync(path.join(archiveRoot, 'strona', '2026-11-04')));
    const { readlinkSync } = await import('node:fs');
    assert.equal(readlinkSync(path.join(archiveRoot, 'strona', 'latest')), '2026-11-03');
    assert.equal((await post('/archiwa/..%2Fx/usun')).status, 404);

    // usunięcie całego archiwum razem z harmonogramem
    const leftover = db.createJob({ url: base.url, name: 'strona' });
    db.requestCancel(leftover);
    const del = await post('/archiwa/strona/usun');
    assert.equal(del.status, 303);
    assert.ok(!existsSync(path.join(archiveRoot, 'strona')));
    assert.equal(db.getScheduleByName('strona'), null);
    assert.equal(db.listJobs().length, 0);
  }, { archiveRoot });
});
