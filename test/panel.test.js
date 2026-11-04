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
    const log = db.getLog(id).map((l) => l.message).join('\n');
    assert.match(log, /Start:/);
    assert.match(log, /Koniec: complete/);
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
    assert.equal(db.getJob(id).error, 'Anulowane w panelu');
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

async function withPanel(fn, { dbFile = ':memory:' } = {}) {
  const db = openDatabase(dbFile);
  const server = createPanelServer({ db, archiveRoot: path.join(tmp, 'panel-a') });
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

  await withPanel(async ({ port, form }) => {
    assert.equal((await request(port, 'POST', '/logowanie', form({ username: 'admin', password: 'stare-haslo-1' }))).status, 401);
    assert.equal((await request(port, 'POST', '/logowanie', form({ username: 'admin', password: 'reczne-haslo-9' }))).status, 303);
  }, { dbFile });
});
