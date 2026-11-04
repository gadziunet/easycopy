#!/usr/bin/env node
// EasyCopy – wiersz poleceń workera.

import { parseArgs } from 'node:util';
import path from 'node:path';

import { archiveSite } from './worker/archive.js';
import { BROWSERS, PRESETS, SYSTEMS, VERSION, formatSize, parseSize } from './worker/settings.js';
import { MISSING_REASONS } from './worker/special-pages.js';
import { runServe } from './server/serve-cli.js';
import { dropPrivilegesIfNeeded } from './shared/privileges.js';

const HELP = `EasyCopy ${VERSION} – kopia strony WWW do przeglądania offline

Użycie:
  easycopy <adres> [opcje]      zrób kopię strony
  easycopy start [opcje]        uruchom panel, serwer archiwów i workera (easycopy start --help)
  easycopy serve [opcje]        uruchom sam serwer archiwów (easycopy serve --help)

Podstawowe:
  -o, --out <katalog>        katalog archiwów (ARCHIVE_DIR, domyślnie ./archiwa)
  -n, --name <nazwa>         nazwa archiwum (domyślnie z domeny)
  -p, --preset <nazwa>       tempo: ${Object.keys(PRESETS).join(' | ')} (domyślnie normalny)
  -d, --depth <n>            głębokość: ile kliknięć od strony startowej (domyślnie 3, „bez-limitu”)
      --max-pages <n>        maks. liczba stron (domyślnie 500, 0 = bez limitu)
      --max-size <rozmiar>   maks. rozmiar kopii, np. 500MB, 2GB (domyślnie bez limitu)

Zakres:
      --subdomains           pobieraj też subdomeny (np. blog.example.com)
      --skip <lista>         pomijaj typy plików, np. mp4,zip,iso
      --exclude <wzorce>     pomijaj adresy, np. "/koszyk/*,/konto/*"
      --no-robots            ignoruj robots.txt (tylko dla własnych stron!)

Zachowanie kopii:
      --external-new-tab     linki do innych stron otwieraj w nowej karcie
      --allow-js             oznacz kopię jako „z JavaScriptem” (dla serwera archiwów)

Identyfikacja:
      --ua <przeglądarka>    ${BROWSERS.join(' | ')} (domyślnie easycopy)
      --os <system>          ${SYSTEMS.join(' | ')} (domyślnie win)
      --user-agent <tekst>   własny nagłówek User-Agent

Inne:
  -q, --quiet                wypisuj tylko podsumowanie
  -h, --help                 ta pomoc
  -v, --version              wersja

Przykład:
  easycopy https://www.example.com/ --preset delikatny --depth 2 --skip mp4,zip
`;

const STATUS_LABEL = {
  complete: 'Gotowe',
  limit: 'Gotowe – osiągnięto limit',
  paused: 'Wstrzymane – serwer ogranicza lub blokuje pobieranie',
  aborted: 'Przerwane',
  error: 'Błąd – nie udało się pobrać strony startowej',
};

function list(value) {
  return value ? value.split(',').map((s) => s.trim()).filter(Boolean) : [];
}

function int(value, label) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) throw new Error(`${label}: oczekiwana liczba całkowita ≥ 0, podano „${value}”`);
  return n;
}

