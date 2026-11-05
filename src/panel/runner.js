// Runs one job from the queue: makes the copy and stores progress and the log in the database.
// Log messages are stored with msg() and translated when displayed.

import { msg } from '../shared/i18n.js';
import { archiveSite } from '../worker/archive.js';
import { describeFailure } from './log-format.js';
import { notifyJob } from './notify.js';

const PROGRESS_INTERVAL_MS = 1000;

function crawlerStats(crawler) {
  return {
    ...crawler.stats,
    queuedPages: crawler.pageQueue.length,
    queuedFiles: crawler.resourceQueue.length,
  };
}

const isPage = (e) => e.kind === 'page' || e.kind === 'frame';

/**
 * Runs a job and returns the final status.
 * shouldStop() is checked every second (application shutdown).
 * notify – false turns notifications off (tests); fetchImpl – for tests.
 */
export async function runJob(db, job, { archiveRoot, shouldStop = () => false, crawlerOverrides = {}, notify = true, fetchImpl } = {}) {
  let crawlerRef = null;
  let timer = null;
  const log = (level, message, code = null) => db.addLog(job.id, level, message, code);
  let status = 'error';

  log('info', msg('log.start', { url: job.url }));
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
        log('info', msg('log.tempo', { preset: `@presets.${crawler.preset.id}.label`, rps: crawler.preset.rps, concurrency: crawler.preset.concurrency, version }));

        crawler.on('fetched', (e) => {
          // pages go to the log – files (images, CSS) only to the statistics
          if (isPage(e)) log('info', msg('log.page', { size: { $size: e.bytes ?? 0 }, url: e.url }), 'page');
        });
        crawler.on('failed', (e) => {
          log('warn', msg('log.failed', { what: isPage(e) ? '@log.whatPage' : '@log.whatFile', reason: describeFailure(e), url: e.url }), 'failed');
        });
        crawler.on('skipped', (e) => {
          if (e.kind === 'page' && e.reason !== 'limit' && e.reason !== 'pauza') {
            log('info', msg('log.skipped', { reason: `@missing.${e.reason}`, url: e.url }), 'skipped');
          }
        });
        crawler.on('block', (b) => log('warn', msg('log.block', { message: b.message, host: b.host, seconds: Math.round(b.waitMs / 1000) }), 'block'));
        crawler.on('paused', (p) => log('warn', msg('log.paused', { message: p.message, host: p.host }), 'paused'));
        crawler.on('limit', () => log('info', msg('log.limit'), 'limit'));

        timer = setInterval(() => {
          db.updateProgress(job.id, { stats: crawlerStats(crawler) });
          if (db.isCancelRequested(job.id) || shouldStop()) crawler.abort();
        }, PROGRESS_INTERVAL_MS);
      },
    });

    clearInterval(timer);
    status = manifest.status;
    let error = null;
    if (status === 'aborted') {
      status = db.isCancelRequested(job.id) ? 'cancelled' : 'aborted';
      error = msg(status === 'cancelled' ? 'jobErrors.cancelled' : 'jobErrors.aborted');
    } else if (status === 'error') {
      const start = manifest.files.find((f) => f.path === manifest.entry);
      error = start?.http
        ? msg('jobErrors.startFailedHttp', { status: start.http })
        : start?.error
          ? msg('jobErrors.startFailedDetail', { detail: start.error })
          : msg('jobErrors.startFailed');
    }
    db.finishJob(job.id, { status, stats: { ...manifest.stats, queuedPages: 0, queuedFiles: 0 }, pause: manifest.pause, error });
    const s = manifest.stats;
    let text = msg('log.done', {
      status: `@statusWords.${status}`,
      pages: { $count: [s.pages, 'units.pages'] },
      files: { $count: [s.files, 'units.files'] },
      size: { $size: s.bytes },
    });
    if (s.failed) text = msg('log.doneErrors', { text, count: s.failed });
    log(status === 'complete' || status === 'limit' ? 'info' : 'warn', text, 'done');
  } catch (err) {
    clearInterval(timer);
    db.finishJob(job.id, { status: 'error', stats: crawlerRef ? crawlerStats(crawlerRef) : null, error: err.message });
    log('error', msg('log.error', { message: err.message }), 'error');
    status = 'error';
  }
  // shutting down the app is not worth a notification – the job will just be marked as interrupted
  if (notify && !(status === 'aborted' && shouldStop())) {
    await notifyJob(db, db.getJob(job.id), { fetchImpl }).catch(() => {});
  }
  return status;
}
