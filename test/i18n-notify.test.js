import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { languageFromHeader, localize, msg, normalizeLanguage, translator, cliLanguage } from '../src/shared/i18n.js';
import en from '../src/shared/locales/en.js';
import pl from '../src/shared/locales/pl.js';
import { openDatabase } from '../src/panel/db.js';
import { createPanelServer } from '../src/panel/panel-server.js';
import { runJob } from '../src/panel/runner.js';
import { loadNotifySettings, notifyJob, parseNotifyForm, saveNotifySettings } from '../src/panel/notify.js';
import { createArchiveServer } from '../src/server/archive-server.js';
import { startTestSite } from './helpers/test-site.js';

let tmp;
before(async () => {
  tmp = await mkdtemp(path.join(tmpdir(), 'easycopy-i18n-'));
});
after(async () => {
  await rm(tmp, { recursive: true, force: true });
});

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

/** Local HTTP server that records notification requests. */
async function startReceiver({ status = 200 } = {}) {
  const calls = [];
  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      calls.push({ method: req.method, url: req.url, headers: req.headers, body: Buffer.concat(chunks).toString() });
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end('{}');
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  return {
    base,
    calls,
    close: () => new Promise((r) => {
      server.closeAllConnections();
      server.close(r);
    }),
  };
}

