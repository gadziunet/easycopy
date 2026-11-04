// Ostrzeżenie, gdy baza leży na udziale sieciowym (NFS, SMB) albo na FUSE (np. /mnt/user w Unraid).
// SQLite na takich systemach plików może uszkodzić bazę, bo blokady plików tam zawodzą.

import { statfsSync } from 'node:fs';

const RISKY = {
  0x6969: 'NFS',
  0x517b: 'SMB',
  0xff534d42: 'CIFS/SMB',
  0xfe534d42: 'SMB2/3',
  0x65735546: 'FUSE',
};

/** Zwraca nazwę ryzykownego systemu plików albo null. */
export function riskyFilesystem(dir) {
  try {
    const { type } = statfsSync(dir);
    return RISKY[type >>> 0] ?? null;
  } catch {
    return null;
  }
}

export function fsWarning(dir) {
  const fs = riskyFilesystem(dir);
  if (!fs) return null;
  return `Katalog z bazą (${dir}) leży na systemie plików ${fs}. SQLite może tam uszkodzić bazę – `
    + 'przenieś DATA_DIR na dysk lokalny (w Unraid: /mnt/cache/appdata/…, nie /mnt/user/…).';
}
