// Odczyt katalogu archiwów: <root>/<nazwa>/<wersja>/manifest.json

import { readdir, readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';

export const NAME_RE = /^[a-z0-9][a-z0-9-]{0,99}$/;
export const VERSION_RE = /^\d{4}-\d{2}-\d{2}(?:-\d{1,4})?$/;

/** Porządek wersji: data, potem numer (2026-11-04 < 2026-11-04-2 < 2026-11-04-10). */
export function compareVersions(a, b) {
  const [da, na = '1'] = [a.slice(0, 10), a.slice(11)];
  const [db, nb = '1'] = [b.slice(0, 10), b.slice(11)];
  if (da !== db) return da < db ? -1 : 1;
  return Number(na || 1) - Number(nb || 1);
}

async function isDir(p) {
  try {
    return (await stat(p)).isDirectory();
  } catch {
    return false;
  }
}

/** Lista wersji archiwum, od najstarszej. */
export async function listVersions(root, name) {
  if (!NAME_RE.test(name)) return [];
  let items;
  try {
    items = await readdir(path.join(root, name), { withFileTypes: true });
  } catch {
    return [];
  }
  return items
    .filter((d) => d.isDirectory() && VERSION_RE.test(d.name))
    .map((d) => d.name)
    .sort(compareVersions);
}

/** Najnowsza wersja: dowiązanie „latest”, a jeśli go nie ma – najnowszy katalog. */
export async function latestVersion(root, name) {
  const versions = await listVersions(root, name);
  if (!versions.length) return null;
  try {
    const target = path.basename(await realpath(path.join(root, name, 'latest')));
    if (versions.includes(target)) return target;
  } catch {
    // brak dowiązania – bierzemy najnowszy katalog
  }
  return versions[versions.length - 1];
}

export async function readManifest(root, name, version) {
  try {
    return JSON.parse(await readFile(path.join(root, name, version, 'manifest.json'), 'utf8'));
  } catch {
    return null;
  }
}

/** Podsumowanie wszystkich archiwów do strony z listą. */
export async function listArchives(root) {
  let items;
  try {
    items = await readdir(root, { withFileTypes: true });
  } catch {
    return [];
  }
  const archives = [];
  for (const d of items) {
    if (!d.isDirectory() || !NAME_RE.test(d.name)) continue;
    const versions = await listVersions(root, d.name);
    if (!versions.length) continue;
    const latest = await latestVersion(root, d.name);
    const detailed = [];
    for (const v of [...versions].reverse()) {
      const m = await readManifest(root, d.name, v);
      detailed.push({
        version: v,
        createdAt: m?.createdAt ?? null,
        status: m?.status ?? 'unknown',
        pages: m?.stats?.pages ?? null,
        bytes: m?.stats?.bytes ?? null,
      });
    }
    const latestManifest = await readManifest(root, d.name, latest);
    archives.push({
      name: d.name,
      startUrl: latestManifest?.startUrl ?? null,
      latest,
      latestInfo: detailed.find((x) => x.version === latest),
      versions: detailed,
    });
  }
  archives.sort((a, b) => (b.latestInfo?.createdAt ?? '').localeCompare(a.latestInfo?.createdAt ?? ''));
  return archives;
}

export { isDir };
