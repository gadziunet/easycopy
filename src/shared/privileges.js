// Zmiana użytkownika w kontenerze Docker (PUID/PGID, jak w obrazach dla Unraid).
// Gdy proces startuje jako root, a ustawiono PUID, zakładamy katalogi danych,
// nadajemy im właściciela i przechodzimy na zwykłego użytkownika – archiwa
// nie powstają jako pliki roota, także przy „docker compose exec”.

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
  if (uid === 0) return null; // świadomie uruchomione jako root

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
    // tylko katalogi główne i tylko gdy trzeba – bez przechodzenia całego archiwum
    if (st.uid !== uid || st.gid !== gid) chownSync(dir, uid, gid);
  }

  process.setgroups?.([gid]);
  process.setgid(gid);
  process.setuid(uid);
  process.env.HOME ??= '/tmp';
  return { uid, gid };
}
