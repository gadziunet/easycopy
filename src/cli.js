#!/usr/bin/env node
// EasyCopy – command line.

import { parseArgs } from 'node:util';
import path from 'node:path';

import { archiveSite } from './worker/archive.js';
import { BROWSERS, SYSTEMS, VERSION, parseSize } from './worker/settings.js';
import { cliLanguage, localize, translator } from './shared/i18n.js';
import { runServe } from './server/serve-cli.js';
import { dropPrivilegesIfNeeded } from './shared/privileges.js';

const t = translator(cliLanguage());
const HELP = t('cli.help', { version: VERSION, browsers: BROWSERS.join(' | '), systems: SYSTEMS.join(' | ') });

function list(value) {
  return value ? value.split(',').map((s) => s.trim()).filter(Boolean) : [];
}

function int(value, label) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) throw new Error(t('cli.badInt', { label, value }));
  return n;
}

function main() {
  try {
    dropPrivilegesIfNeeded();
  } catch (err) {
    console.error(t('cli.privileges', { message: err.message }));
    process.exit(1);
  }

  // panel ładujemy dopiero przy „start” – samo robienie kopii nie potrzebuje bazy SQLite
  const runStart = (args) => import('./panel/start.js').then((m) => m.runStart(args));
  const runReset = (args) => import('./panel/reset-password.js').then((m) => m.runResetPassword(args));
  const command = { serve: runServe, start: runStart, 'reset-password': runReset }[process.argv[2]];
  if (command) {
    command(process.argv.slice(3)).catch((err) => {
      console.error(t('cli.error', { message: err.message }));
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
    console.error(`${t('cli.error', { message: err.message })}\n\n${t('cli.seeHelp', { cmd: 'easycopy' })}`);
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
      maxDepth: /^(bez-limitu|all|inf|-1)$/i.test(o.depth) ? -1 : int(o.depth, '--depth'),
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
      language: t.lang,
    };
    new URL(startUrl);
  } catch (err) {
    console.error(t('cli.error', { message: err.message }));
    process.exit(64);
  }

  const log = o.quiet ? () => {} : (msg) => console.log(msg);
  let crawlerRef = null;
  let interrupted = 0;

  const onSignal = () => {
    interrupted++;
    if (interrupted > 1 || !crawlerRef) process.exit(130);
    console.log(t('cli.interrupting'));
    crawlerRef.abort();
  };
  process.on('SIGINT', onSignal);
  process.on('SIGTERM', onSignal); // np. docker stop

  log(`EasyCopy ${VERSION}: ${startUrl}`);

  archiveSite({
    ...options,
    onCrawler(crawler) {
      crawlerRef = crawler;
      log(t('cli.preset', { preset: t(`presets.${crawler.preset.id}.label`), rps: crawler.preset.rps, concurrency: crawler.preset.concurrency, dir: crawler.outDir }));
      crawler.on('fetched', (e) => {
        const size = t.size(e.bytes ?? 0).padStart(8);
        log(`  ${String(e.httpStatus ?? '').padEnd(3)} ${size}  ${e.url}`);
      });
      crawler.on('failed', (e) => log(`  ${String(e.httpStatus ?? 'ERR').padEnd(3)}           ${e.url}${e.error ? `  (${e.error})` : ''}`));
      crawler.on('block', (b) => log(t('cli.block', { message: localize(t, b.message), host: b.host, seconds: Math.round(b.waitMs / 1000) })));
      crawler.on('paused', (p) => log(t('cli.paused', { message: localize(t, p.message), host: p.host })));
      crawler.on('limit', () => log(t('cli.limit')));
    },
  })
    .then(({ dir, manifest }) => {
      const s = manifest.stats;
      const missing = Object.values(manifest.notDownloaded).length + manifest.files.filter((f) => f.state === 'missing').length;
      console.log(`\n${t.has(`cli.status.${manifest.status}`) ? t(`cli.status.${manifest.status}`) : manifest.status}`);
      console.log(t('cli.summary', { pages: s.pages, files: s.files, size: t.size(s.bytes), failed: s.failed, missing }));
      console.log(t('cli.time', { seconds: Math.round(manifest.durationMs / 1000) }));
      console.log(t('cli.copy', { path: path.join(dir, manifest.entry) }));
      const reasons = {};
      for (const r of Object.values(manifest.notDownloaded)) reasons[r] = (reasons[r] ?? 0) + 1;
      for (const f of manifest.files) if (f.state === 'missing') reasons[f.reason] = (reasons[f.reason] ?? 0) + 1;
      for (const [r, n] of Object.entries(reasons)) console.log(`    ${n} × ${t.has(`missing.${r}`) ? t(`missing.${r}`) : r}`);
      process.exit({ complete: 0, limit: 0, paused: 3, aborted: 130, error: 1 }[manifest.status] ?? 1);
    })
    .catch((err) => {
      console.error(t('cli.error', { message: err.message }));
      process.exit(1);
    });
}

main();
