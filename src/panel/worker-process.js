// Proces workera: osobny proces Node uruchamiany przez „easycopy start”.
// Bierze zadania z kolejki w bazie i wykonuje je po kolei. Awaria crawlera
// nie kładzie panelu – proces główny uruchomi workera ponownie.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';

import { openDatabase } from './db.js';
import { runJob } from './runner.js';

const POLL_MS = 1000;

export async function workerLoop({ dbFile, archiveRoot, log = console.log, isStopping = () => false }) {
  const db = openDatabase(dbFile);
  try {
    while (!isStopping()) {
      const job = db.claimNextJob();
      if (!job) {
        await sleep(POLL_MS);
        continue;
      }
      log(`Zadanie #${job.id}: ${job.url}`);
      const status = await runJob(db, job, { archiveRoot, shouldStop: isStopping });
      log(`Zadanie #${job.id}: ${status}`);
    }
  } finally {
    db.close();
  }
}

// uruchomienie jako proces potomny
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dataDir = path.resolve(process.env.DATA_DIR ?? 'data');
  const archiveRoot = path.resolve(process.env.ARCHIVE_DIR ?? path.join(dataDir, 'archiwa'));
  let stopping = false;
  const stop = () => {
    stopping = true;
  };
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
  process.on('message', (msg) => {
    if (msg === 'shutdown') stop();
  });
  workerLoop({
    dbFile: path.join(dataDir, 'easycopy.db'),
    archiveRoot,
    isStopping: () => stopping,
    log: (m) => console.log(`[worker] ${m}`),
  })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(`[worker] Error: ${err.stack || err.message}`);
      process.exit(1);
    });
}
