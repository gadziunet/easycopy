// Warning when the database is on a network share (NFS, SMB) or on FUSE (e.g. /mnt/user on Unraid).
// SQLite on such file systems can corrupt the database, because file locking is unreliable there.

import { statfsSync } from 'node:fs';

import { msg } from '../shared/i18n.js';

const RISKY = {
  0x6969: 'NFS',
  0x517b: 'SMB',
  0xff534d42: 'CIFS/SMB',
  0xfe534d42: 'SMB2/3',
  0x65735546: 'FUSE',
};

/** Returns the name of the risky file system, or null. */
export function riskyFilesystem(dir) {
  try {
    const { type } = statfsSync(dir);
    return RISKY[type >>> 0] ?? null;
  } catch {
    return null;
  }
}

/** Warning (translatable text) or null. */
export function fsWarning(dir) {
  const fs = riskyFilesystem(dir);
  return fs ? msg('messages.fsWarning', { dir, fs }) : null;
}