async function withPanel(fn, options = {}) {
  const db = openDatabase(':memory:');
  const server = createPanelServer({ db, archiveRoot: path.join(tmp, 'a'), ...options });
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

// ---------- dictionaries ----------

function keys(obj, prefix = '') {
  return Object.entries(obj).flatMap(([k, v]) => {
    if (v && typeof v === 'object' && !('one' in v)) return keys(v, `${prefix}${k}.`);
    return [`${prefix}${k}`];
  });
}

test('the English and Polish dictionaries have the same keys', () => {
  assert.deepEqual(keys(pl).sort(), keys(en).sort());
});

test('translator: plurals, sizes, fallback and stored messages', () => {
  const t = translator('en');
  const p = translator('pl-PL');
  assert.equal(p.lang, 'pl');
  assert.equal(t.count(1, 'units.pages'), '1 page');
  assert.equal(t.count(5, 'units.pages'), '5 pages');
  assert.equal(p.count(1, 'units.pages'), '1 strona');
  assert.equal(p.count(3, 'units.pages'), '3 strony');
  assert.equal(p.count(5, 'units.pages'), '5 stron');
  assert.equal(p.count(22, 'units.pages'), '22 strony');
  assert.equal(p.count(12, 'units.pages'), '12 stron');
  assert.equal(t.size(2300), '2.2 KB');
  assert.equal(p.size(2300), '2,2 KB');
  assert.equal(t('no.such.key'), 'no.such.key');

  const stored = msg('log.failed', { what: '@log.whatFile', reason: '@failure.notFound', url: 'https://www.example.com/a.png' });
  assert.equal(localize(t, stored), 'File – not on the server (404) · https://www.example.com/a.png');
  assert.equal(localize(p, stored), 'Plik – nie ma go na serwerze (404) · https://www.example.com/a.png');
  assert.equal(localize(t, msg('log.page', { size: { $size: 2048 }, url: 'x' })), 'page, 2 KB · x');
  assert.equal(localize(t, 'plain old text'), 'plain old text');
  assert.equal(localize(t, '@not a key'), '@not a key');

  assert.equal(normalizeLanguage('pl_PL.UTF-8'), 'pl');
  assert.equal(normalizeLanguage('de'), null);
  assert.equal(languageFromHeader('de-DE,pl;q=0.9,en;q=0.8'), 'pl');
  assert.equal(languageFromHeader('fr'), 'en');
  assert.equal(cliLanguage({ LANG: 'pl_PL.UTF-8' }), 'pl');
  assert.equal(cliLanguage({ EASYCOPY_LANG: 'en', LANG: 'pl_PL.UTF-8' }), 'en');
  assert.equal(cliLanguage({}), 'en');
});

// ---------- panel language ----------

test('panel: English by default, Polish from the browser, the cookie or the account', async () => {
  await withPanel(async ({ port, db, form }) => {
    const setup = await request(port, 'GET', '/instalacja');
    assert.match(setup.body, /<html lang="en">/);
    assert.ok(setup.body.includes('Create the administrator account'));

    const fromBrowser = await request(port, 'GET', '/instalacja', { headers: { 'accept-language': 'pl-PL,pl;q=0.9,en;q=0.5' } });
    assert.ok(fromBrowser.body.includes('Utwórz konto administratora'));

    // ?lang=pl → cookie and a redirect without the parameter
    const choose = await request(port, 'GET', '/instalacja?lang=pl');
    assert.equal(choose.status, 303);
    assert.equal(choose.headers.location, '/instalacja');
    const langCookie = cookieOf(choose);
    assert.equal(langCookie, 'ec_lang=pl');
    const withCookie = await request(port, 'GET', '/instalacja', { headers: { cookie: langCookie } });
    assert.match(withCookie.body, /<html lang="pl">/);

    // validation messages in English
    const bad = await request(port, 'POST', '/instalacja', form({ username: 'ad', password: 'short', repeat: 'x' }));
    assert.equal(bad.status, 422);
    assert.ok(bad.body.includes('Username: 3–32 characters'));
    assert.ok(bad.body.includes('at least 8 characters'));

    // the account is created in Polish (cookie) → the account's language is Polish
    const created = await request(port, 'POST', '/instalacja', form({ username: 'admin', password: 'secret-pass', repeat: 'secret-pass' }, { cookie: langCookie }));
    const session = cookieOf(created);
    assert.equal(db.getUserByName('admin').language, 'pl');
    assert.equal(loadNotifySettings(db).language, 'pl', 'notifications in the setup language');
    const home = await request(port, 'GET', '/', { headers: { cookie: session, 'accept-language': 'en' } });
    assert.ok(home.body.includes('Nie masz jeszcze żadnych kopii'));

    // switching the account to English
    const sw = await request(port, 'POST', '/konto/jezyk', form({ language: 'en' }, { cookie: session }));
    assert.equal(sw.status, 303);
    assert.equal(db.getUserByName('admin').language, 'en');
    const home2 = await request(port, 'GET', '/', { headers: { cookie: session } });
    assert.ok(home2.body.includes('You don’t have any copies yet.'));
    assert.ok(home2.body.includes('>Notifications<'));
    const account = await request(port, 'GET', '/konto?ok=jezyk', { headers: { cookie: session } });
    assert.ok(account.body.includes('Language saved.'));

    // the new copy form in English
    const form2 = await request(port, 'GET', '/nowa', { headers: { cookie: session } });
    assert.ok(form2.body.includes('New website copy'));
    assert.ok(form2.body.includes('data-expand="Expand"'));
    assert.ok(form2.body.includes('Gentle'));
    const err = await request(port, 'POST', '/nowa', form({ url: 'ftp://x', preset: 'normalny', depth: '3', maxPages: '1', maxSize: '0' }, { cookie: session }));
    assert.ok(err.body.includes('Enter the full website address'));
  });
});

test('panel: EASYCOPY_LANG sets the default language', async () => {
  await withPanel(async ({ port }) => {
    const page = await request(port, 'GET', '/instalacja', { headers: { 'accept-language': 'en-US' } });
    assert.match(page.body, /<html lang="pl">/);
  }, { defaultLanguage: 'pl' });
});

test('archive server: language from Accept-Language', async () => {
  const root = path.join(tmp, 'empty-archives');
  const server = createArchiveServer({ archiveRoot: root });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  try {
    const enPage = await request(port, 'GET', '/');
    assert.ok(enPage.body.includes('There are no copies yet.'));
    assert.ok(enPage.body.includes('0 archives'));
    const plPage = await request(port, 'GET', '/', { headers: { 'accept-language': 'pl' } });
    assert.ok(plPage.body.includes('Nie ma jeszcze żadnych kopii.'));
    const missing = await request(port, 'GET', '/a/nie-ma/', { headers: { 'accept-language': 'pl' } });
    assert.equal(missing.status, 404);
    assert.ok(missing.body.includes('Nie ma takiego archiwum'));
    assert.ok((await request(port, 'GET', '/a/nie-ma/')).body.includes('No such archive'));
  } finally {
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
  }
});

// ---------- notifications ----------

test('notification form: validation and keeping saved secrets', () => {
  const current = loadNotifySettings({ getSetting: () => JSON.stringify({ channels: { gotify: { token: 'saved-token' } } }) });
  const params = new URLSearchParams({
    'ev.complete': 'on',
    'gotify.enabled': 'on',
    'gotify.url': 'https://gotify.example.com',
    'gotify.token': '',
    'ntfy.enabled': 'on',
    'ntfy.url': 'not a url',
    panelUrl: 'https://easycopy.example.com/',
  });
  const { settings, errors } = parseNotifyForm(params, current, 'pl');
  assert.equal(settings.channels.gotify.token, 'saved-token', 'empty secret field keeps the saved one');
  assert.equal(settings.panelUrl, 'https://easycopy.example.com');
  assert.equal(settings.language, 'pl');
  assert.equal(settings.events.complete, true);
  assert.equal(settings.events.error, false);
  assert.deepEqual(errors, { 'ntfy.url': 'notifications.invalidUrl' });
  const missing = parseNotifyForm(new URLSearchParams({ 'pushover.enabled': 'on' }), current);
  assert.deepEqual(Object.keys(missing.errors).sort(), ['pushover.token', 'pushover.user']);
});

test('notifications: every channel gets the job summary after a copy', async () => {
  const site = await startTestSite();
  const rx = await startReceiver();
  const db = openDatabase(':memory:');
  try {
    saveNotifySettings(db, {
      ...loadNotifySettings(db),
      language: 'en',
      panelUrl: 'https://easycopy.example.com',
      channels: {
        ntfy: { enabled: true, url: `${rx.base}/ntfy/backups`, token: 'tk' },
        gotify: { enabled: true, url: `${rx.base}/gotify`, token: 'gk' },
        pushover: { enabled: true, user: 'u1', token: 'p1' },
        discord: { enabled: true, url: `${rx.base}/discord` },
        webhook: { enabled: true, url: `${rx.base}/hook` },
      },
    });
    const id = db.createJob({ url: site.url, name: 'example', options: { preset: 'szybki', maxDepth: 0, maxPages: 5, language: 'en' } });
    const fetchImpl = (url, init) => fetch(String(url).replace('https://api.pushover.net/1/messages.json', `${rx.base}/pushover`), init);
    const status = await runJob(db, db.claimNextJob(), {
      archiveRoot: path.join(tmp, 'notify-a'),
      crawlerOverrides: { rps: 1000, concurrency: 4 },
      fetchImpl,
    });
    assert.equal(status, 'complete');
    const by = (p) => rx.calls.find((c) => c.url.startsWith(p));
    assert.equal(rx.calls.length, 5);

    const ntfy = by('/ntfy/backups');
    assert.equal(ntfy.headers.authorization, 'Bearer tk');
    assert.equal(ntfy.headers.click, `https://easycopy.example.com/zadania/${id}`);
    assert.match(Buffer.from(ntfy.headers.title.slice(10, -2), 'base64').toString(), /^EasyCopy: example – Done$/);
    assert.match(ntfy.body, /^1 page, \d+ files?, /);

    const gotify = JSON.parse(by('/gotify/message').body);
    assert.equal(by('/gotify/message').headers['x-gotify-key'], 'gk');
    assert.equal(gotify.title, 'EasyCopy: example – Done');

    const push = new URLSearchParams(by('/pushover').body);
    assert.equal(push.get('user'), 'u1');
    assert.equal(push.get('url_title'), 'Open the job');

    const discord = JSON.parse(by('/discord').body);
    assert.equal(discord.embeds[0].title, 'EasyCopy: example – Done');

    const hook = JSON.parse(by('/hook').body);
    assert.equal(hook.event, 'complete');
    assert.equal(hook.job.id, id);
    assert.equal(hook.stats.pages, 1);

    const notifyLog = db.getLog(id).filter((l) => l.code === 'notify');
    assert.equal(notifyLog.length, 1);
    assert.equal(localize(translator('en'), notifyLog[0].message), 'Notification sent: ntfy, Gotify, Pushover, Discord, Webhook');
  } finally {
    db.close();
    await rx.close();
    await site.close();
  }
});

test('notifications: event filter, "scheduled only" and failures in the log', async () => {
  const rx = await startReceiver({ status: 500 });
  const db = openDatabase(':memory:');
  try {
    const base = loadNotifySettings(db);
    saveNotifySettings(db, { ...base, events: { ...base.events, complete: false }, channels: { ...base.channels, webhook: { enabled: true, url: `${rx.base}/hook` } } });
    const finished = (status, scheduleId = null) => {
      const id = db.createJob({ url: 'https://www.example.com/', name: 'example', options: {}, scheduleId });
      db.claimNextJob();
      db.finishJob(id, { status, stats: { pages: 3, files: 4, bytes: 5000 }, error: status === 'error' ? msg('jobErrors.startFailedHttp', { status: 502 }) : null });
      return db.getJob(id);
    };
    assert.deepEqual(await notifyJob(db, finished('complete')), [], 'event turned off');
    assert.deepEqual(await notifyJob(db, finished('cancelled')), [], 'stopped in the panel – no notification');

    const failedJob = finished('error');
    const [result] = await notifyJob(db, failedJob);
    assert.equal(result.ok, false);
    assert.match(result.error, /HTTP 500/);
    const hook = JSON.parse(rx.calls[0].body);
    assert.equal(hook.event, 'error');
    assert.match(hook.message, /^Could not download the start page \(HTTP 502\)/);
    assert.match(localize(translator('pl'), db.getLog(failedJob.id).at(-1).message), /^Nie udało się wysłać powiadomienia \(Webhook\): HTTP 500/);

    saveNotifySettings(db, { ...loadNotifySettings(db), scheduledOnly: true });
    assert.deepEqual(await notifyJob(db, finished('error')), [], 'not from the schedule');
    assert.equal((await notifyJob(db, finished('error', 1))).length, 1);
  } finally {
    db.close();
    await rx.close();
  }
});

test('notifications page: save and send a test', async () => {
  const rx = await startReceiver();
  await withPanel(async ({ port, db, form }) => {
    const created = await request(port, 'POST', '/instalacja', form({ username: 'admin', password: 'secret-pass', repeat: 'secret-pass' }));
    const cookie = cookieOf(created);
    const page = await request(port, 'GET', '/powiadomienia', { headers: { cookie } });
    assert.equal(page.status, 200);
    assert.ok(page.body.includes('When to notify'));

    const invalid = await request(port, 'POST', '/powiadomienia', form({ 'discord.enabled': 'on', action: 'save' }, { cookie }));
    assert.equal(invalid.status, 422);
    assert.ok(invalid.body.includes('Required when the channel is enabled'));

    const save = await request(port, 'POST', '/powiadomienia', form({ 'ev.complete': 'on', 'discord.enabled': 'on', 'discord.url': `${rx.base}/discord`, action: 'save' }, { cookie }));
    assert.equal(save.status, 303);
    assert.equal(loadNotifySettings(db).channels.discord.url, `${rx.base}/discord`);
    const saved = await request(port, 'GET', '/powiadomienia?ok=1', { headers: { cookie } });
    assert.ok(saved.body.includes('Settings saved.'));
    assert.ok(!saved.body.includes(`${rx.base}/discord`), 'the Discord webhook address is a secret – not shown again');

    // the secret field left empty keeps the saved address
    const test = await request(port, 'POST', '/powiadomienia', form({ 'ev.complete': 'on', 'discord.enabled': 'on', 'discord.url': '', action: 'test' }, { cookie }));
    assert.equal(test.status, 200);
    assert.ok(test.body.includes('Test notification sent: Discord.'));
    assert.equal(JSON.parse(rx.calls[0].body).embeds[0].title, 'EasyCopy – test');
  });
  await rx.close();
});

test('_brak.html contains both languages and is written in the job language', async () => {
  const site = await startTestSite();
  const db = openDatabase(':memory:');
  try {
    db.createJob({ url: site.url, name: 'pl-copy', options: { preset: 'szybki', maxDepth: 0, maxPages: 2, language: 'pl' } });
    await runJob(db, db.claimNextJob(), { archiveRoot: path.join(tmp, 'brak-a'), crawlerOverrides: { rps: 1000, concurrency: 4 }, notify: false });
    const dir = path.join(tmp, 'brak-a', 'pl-copy');
    const { readdir } = await import('node:fs/promises');
    const version = (await readdir(dir)).find((d) => d !== 'latest');
    const page = await readFile(path.join(dir, version, '_brak.html'), 'utf8');
    assert.match(page, /<html lang="pl">/);
    assert.ok(page.includes('<h1 id="heading">Ta strona nie została zarchiwizowana</h1>'));
    assert.ok(page.includes('"heading":"This page was not archived"'), 'English text for English browsers');
  } finally {
    db.close();
    await site.close();
  }
});
