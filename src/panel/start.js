// The "easycopy start" command: panel (8080) + archive server (8081) + worker in a separate process.

import { fork } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { createArchiveServer } from '../server/archive-server.js';
import { VERSION } from '../worker/settings.js';
import { openDatabase } from './db.js';
import { schedulerTick } from './scheduler.js';
import { fsWarning } from './fs-check.js';
import { createPanelServer } from './panel-server.js';
import { cliLanguage, localize, normalizeLanguage, translator } from '../shared/i18n.js';

const WORKER_PATH = fileURLToPath(new URL('./worker-process.js', import.meta.url));

function port(t, value, name, { allowOff = false } = {}) {
  if (allowOff && /^(0|off|nie|none)$/i.test(String(value))) return 0;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 65535) throw new Error(t('cli.badPort', { name, value }));
  return n;
}

function listen(server, p, host) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(p, host, () => {
      server.off('error', reject);
      resolve();
    });
  });
}

export async function runStart(argv) {
  const t = translator(cliLanguage());
  const { values: o } = parseArgs({
    args: argv,
    options: {
      'data-dir': { type: 'string' },
      'archive-dir': { type: 'string' },
      'panel-port': { type: 'string' },
      'archive-port': { type: 'string' },
      host: { type: 'string' },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  if (o.help) {
    console.log(t('cli.startHelp', { version: VERSION }));
    return;
  }

  const env = process.env;
  const dataDir = path.resolve(o['data-dir'] ?? env.DATA_DIR ?? 'data');
  const archiveRoot = path.resolve(o['archive-dir'] ?? env.ARCHIVE_DIR ?? path.join(dataDir, 'archiwa'));
  const panelPort = port(t, o['panel-port'] ?? env.PANEL_PORT ?? 8080, 'PANEL_PORT');
  const archivePort = port(t, o['archive-port'] ?? env.ARCHIVE_PORT ?? 8081, 'ARCHIVE_PORT', { allowOff: true });
  const host = o.host ?? env.HOST ?? '0.0.0.0';
  const log = (m) => console.log(`${new Date().toISOString()} ${m}`);

  await mkdir(dataDir, { recursive: true });
  await mkdir(archiveRoot, { recursive: true });

  const warning = fsWarning(dataDir);
  if (warning) log(`WARNING: ${localize(translator('en'), warning)}`);

  const dbFile = path.join(dataDir, 'easycopy.db');
  const db = openDatabase(dbFile);
  const recovered = db.recoverInterrupted();
  if (recovered) log(`Marked ${recovered} interrupted job(s) after a restart`);
  db.pruneLogs();

  const archiveServer = archivePort ? createArchiveServer({ archiveRoot, password: env.ARCHIVE_PASSWORD || null, log: () => {}, defaultLanguage: normalizeLanguage(env.EASYCOPY_LANG) }) : null;
  const panelServer = createPanelServer({
    db,
    archiveRoot,
    archivePort,
    archivePassword: env.ARCHIVE_PASSWORD || null,
    archiveBaseUrl: env.ARCHIVE_BASE_URL || null,
    warning,
    log,
    defaultLanguage: normalizeLanguage(env.EASYCOPY_LANG),
  });

  try {
    if (archiveServer) await listen(archiveServer, archivePort, host);
    await listen(panelServer, panelPort, host);
  } catch (err) {
    console.error(err.code === 'EADDRINUSE' ? t('cli.portBusy', { port: err.port }) : t('cli.error', { message: err.message }));
    process.exit(1);
  }

  // worker w osobnym procesie – po awarii uruchamiany ponownie
  let worker = null;
  let stopping = false;
  const startWorker = () => {
    worker = fork(WORKER_PATH, [], {
      env: { ...env, DATA_DIR: dataDir, ARCHIVE_DIR: archiveRoot },
      stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
    });
    worker.on('exit', (code, signal) => {
      worker = null;
      if (stopping) return;
      log(`Worker exited (${signal ?? code}) – restarting in 2 s`);
      setTimeout(() => {
        if (!stopping) {
          db.recoverInterrupted();
          startWorker();
        }
      }, 2000);
    });
  };
  startWorker();

  // harmonogram: co 30 s sprawdzamy, czy minął termin którejś kopii cyklicznej
  const tick = () => {
    try {
      schedulerTick(db, Date.now(), log);
    } catch (err) {
      log(`Schedule error: ${err.message}`);
    }
  };
  tick();
  const schedulerTimer = setInterval(tick, 30_000);

  const shown = host === '0.0.0.0' || host === '::' ? 'localhost' : host;
  console.log(`EasyCopy ${VERSION}`);
  console.log(t('cli.panel', { url: `http://${shown}:${panelPort}/` }));
  const archivesAt = archivePort ? `http://${shown}:${archivePort}/` : `http://${shown}:${panelPort}/a/… ${t('cli.onePort')}`;
  console.log(t('cli.archivesAt', { url: `${archivesAt}${env.ARCHIVE_PASSWORD ? t('cli.withPassword') : ''}` }));
  console.log(t('cli.data', { dir: dataDir }));
  console.log(t('cli.copies', { dir: archiveRoot }));
  if (db.countUsers() === 0) console.log(t('cli.firstRun'));

  const stop = () => {
    if (stopping) return;
    stopping = true;
    clearInterval(schedulerTimer);
    log('Stopping… (the current download will be finished)');
    const finish = () => {
      panelServer.close();
      archiveServer?.close();
      panelServer.closeAllConnections?.();
      archiveServer?.closeAllConnections?.();
      db.close();
      process.exit(0);
    };
    if (!worker) return finish();
    worker.once('exit', finish);
    worker.send('shutdown');
    setTimeout(() => {
      worker?.kill('SIGKILL');
      finish();
    }, 15_000).unref();
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}
