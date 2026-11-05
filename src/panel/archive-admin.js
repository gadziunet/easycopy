// Usuwanie archiwów i wersji z dysku – z kontrolą ścieżek (nic poza katalogiem archiwów).

import { lstat, readlink, rm, symlink } from 'node:fs/promises';
import path from 'node:path';

import { NAME_RE, VERSION_RE, listVersions } from '../server/archives.js';

async function isRealDir(p) {
  try {
    const st = await lstat(p);
    return st.isDirectory() && !st.isSymbolicLink();
  } catch {
    return false;
  }
}

function siteDir(root, name) {
  if (!NAME_RE.test(name)) throw new Error('Invalid archive name');
  const dir = path.join(path.resolve(root), name);
  if (path.dirname(dir) !== path.resolve(root)) throw new Error('Invalid archive path');
  return dir;
}

/** Usuwa całe archiwum (wszystkie wersje). Zwraca true, gdy coś usunięto. */
export async function deleteArchive(root, name) {
  const dir = siteDir(root, name);
  if (!(await isRealDir(dir))) return false;
  await rm(dir, { recursive: true, force: true });
  return true;
}

/** Ustawia „latest” na najnowszą wersję albo je usuwa, gdy wersji już nie ma. */
async function fixLatest(dir, versions) {
  const link = path.join(dir, 'latest');
  let current = null;
  try {
    current = await readlink(link);
  } catch {
    // brak dowiązania
  }
  const newest = versions[versions.length - 1] ?? null;
  if (current === newest) return;
  await rm(link, { force: true });
  if (newest) await symlink(newest, link, 'dir').catch(() => {});
}

/**
 * Usuwa jedną wersję archiwum. Gdy była najnowsza, „latest” przechodzi na poprzednią.
 * Gdy była jedyna – znika całe archiwum. Zwraca { deleted, archiveGone }.
 */
export async function deleteVersion(root, name, version) {
  if (!VERSION_RE.test(version)) throw new Error('Invalid version');
  const dir = siteDir(root, name);
  const vdir = path.join(dir, version);
  if (!(await isRealDir(vdir))) return { deleted: false, archiveGone: false };
  await rm(vdir, { recursive: true, force: true });
  const left = await listVersions(root, name);
  if (!left.length) {
    await rm(dir, { recursive: true, force: true });
    return { deleted: true, archiveGone: true };
  }
  await fixLatest(dir, left);
  return { deleted: true, archiveGone: false };
}
