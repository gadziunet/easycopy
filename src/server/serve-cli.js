// Komenda „easycopy serve” – uruchamia serwer archiwów.

import { parseArgs } from 'node:util';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

import { createArchiveServer } from './archive-server.js';
import { VERSION } from '../worker/settings.js';

export const SERVE_HELP = `EasyCopy ${VERSION} – serwer archiwów

Użycie:
  easycopy serve [opcje]

Opcje (w nawiasie zmienna środowiskowa):
  -d, --dir <katalog>      katalog archiwów (ARCHIVE_DIR, domyślnie ./archiwa)
  -p, --port <port>        port (ARCHIVE_PORT, domyślnie 8081)
      --host <adres>       adres nasłuchu (ARCHIVE_HOST, domyślnie 0.0.0.0 – cała sieć lokalna)
      --password <hasło>   hasło do archiwów (ARCHIVE_PASSWORD, domyślnie brak)
  -q, --quiet              bez logu żądań
  -h, --help               ta pomoc

Archiwa są pod adresem http://<serwer>:<port>/a/<nazwa>/ (najnowsza kopia)
oraz http://<serwer>:<port>/a/<nazwa>/<wersja>/.
`;

export async function runServe(argv) {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      options: {
        dir: { type: 'string', short: 'd' },
        port: { type: 'string', short: 'p' },
        host: { type: 'string' },
        password: { type: 'string' },
        quiet: { type: 'boolean', short: 'q', default: false },
        help: { type: 'boolean', short: 'h', default: false },
      },
    });
  } catch (err) {
    console.error(`Błąd: ${err.message}\n\nUruchom „easycopy serve --help”, żeby zobaczyć opcje.`);
    process.exit(64);
  }
  const o = parsed.values;
  if (o.help) {
    console.log(SERVE_HELP);
    return;
  }

  const archiveRoot = path.resolve(o.dir ?? process.env.ARCHIVE_DIR ?? 'archiwa');
  const port = Number(o.port ?? process.env.ARCHIVE_PORT ?? 8081);
  const host = o.host ?? process.env.ARCHIVE_HOST ?? '0.0.0.0';
  const password = o.password ?? process.env.ARCHIVE_PASSWORD ?? null;
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    console.error(`Błąd: nieprawidłowy port „${o.port ?? process.env.ARCHIVE_PORT}”`);
    process.exit(64);
  }

  await mkdir(archiveRoot, { recursive: true });
  const log = o.quiet ? () => {} : (msg) => console.log(`${new Date().toISOString()} ${msg}`);
  const server = createArchiveServer({ archiveRoot, password, log });

  server.on('error', (err) => {
    console.error(err.code === 'EADDRINUSE' ? `Błąd: port ${port} jest zajęty.` : `Błąd: ${err.message}`);
    process.exit(1);
  });

  server.listen(port, host, () => {
    const shown = host === '0.0.0.0' || host === '::' ? 'localhost' : host;
    console.log(`EasyCopy ${VERSION} – serwer archiwów`);
    console.log(`  Adres:    http://${shown}:${port}/`);
    console.log(`  Archiwa:  ${archiveRoot}`);
    console.log(`  Hasło:    ${password ? 'włączone' : 'wyłączone'}`);
  });

  const stop = () => {
    console.log('Zatrzymuję serwer…');
    server.close(() => process.exit(0));
    server.closeAllConnections?.();
    setTimeout(() => process.exit(0), 3000).unref();
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}
