// Komenda „easycopy start”: panel (8080) + serwer archiwów (8081) + worker w osobnym procesie.

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

export const START_HELP = `EasyCopy ${VERSION} – panel, serwer archiwów i worker

Użycie:
  easycopy start [opcje]

Opcje (w nawiasie zmienna środowiskowa):
      --data-dir <katalog>      baza i ustawienia (DATA_DIR, domyślnie ./data)
      --archive-dir <katalog>   archiwa (ARCHIVE_DIR, domyślnie <data-dir>/archiwa)
      --panel-port <port>       port panelu (PANEL_PORT, domyślnie 8080)
      --archive-port <port>     port serwera archiwów (ARCHIVE_PORT, domyślnie 8081;
                                0 = jeden port: archiwa w panelu pod /a/…)
      --host <adres>            adres nasłuchu (HOST, domyślnie 0.0.0.0)
  -h, --help                    ta pomoc

Przy pierwszym uruchomieniu panel poprosi o utworzenie konta administratora.
Zapomniane hasło: easycopy reset-password

Inne zmienne środowiskowe:
  ARCHIVE_PASSWORD   hasło do archiwów (domyślnie brak)
  ARCHIVE_BASE_URL   adres archiwów w linkach panelu, np. za reverse proxy
                     (domyślnie http://<host panelu>:<port archiwów>)
`;

const WORKER_PATH = fileURLToPath(new URL('./worker-process.js', import.meta.url));

function port(value, name, { allowOff = false } = {}) {
  if (allowOff && /^(0|off|nie|none)$/i.test(String(value))) return 0;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 65535) throw new Error(`${name}: nieprawidłowy port „${value}”`);
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
    console.log(START_HELP);
    return;
  }

  const env = process.env;
  const dataDir = path.resolve(o['data-dir'] ?? env.DATA_DIR ?? 'data');
  const archiveRoot = path.resolve(o['archive-dir'] ?? env.ARCHIVE_DIR ?? path.join(dataDir, 'archiwa'));
  const panelPort = port(o['panel-port'] ?? env.PANEL_PORT ?? 8080, 'PANEL_PORT');
  const archivePort = port(o['archive-port'] ?? env.ARCHIVE_PORT ?? 8081, 'ARCHIVE_PORT', { allowOff: true });
  const host = o.host ?? env.HOST ?? '0.0.0.0';
  const log = (m) => console.log(`${new Date().toISOString()} ${m}`);

  await mkdir(dataDir, { recursive: true });
  await mkdir(archiveRoot, { recursive: true });

  const warning = fsWarning(dataDir);
  if (warning) log(`UWAGA: ${warning}`);

  const dbFile = path.join(dataDir, 'easycopy.db');
  const db = openDatabase(dbFile);
  const recovered = db.recoverInterrupted();
  if (recovered) log(`Oznaczono ${recovered} przerwane zadanie(a) po restarcie`);
  db.pruneLogs();

  const archiveServer = archivePort ? createArchiveServer({ archiveRoot, password: env.ARCHIVE_PASSWORD || null, log: () => {} }) : null;
  const panelServer = createPanelServer({
    db,
    archiveRoot,
    archivePort,
    archivePassword: env.ARCHIVE_PASSWORD || null,
    archiveBaseUrl: env.ARCHIVE_BASE_URL || null,
    warning,
    log,
  });

  try {
    if (archiveServer) await listen(archiveServer, archivePort, host);
    await listen(panelServer, panelPort, host);
  } catch (err) {
    console.error(err.code === 'EADDRINUSE' ? `Błąd: port ${err.port} jest zajęty.` : `Błąd: ${err.message}`);
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
      log(`Worker zakończył się (${signal ?? code}) – uruchamiam ponownie za 2 s`);
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
      log(`Błąd harmonogramu: ${err.message}`);
    }
  };
  tick();
  const schedulerTimer = setInterval(tick, 30_000);

  const shown = host === '0.0.0.0' || host === '::' ? 'localhost' : host;
  console.log(`EasyCopy ${VERSION}`);
  console.log(`  Panel:     http://${shown}:${panelPort}/`);
  const archivesAt = archivePort ? `http://${shown}:${archivePort}/` : `http://${shown}:${panelPort}/a/… (jeden port)`;
  console.log(`  Archiwa:   ${archivesAt}${env.ARCHIVE_PASSWORD ? ' (z hasłem)' : ''}`);
  console.log(`  Dane:      ${dataDir}`);
  console.log(`  Kopie:     ${archiveRoot}`);
  if (db.countUsers() === 0) console.log('  Pierwsze uruchomienie: otwórz panel i utwórz konto administratora.');

  const stop = () => {
    if (stopping) return;
    stopping = true;
    clearInterval(schedulerTimer);
    log('Zatrzymuję… (bieżące pobieranie zostanie domknięte)');
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