function main() {
  try {
    dropPrivilegesIfNeeded();
  } catch (err) {
    console.error(`Błąd przy zmianie użytkownika (PUID/PGID): ${err.message}`);
    process.exit(1);
  }

  // panel ładujemy dopiero przy „start” – samo robienie kopii nie potrzebuje bazy SQLite
  const runStart = (args) => import('./panel/start.js').then((m) => m.runStart(args));
  const command = { serve: runServe, start: runStart }[process.argv[2]];
  if (command) {
    command(process.argv.slice(3)).catch((err) => {
      console.error(`Błąd: ${err.message}`);
      process.exit(1);
    });
    return;
  }

  let parsed;
  try {
    parsed = parseArgs({
      allowPositionals: true,
      options: {
        out: { type: 'string', short: 'o', default: process.env.ARCHIVE_DIR || 'archiwa' },
        name: { type: 'string', short: 'n' },
        preset: { type: 'string', short: 'p', default: 'normalny' },
        depth: { type: 'string', short: 'd', default: '3' },
        'max-pages': { type: 'string', default: '500' },
        'max-size': { type: 'string', default: '0' },
        subdomains: { type: 'boolean', default: false },
        skip: { type: 'string' },
        exclude: { type: 'string' },
        'no-robots': { type: 'boolean', default: false },
        'external-new-tab': { type: 'boolean', default: false },
        'allow-js': { type: 'boolean', default: false },
        ua: { type: 'string', default: 'easycopy' },
        os: { type: 'string', default: 'win' },
        'user-agent': { type: 'string' },
        quiet: { type: 'boolean', short: 'q', default: false },
        help: { type: 'boolean', short: 'h', default: false },
        version: { type: 'boolean', short: 'v', default: false },
      },
    });
  } catch (err) {
    console.error(`Błąd: ${err.message}\n\nUruchom „easycopy --help”, żeby zobaczyć opcje.`);
    process.exit(64);
  }

  const { values: o, positionals } = parsed;
  if (o.version) return console.log(VERSION);
  if (o.help || positionals.length === 0) {
    console.log(HELP);
    process.exit(o.help ? 0 : 64);
  }

  let startUrl = positionals[0];
  if (!/^https?:\/\//i.test(startUrl)) startUrl = `https://${startUrl}`;

  let options;
  try {
    options = {
      startUrl,
      archiveRoot: o.out,
      name: o.name,
      preset: o.preset,
      maxDepth: /^(bez-limitu|inf|-1)$/i.test(o.depth) ? -1 : int(o.depth, '--depth'),
      maxPages: int(o['max-pages'], '--max-pages'),
      maxBytes: parseSize(o['max-size']),
      subdomains: o.subdomains,
      skipExtensions: list(o.skip),
      exclude: list(o.exclude),
      respectRobots: !o['no-robots'],
      externalNewTab: o['external-new-tab'],
      allowJavaScript: o['allow-js'],
      browser: o.ua,
      os: o.os,
      userAgent: o['user-agent'] ?? null,
    };
    new URL(startUrl);
  } catch (err) {
    console.error(`Błąd: ${err.message}`);
    process.exit(64);
  }

  const log = o.quiet ? () => {} : (msg) => console.log(msg);
  let crawlerRef = null;
  let interrupted = 0;

  const onSignal = () => {
    interrupted++;
    if (interrupted > 1 || !crawlerRef) process.exit(130);
    console.log('\nPrzerywam… (kopia zostanie domknięta tym, co już pobrano; Ctrl+C ponownie = natychmiast)');
    crawlerRef.abort();
  };
  process.on('SIGINT', onSignal);
  process.on('SIGTERM', onSignal); // np. docker stop

  log(`EasyCopy ${VERSION}: ${startUrl}`);

  archiveSite({
    ...options,
    onCrawler(crawler) {
      crawlerRef = crawler;
      log(`Preset: ${crawler.preset.label} (${crawler.preset.rps}/s, ${crawler.preset.concurrency} naraz) · katalog: ${crawler.outDir}`);
      crawler.on('fetched', (e) => {
        const size = formatSize(e.bytes ?? 0).padStart(8);
        log(`  ${String(e.httpStatus ?? '').padEnd(3)} ${size}  ${e.url}`);
      });
      crawler.on('failed', (e) => log(`  ${String(e.httpStatus ?? 'ERR').padEnd(3)}           ${e.url}${e.error ? `  (${e.error})` : ''}`));
      crawler.on('block', (b) => log(`  ⏸  ${b.message} – ${b.host}, czekam ${Math.round(b.waitMs / 1000)} s i zwalniam`));
      crawler.on('paused', (p) => log(`\n  Wstrzymano pobieranie: ${p.message} (${p.host}).\n  EasyCopy nie obchodzi takich zabezpieczeń. Spróbuj później z presetem „delikatny”.`));
      crawler.on('limit', () => log('  Osiągnięto limit rozmiaru – kończę.'));
    },
  })
    .then(({ dir, manifest }) => {
      const s = manifest.stats;
      const missing = Object.values(manifest.notDownloaded).length + manifest.files.filter((f) => f.state === 'missing').length;
      console.log(`\n${STATUS_LABEL[manifest.status] ?? manifest.status}`);
      console.log(`  Strony: ${s.pages} · pliki: ${s.files} · rozmiar: ${formatSize(s.bytes)} · błędy: ${s.failed} · niepobrane: ${missing}`);
      console.log(`  Czas: ${Math.round(manifest.durationMs / 1000)} s`);
      console.log(`  Kopia: ${path.join(dir, manifest.entry)}`);
      const reasons = {};
      for (const r of Object.values(manifest.notDownloaded)) reasons[r] = (reasons[r] ?? 0) + 1;
      for (const f of manifest.files) if (f.state === 'missing') reasons[f.reason] = (reasons[f.reason] ?? 0) + 1;
      for (const [r, n] of Object.entries(reasons)) console.log(`    ${n} × ${MISSING_REASONS[r] ?? r}`);
      process.exit({ complete: 0, limit: 0, paused: 3, aborted: 130, error: 1 }[manifest.status] ?? 1);
    })
    .catch((err) => {
      console.error(`Błąd: ${err.message}`);
      process.exit(1);
    });
}

main();
