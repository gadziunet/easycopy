// The "easycopy serve" command – runs the archive server.

import { parseArgs } from 'node:util';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

import { createArchiveServer } from './archive-server.js';
import { VERSION } from '../worker/settings.js';
import { cliLanguage, translator } from '../shared/i18n.js';

export const serveHelp = (t) => t('cli.serveHelp', { version: VERSION });

export async function runServe(argv) {
  const t = translator(cliLanguage());
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
    console.error(`${t('cli.error', { message: err.message })}\n\n${t('cli.seeHelp', { cmd: 'easycopy serve' })}`);
    process.exit(64);
  }
  const o = parsed.values;
  if (o.help) {
    console.log(serveHelp(t));
    return;
  }

  const archiveRoot = path.resolve(o.dir ?? process.env.ARCHIVE_DIR ?? 'archiwa');
  const port = Number(o.port ?? process.env.ARCHIVE_PORT ?? 8081);
  const host = o.host ?? process.env.ARCHIVE_HOST ?? '0.0.0.0';
  const password = o.password ?? process.env.ARCHIVE_PASSWORD ?? null;
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    console.error(t('cli.error', { message: t('cli.badPort', { name: 'ARCHIVE_PORT', value: o.port ?? process.env.ARCHIVE_PORT }) }));
    process.exit(64);
  }

  await mkdir(archiveRoot, { recursive: true });
  const log = o.quiet ? () => {} : (msg) => console.log(`${new Date().toISOString()} ${msg}`);
  const server = createArchiveServer({ archiveRoot, password, log, defaultLanguage: process.env.EASYCOPY_LANG || null });

  server.on('error', (err) => {
    console.error(err.code === 'EADDRINUSE' ? t('cli.portBusy', { port }) : t('cli.error', { message: err.message }));
    process.exit(1);
  });

  server.listen(port, host, () => {
    const shown = host === '0.0.0.0' || host === '::' ? 'localhost' : host;
    console.log(t('cli.serveTitle', { version: VERSION }));
    console.log(t('cli.address', { url: `http://${shown}:${port}/` }));
    console.log(t('cli.archives', { dir: archiveRoot }));
    console.log(t('cli.password', { state: t(password ? 'cli.on' : 'cli.off') }));
  });

  const stop = () => {
    console.log(t('cli.stoppingServer'));
    server.close(() => process.exit(0));
    server.closeAllConnections?.();
    setTimeout(() => process.exit(0), 3000).unref();
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}
