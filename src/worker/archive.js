// Archive directory layout: <directory>/<name>/<date>/ and the "latest" symlink.

import { mkdir, readdir, rm, symlink, lstat } from 'node:fs/promises';
import path from 'node:path';

import { Crawler } from './crawler.js';
import { slugify } from './settings.js';

function today(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Creates the directory of a new version: 2026-11-04, and for another copy on the same day 2026-11-04-2, etc. */
export async function createVersionDir(archiveRoot, name, date = new Date()) {
  const siteDir = path.join(path.resolve(archiveRoot), name);
  await mkdir(siteDir, { recursive: true });
  const existing = new Set(await readdir(siteDir));
  const base = today(date);
  let version = base;
  for (let n = 2; existing.has(version); n++) version = `${base}-${n}`;
  const dir = path.join(siteDir, version);
  await mkdir(dir);
  return { siteDir, version, dir };
}

/** Sets the <name>/latest → <version> symlink. On systems without symlinks it is simply skipped. */
export async function updateLatest(siteDir, version) {
  const link = path.join(siteDir, 'latest');
  try {
    const st = await lstat(link).catch(() => null);
    if (st?.isSymbolicLink()) await rm(link);
    else if (st) return false; // something else with this name – we leave it alone
    await symlink(version, link, 'dir');
    return true;
  } catch {
    return false;
  }
}

export function defaultName(startUrl) {
  return slugify(new URL(startUrl).hostname.replace(/^www\./, ''));
}

/** Makes a copy of the site in <archiveRoot>/<name>/<date>/ and returns { dir, manifest }. */
export async function archiveSite({ archiveRoot, name, onCrawler, ...options }) {
  const archiveName = name ? slugify(name) : defaultName(options.startUrl);
  const { siteDir, version, dir } = await createVersionDir(archiveRoot, archiveName);
  const crawler = new Crawler({ ...options, outDir: dir });
  onCrawler?.(crawler, { name: archiveName, version, dir });
  const manifest = await crawler.run();
  if (manifest.status !== 'error') await updateLatest(siteDir, version);
  return { name: archiveName, version, dir, manifest };
}
