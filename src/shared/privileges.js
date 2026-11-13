// Switching the user in a Docker container (PUID/PGID, as in images for Unraid).
// When the process starts as root and PUID is set, we create the data directories,
// set their owner and switch to a regular user – archives
// are not created as root-owned files, also with "docker compose exec".

import { mkdirSync, statSync, chownSync } from 'node:fs';
import path from 'node:path';

function parseId(value, name) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) throw new Error(`${name} must be a whole number ≥ 0 (got "${value}")`);
  return n;
}

export function dropPrivilegesIfNeeded(env = process.env) {
  if (typeof process.getuid !== 'function' || process.getuid() !== 0) return null;
  if (env.PUID == null || env.PUID === '') return null;

  const uid = parseId(env.PUID, 'PUID');
  const gid = parseId(env.PGID ?? env.PUID, 'PGID');
  if (uid === 0) return null; // deliberately run as root

  const dirs = new Set();
  if (env.ARCHIVE_DIR) {
    const archiveDir = path.resolve(env.ARCHIVE_DIR);
    dirs.add(path.dirname(archiveDir));
    dirs.add(archiveDir);
  }
  if (env.DATA_DIR) dirs.add(path.resolve(env.DATA_DIR));

  for (const dir of dirs) {
    mkdirSync(dir, { recursive: true });
    const st = statSync(dir);
    // only the top-level directories and only when needed – without walking the whole archive
    if (st.uid !== uid || st.gid !== gid) chownSync(dir, uid, gid);
  }

  process.setgroups?.([gid]);
  process.setgid(gid);
  process.setuid(uid);
  process.env.HOME ??= '/tmp';
  return { uid, gid };
}
