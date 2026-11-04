// Wykonanie jednego zadania z kolejki: robi kopię i zapisuje postęp oraz dziennik w bazie.

import { archiveSite } from '../worker/archive.js';
import { formatSize } from '../worker/settings.js';
import { MISSING_REASONS } from '../worker/special-pages.js';

const PROGRESS_INTERVAL_MS = 1000;

function crawlerStats(crawler) {
  return {
    ...crawler.stats,
    queuedPages: crawler.pageQueue.length,
    queuedFiles: crawler.resourceQueue.length,
  };
}

/**
 * Wykonuje zadanie. Zwraca status końcowy.
 * shouldStop() – funkcja sprawdzana co sekundę (zamykanie aplikacji).
 */
export async function runJob(db, job, { archiveRoot, shouldStop = () => false, crawlerOverrides = {} }) {
  let crawlerRef = null;
  let timer = null;
  const log = (level, message, code = null) => db.addLog(job.id, level, message, code);

  log('info', `Start: ${job.url}`);
  try {
    const { manifest } = await archiveSite({
      ...job.options,
      ...crawlerOverrides,
      startUrl: job.url,
      name: job.name,
      archiveRoot,
      onCrawler(crawler, { version }) {
        crawlerRef = crawler;
        db.updateProgress(job.id, { version, stats: crawlerStats(crawler) });
        log('info', `Preset: ${crawler.preset.label} (${crawler.preset.rps}/s, ${crawler.preset.concurrency} naraz) · wersja ${version}`);

        crawler.on('fetched', (e) => {
          // do dziennika trafiają strony – pliki (obrazki, CSS) tylko w statystykach
          if (e.kind === 'page' || e.kind === 'frame') log('info', `${e.httpStatus} ${formatSize(e.bytes ?? 0)} ${e.url}`, 'page');
        });
        crawler.on('failed', (e) => log('warn', `${e.httpStatus ?? 'ERR'} ${e.url}${e.error ? ` (${e.error})` : ''}`, 'failed'));
        crawler.on('skipped', (e) => {
          if (e.kind === 'page' && e.reason !== 'limit' && e.reason !== 'pauza') {
            log('info', `pominięte (${MISSING_REASONS[e.reason] ?? e.reason}) ${e.url}`, 'skipped');
          }
        });
        crawler.on('block', (b) => log('warn', `${b.message} – ${b.host}, czekam ${Math.round(b.waitMs / 1000)} s i zwalniam`, 'block'));
        crawler.on('paused', (p) => log('warn', `Wstrzymano: ${p.message} (${p.host}). EasyCopy nie obchodzi takich zabezpieczeń.`, 'paused'));
        crawler.on('limit', () => log('info', 'Osiągnięto limit rozmiaru', 'limit'));

        timer = setInterval(() => {
          db.updateProgress(job.id, { stats: crawlerStats(crawler) });
          if (db.isCancelRequested(job.id) || shouldStop()) crawler.abort();
        }, PROGRESS_INTERVAL_MS);
      },
    });

    clearInterval(timer);
    let status = manifest.status;
    let error = null;
    if (status === 'aborted') {
      status = db.isCancelRequested(job.id) ? 'cancelled' : 'aborted';
      error = status === 'cancelled' ? 'Anulowane w panelu' : 'Przerwane przez zamknięcie aplikacji';
    } else if (status === 'error') {
      const start = manifest.files.find((f) => f.path === manifest.entry);
      error = `Nie udało się pobrać strony startowej${start?.http ? ` (HTTP ${start.http})` : start?.error ? ` (${start.error})` : ''}`;
    }
    db.finishJob(job.id, { status, stats: { ...manifest.stats, queuedPages: 0, queuedFiles: 0 }, pause: manifest.pause, error });
    log(status === 'complete' || status === 'limit' ? 'info' : 'warn', `Koniec: ${status} · stron ${manifest.stats.pages}, plików ${manifest.stats.files}, ${formatSize(manifest.stats.bytes)}`, 'done');
    return status;
  } catch (err) {
    clearInterval(timer);
    db.finishJob(job.id, { status: 'error', stats: crawlerRef ? crawlerStats(crawlerRef) : null, error: err.message });
    log('error', `Błąd: ${err.message}`, 'error');
    return 'error';
  }
}
