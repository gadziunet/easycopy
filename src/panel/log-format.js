// Czytelny dziennik zadania: etykiety wpisów i opisy błędów HTTP po polsku.

const LABELS = {
  page: { kind: 'ok', label: '✓ Pobrano' },
  failed: { kind: 'bad', label: '✗ Błąd' },
  skipped: { kind: 'skip', label: '– Pominięto' },
  block: { kind: 'warn', label: '⏸ Zwolnienie' },
  paused: { kind: 'warn', label: '⏸ Pauza' },
  limit: { kind: 'info', label: '■ Limit' },
  done: { kind: 'info', label: '■ Koniec' },
  schedule: { kind: 'info', label: '↻ Harmonogram' },
  error: { kind: 'bad', label: '✗ Błąd' },
  stop: { kind: 'warn', label: '■ Zatrzymano' },
};

/** Etykieta wpisu dziennika: { kind: ok|bad|skip|warn|info, label, problem } */
export function logLabel(entry) {
  const def = LABELS[entry.code] ?? (entry.level === 'error' ? LABELS.error : { kind: 'info', label: '· Info' });
  return { ...def, problem: def.kind === 'bad' || def.kind === 'warn' };
}

/** „nie ma takiego pliku na serwerze (404)” itp. */
export function describeFailure({ httpStatus, error, reason }) {
  if (reason === 'za-duzy') return 'plik większy niż dozwolony limit';
  const s = Number(httpStatus);
  if (!s) return `brak połączenia${error ? ` (${error})` : ''}`;
  if (s === 404) return 'nie ma go na serwerze (404)';
  if (s === 410) return 'został usunięty z serwera (410)';
  if (s === 401 || s === 403) return `serwer nie daje dostępu (${s})`;
  if (s >= 500) return `błąd serwera (${s})`;
  return `serwer odrzucił zapytanie (${s})`;
}

export const STATUS_WORDS = {
  complete: 'Gotowe',
  limit: 'Gotowe – osiągnięto limit',
  paused: 'Wstrzymane przez blokadę serwera',
  cancelled: 'Zatrzymane w panelu',
  aborted: 'Przerwane',
  error: 'Błąd',
};
