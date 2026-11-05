// Readable job log: entry labels and plain-language descriptions of HTTP errors.

import { msg } from '../shared/i18n.js';

const LABELS = {
  page: 'ok',
  failed: 'bad',
  skipped: 'skip',
  block: 'warn',
  paused: 'warn',
  limit: 'info',
  done: 'info',
  schedule: 'info',
  error: 'bad',
  stop: 'warn',
  notify: 'info',
};

/** Log entry label: { key (log.labels.*), kind: ok|bad|skip|warn|info, problem } */
export function logLabel(entry) {
  let key = LABELS[entry.code] ? entry.code : entry.level === 'error' ? 'error' : 'info';
  if (entry.code === 'notify' && entry.level !== 'info') key = 'notify';
  let kind = LABELS[key] ?? 'info';
  if (entry.code === 'notify' && entry.level === 'warn') kind = 'warn';
  return { key, kind, problem: kind === 'bad' || kind === 'warn' };
}

/** Failure description as translatable text ("not on the server (404)" etc.). */
export function describeFailure({ httpStatus, error, reason }) {
  if (reason === 'za-duzy') return msg('failure.tooLarge');
  const s = Number(httpStatus);
  if (!s) return error ? msg('failure.noConnectionDetail', { detail: error }) : msg('failure.noConnection');
  if (s === 404) return msg('failure.notFound');
  if (s === 410) return msg('failure.gone');
  if (s === 401 || s === 403) return msg('failure.forbidden', { status: s });
  if (s >= 500) return msg('failure.server', { status: s });
  return msg('failure.rejected', { status: s });
}
