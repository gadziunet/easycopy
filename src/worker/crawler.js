// Crawler: pobiera witrynę do katalogu, przepisując linki w trakcie pobierania.

import { EventEmitter } from 'node:events';
import { mkdir, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

import {
  createSite, isInScope, normalizeUrl, relativeLink, urlToLocalPath,
} from '../shared/url-map.js';
import { rewritePage } from './page-rewriter.js';
import { rewriteCss, cssCharset } from './css-rewriter.js';
import { charsetFromContentType, charsetFromHtmlBytes, decodeText } from './charset.js';
import { detectBlock } from './blocking.js';
import { Robots, ALLOW_ALL } from './robots.js';
import { MISSING_PAGE, missingHref, missingPageHtml, redirectHtml } from './special-pages.js';
import { VERSION, buildUserAgent, getPreset, globToRegex } from './settings.js';

const PAGE_KINDS = new Set(['page', 'frame']);

const MIME_EXT = {
  'application/pdf': 'pdf',
  'application/zip': 'zip',
  'application/json': 'json',
  'application/xml': 'xml',
  'text/xml': 'xml',
  'text/plain': 'txt',
  'text/csv': 'csv',
  'text/css': 'css',
  'text/javascript': 'js',
  'application/javascript': 'js',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/svg+xml': 'svg',
  'image/x-icon': 'ico',
  'image/vnd.microsoft.icon': 'ico',
  'font/woff2': 'woff2',
  'font/woff': 'woff',
  'font/ttf': 'ttf',
  'font/otf': 'otf',
  'video/mp4': 'mp4',
  'audio/mpeg': 'mp3',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
};

const ACCEPT = {
  page: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  frame: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  css: 'text/css,*/*;q=0.1',
  js: '*/*',
  asset: '*/*',
};

class TooLargeError extends Error {}

export const DEFAULTS = {
  preset: 'normalny',
  maxDepth: 3,
  maxPages: 500,
  maxBytes: 0, // 0 = bez limitu
  maxFileBytes: 200 * 1024 ** 2,
  subdomains: false,
  skipExtensions: [],
  exclude: [],
  respectRobots: true,
  externalNewTab: false,
  allowJavaScript: false, // zapisywane w manifeście – używa go serwer archiwów
  browser: 'easycopy',
  os: 'win',
  userAgent: null,
  language: 'en', // language of the helper pages (_brak.html, redirects)
  acceptLanguage: null, // null = from `language`
  timeoutMs: 30_000,
  retries: 2,
  retryDelayMs: 2_000,
  maxBlocks: 3, // tyle kolejnych blokad z rzędu → pauza
  blockBaseDelayMs: 30_000,
  slowDownIntervalMs: 2_000, // po blokadzie: najwyżej 1 zapytanie na 2 s (jak preset „delikatny”)
  maxBlockWaitMs: 15 * 60_000,
};

export class Crawler extends EventEmitter {
  /**
   * @param {object} options – startUrl, outDir oraz pola z DEFAULTS
   */
  constructor(options) {
    super();
    if (!options?.startUrl) throw new Error('Missing start address');
    if (!options?.outDir) throw new Error('Missing output directory');
    this.opts = { ...DEFAULTS, ...options };
    this.preset = getPreset(this.opts.preset);
    // ręczne nadpisanie presetu (ustawienia zaawansowane, testy)
    if (this.opts.rps > 0) this.preset.rps = this.opts.rps;
    if (this.opts.concurrency > 0) this.preset.concurrency = this.opts.concurrency;
    this.startUrl = normalizeUrl(this.opts.startUrl);
    if (!this.startUrl) throw new Error(`Invalid address: ${this.opts.startUrl}`);
    this.outDir = path.resolve(this.opts.outDir);
    this.site = createSite(this.startUrl, { subdomains: this.opts.subdomains });
    this.userAgent = buildUserAgent({ browser: this.opts.browser, os: this.opts.os, custom: this.opts.userAgent });
    this.maxDepth = this.opts.maxDepth == null || this.opts.maxDepth < 0 ? Infinity : this.opts.maxDepth;
    this.skipExt = new Set(this.opts.skipExtensions.map((e) => e.replace(/^\./, '').toLowerCase()).filter(Boolean));
    this.exclude = this.opts.exclude.filter(Boolean).map(globToRegex);

    this.entries = new Map(); // ścieżka lokalna → wpis
    this.notDownloaded = new Map(); // adres → powód (głębokość, typ, wykluczenie)
    this.pageQueue = [];
    this.resourceQueue = [];
    this.hosts = new Map();
    this.active = 0;
    this.stopReason = null; // 'limit' | 'pauza' | 'aborted'
    this.pauseInfo = null;
    this.limitHit = false;
    this.pagesReserved = 0;
    this.stats = { pages: 0, files: 0, bytes: 0, failed: 0, skipped: 0 };
    this.abortController = new AbortController();
  }

  // ---------- planowanie linków ----------

  pathFor(url, kind) {
    return urlToLocalPath(url, PAGE_KINDS.has(kind) ? 'page' : kind, this.site);
  }

  filterReason(url) {
    const u = new URL(url);
    const pathWithQuery = u.pathname + u.search;
    if (this.exclude.some((re) => re.test(pathWithQuery))) return 'wykluczone';
    const last = u.pathname.split('/').pop() || '';
    const dot = last.lastIndexOf('.');
    if (dot > 0 && this.skipExt.has(last.slice(dot + 1).toLowerCase())) return 'typ';
    return null;
  }

  enqueue(url, kind, depth, localPath, referrer) {
    const entry = { url, kind, depth, path: localPath, referrer, state: 'queued', reason: null };
    this.entries.set(localPath, entry);
    (PAGE_KINDS.has(kind) ? this.pageQueue : this.resourceQueue).push(entry);
    return entry;
  }

  /** Link nawigacyjny ze strony `from`. Zwraca href albo null (link zewnętrzny – zostaje absolutny). */
  planPage(url, from) {
    if (!isInScope(url, this.site)) return null;
    const toMissing = (reason) => {
      if (!this.notDownloaded.has(url)) this.notDownloaded.set(url, reason);
      return missingHref(relativeLink(from.path, MISSING_PAGE), url, reason);
    };
    const reason = this.filterReason(url);
    if (reason) return toMissing(reason);

    const localPath = this.pathFor(url, 'page');
    const existing = this.entries.get(localPath);
    if (existing) {
      if (existing.state === 'queued' && existing.depth > from.depth + 1) existing.depth = from.depth + 1;
      return relativeLink(from.path, localPath);
    }
    if (from.depth + 1 > this.maxDepth) return toMissing('glebokosc');
    this.enqueue(url, 'page', from.depth + 1, localPath, from.url);
    return relativeLink(from.path, localPath);
  }

  /** Zasób potrzebny do wyświetlenia strony. Zwraca href lokalny albo null (zostaw adres oryginalny). */
  planResource(url, kind, from) {
    if (this.filterReason(url)) return null;
    if (kind === 'frame' && !isInScope(url, this.site)) return null; // np. osadzony film z YouTube
    const localPath = this.pathFor(url, kind);
    if (!this.entries.has(localPath)) this.enqueue(url, kind, from.depth, localPath, from.url);
    return relativeLink(from.path, localPath);
  }

  // ---------- tempo i robots.txt ----------

  hostState(host) {
    let h = this.hosts.get(host);
    if (!h) {
      h = { interval: 1000 / this.preset.rps, nextAt: 0, consecutiveBlocks: 0, robots: null };
      this.hosts.set(host, h);
    }
    return h;
  }

  async waitTurn(h) {
    const t = Math.max(Date.now(), h.nextAt);
    h.nextAt = t + h.interval;
    const wait = t - Date.now();
    if (wait > 0) await sleep(wait, undefined, { signal: this.abortController.signal }).catch(() => {});
  }

  async robotsFor(u) {
    const h = this.hostState(u.host);
    if (!h.robots) {
      h.robots = (async () => {
        try {
          const res = await fetch(`${u.origin}/robots.txt`, {
            headers: { 'user-agent': this.userAgent },
            signal: AbortSignal.timeout(this.opts.timeoutMs),
          });
          if (!res.ok) return ALLOW_ALL;
          const robots = new Robots(await res.text(), 'easycopy');
          if (robots.crawlDelay) h.interval = Math.max(h.interval, robots.crawlDelay * 1000);
          return robots;
        } catch {
          return ALLOW_ALL;
        }
      })();
    }
    return h.robots;
  }

  // ---------- pobieranie ----------

  async readBody(res) {
    const chunks = [];
    let total = 0;
    if (!res.body) return Buffer.alloc(0);
    const reader = res.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > this.opts.maxFileBytes) {
        await reader.cancel().catch(() => {});
        throw new TooLargeError(`File larger than the limit (${this.opts.maxFileBytes} B)`);
      }
      chunks.push(value);
    }
    return Buffer.concat(chunks.map((c) => Buffer.from(c)));
  }

  async fetchOnce(entry, h) {
    await this.waitTurn(h);
    entry.fetchStartedAt = performance.now();
    const headers = {
      'user-agent': this.userAgent,
      accept: ACCEPT[entry.kind] ?? '*/*',
      'accept-language': this.opts.acceptLanguage || (this.opts.language === 'pl' ? 'pl,en;q=0.8' : 'en,pl;q=0.5'),
    };
    if (entry.referrer) headers.referer = entry.referrer;
    const signal = AbortSignal.any([this.abortController.signal, AbortSignal.timeout(this.opts.timeoutMs)]);
    const res = await fetch(entry.url, { headers, redirect: 'follow', signal });
    const body = await this.readBody(res);
    const sample = body.subarray(0, 8192).toString('latin1');
    return { res, body, block: detectBlock(res.status, res.headers, sample) };
  }

  async fetchWithRetries(entry, h) {
    let lastError;
    for (let attempt = 0; attempt <= this.opts.retries; attempt++) {
      if (this.stopReason === 'aborted') throw new Error('Przerwano');
      try {
        const r = await this.fetchOnce(entry, h);
        const transient = [500, 502, 504].includes(r.res.status) || (r.res.status === 503 && !r.block);
        if (!transient || attempt === this.opts.retries) return r;
      } catch (err) {
        if (err instanceof TooLargeError) throw err;
        lastError = err;
        if (attempt === this.opts.retries) throw err;
      }
      await sleep(this.opts.retryDelayMs * 2 ** attempt, undefined, { signal: this.abortController.signal }).catch(() => {});
    }
    throw lastError ?? new Error('Download failed');
  }

  async writeLocal(localPath, data) {
    const full = path.join(this.outDir, ...localPath.split('/'));
    if (!full.startsWith(this.outDir + path.sep)) throw new Error(`Path outside the copy folder: ${localPath}`);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, data);
  }

  async exists(localPath) {
    try {
      await access(path.join(this.outDir, ...localPath.split('/')));
      return true;
    } catch {
      return false;
    }
  }

  markMissing(entry, reason) {
    entry.state = 'missing';
    entry.reason = reason;
    if (reason === 'limit') this.limitHit = true;
    this.stats.skipped++;
    this.emit('skipped', entry);
  }

  async process(entry) {
    if (this.stopReason) {
      return this.markMissing(entry, this.stopReason === 'limit' ? 'limit' : 'pauza');
    }
    // limit stron liczymy z wyprzedzeniem, bo kilka stron może być pobieranych naraz
    let reserved = false;
    if (entry.kind === 'page' && this.opts.maxPages > 0) {
      if (this.pagesReserved >= this.opts.maxPages) return this.markMissing(entry, 'limit');
      this.pagesReserved++;
      reserved = true;
    }
    try {
      await this.processEntry(entry);
    } finally {
      if (reserved && entry.state !== 'done') this.pagesReserved--;
    }
  }

  async processEntry(entry) {
    const isPage = PAGE_KINDS.has(entry.kind);
    const u = new URL(entry.url);
    const h = this.hostState(u.host);

    if (isPage && this.opts.respectRobots && isInScope(entry.url, this.site)) {
      const robots = await this.robotsFor(u);
      if (!robots.isAllowed(u.pathname + u.search)) return this.markMissing(entry, 'robots');
    }

    let result;
    try {
      result = await this.fetchWithRetries(entry, h);
    } catch (err) {
      if (this.stopReason === 'aborted') return this.markMissing(entry, 'pauza');
      entry.state = 'failed';
      entry.reason = err instanceof TooLargeError ? 'za-duzy' : 'blad';
      entry.error = err.message;
      this.stats.failed++;
      this.emit('failed', entry);
      return;
    }

    const { res, body, block } = result;
    entry.httpStatus = res.status;

    if (block) return this.handleBlock(entry, h, block);
    h.consecutiveBlocks = 0;

    if (res.status >= 400) {
      entry.state = 'failed';
      entry.reason = 'blad';
      this.stats.failed++;
      this.emit('failed', entry);
      return;
    }

    const contentType = res.headers.get('content-type') || '';
    const mime = contentType.split(';')[0].trim().toLowerCase();
    entry.contentType = mime;
    const finalUrl = res.url || entry.url;

    if (isPage) {
      if (!isInScope(finalUrl, this.site)) {
        // przekierowanie poza witrynę – zostawiamy stronę-przekierowanie do oryginału
        await this.writeLocal(entry.path, redirectHtml(finalUrl, 'external', this.opts.language));
        entry.state = 'done';
        entry.redirect = finalUrl;
      } else if (mime === 'text/html' || mime === 'application/xhtml+xml' || mime === '') {
        const charset = charsetFromContentType(contentType) || charsetFromHtmlBytes(body);
        const html = decodeText(body, charset);
        const out = rewritePage(html, {
          baseUrl: finalUrl,
          planPage: (url) => this.planPage(url, entry),
          planResource: (url, kind) => this.planResource(url, kind, entry),
          isExternal: (url) => !isInScope(url, this.site),
          externalNewTab: this.opts.externalNewTab,
        });
        await this.writeLocal(entry.path, out);
        entry.state = 'done';
        entry.bytes = Buffer.byteLength(out);
        if (entry.kind === 'page') this.stats.pages++;
      } else {
        // link do pliku (np. PDF) pod adresem wyglądającym jak strona
        let filePath = urlToLocalPath(entry.url, 'asset', this.site);
        const ext = MIME_EXT[mime];
        if (filePath.endsWith('.bin') && ext) filePath = `${filePath.slice(0, -4)}.${ext}`;
        await this.writeLocal(filePath, body);
        if (filePath !== entry.path) {
          await this.writeLocal(entry.path, redirectHtml(relativeLink(entry.path, filePath), 'openFile', this.opts.language));
        }
        entry.state = 'done';
        entry.savedAs = filePath;
        entry.bytes = body.length;
      }
    } else if (entry.kind === 'css' || mime === 'text/css') {
      const charset = charsetFromContentType(contentType) || cssCharset(body.subarray(0, 256).toString('latin1'));
      const css = decodeText(body, charset);
      const out = rewriteCss(css, (url, kind) => {
        let abs;
        try {
          abs = new URL(url, finalUrl);
        } catch {
          return null;
        }
        if (abs.protocol !== 'http:' && abs.protocol !== 'https:') return null;
        const hash = abs.hash;
        abs.hash = '';
        const href = this.planResource(abs.href, kind, entry);
        return href == null ? null : href + hash;
      });
      await this.writeLocal(entry.path, out);
      entry.state = 'done';
      entry.bytes = Buffer.byteLength(out);
    } else {
      await this.writeLocal(entry.path, body);
      entry.state = 'done';
      entry.bytes = body.length;
    }

    this.stats.files++;
    this.stats.bytes += entry.bytes ?? 0;
    this.emit('fetched', entry);

    if (this.opts.maxBytes > 0 && this.stats.bytes >= this.opts.maxBytes && !this.stopReason) {
      this.stopReason = 'limit';
      this.limitHit = true;
      this.emit('limit', { bytes: this.stats.bytes });
    }
  }

  handleBlock(entry, h, block) {
    // odpowiedzi na zapytania wysłane, zanim zauważyliśmy blokadę, to ta sama blokada –
    // przy kilku równoległych pobraniach nie liczymy jej kilka razy
    const sameEpisode = h.lastBlockAt != null && entry.fetchStartedAt < h.lastBlockAt;
    if (!sameEpisode) {
      h.consecutiveBlocks++;
      h.lastBlockAt = performance.now();
    }
    // zwalniamy dla tego hosta: do tempa „delikatnego”, a przy blokadach z rzędu coraz bardziej
    // (maksymalnie 1 zapytanie na minutę). Po udanym pobraniu tempo zostaje „delikatne”.
    const slowed = this.opts.slowDownIntervalMs * 2 ** (h.consecutiveBlocks - 1);
    h.interval = Math.min(Math.max(h.interval, slowed), 60_000);
    const tooLong = block.retryAfterMs != null && block.retryAfterMs > this.opts.maxBlockWaitMs;

    if (h.consecutiveBlocks >= this.opts.maxBlocks || tooLong || block.type === 'challenge') {
      // strona weryfikacji (Cloudflare) albo powtarzające się blokady → pauza, bez prób obejścia
      if (!this.stopReason) {
        this.stopReason = 'pauza';
        this.pauseInfo = { ...block, host: new URL(entry.url).host, at: new Date().toISOString() };
        this.emit('paused', this.pauseInfo);
      }
      this.markMissing(entry, 'pauza');
      return;
    }

    const wait = block.retryAfterMs ?? this.opts.blockBaseDelayMs * 2 ** (h.consecutiveBlocks - 1);
    h.nextAt = Date.now() + wait;
    this.emit('block', { ...block, host: new URL(entry.url).host, waitMs: wait, url: entry.url });
    // wraca na początek kolejki – spróbujemy ponownie po odczekaniu
    (PAGE_KINDS.has(entry.kind) ? this.pageQueue : this.resourceQueue).unshift(entry);
  }

  // ---------- przebieg ----------

  async worker() {
    for (;;) {
      const entry = this.resourceQueue.shift() ?? this.pageQueue.shift();
      if (!entry) {
        if (this.active === 0) return;
        await sleep(20);
        continue;
      }
      this.active++;
      try {
        await this.process(entry);
      } catch (err) {
        entry.state = 'failed';
        entry.reason = 'blad';
        entry.error = err.message;
        this.stats.failed++;
        this.emit('failed', entry);
      } finally {
        this.active--;
      }
    }
  }

  /** Przerywa pobieranie (np. Ctrl+C). Kopia zostanie domknięta tym, co już pobrano. */
  abort() {
    if (!this.stopReason || this.stopReason === 'limit') this.stopReason = 'aborted';
    this.abortController.abort();
  }

  async run() {
    this.startedAt = new Date();
    await mkdir(this.outDir, { recursive: true });
    const startPath = this.pathFor(this.startUrl, 'page');
    this.startPath = startPath;
    this.enqueue(this.startUrl, 'page', 0, startPath, null);

    await Promise.all(Array.from({ length: this.preset.concurrency }, () => this.worker()));
    return this.finalize();
  }

  async finalize() {
    // niepobrane strony z witryny → strony-przekierowania do _brak.html
    for (const entry of this.entries.values()) {
      if (entry.state === 'queued') this.markMissing(entry, this.stopReason === 'limit' ? 'limit' : 'pauza');
      if (!PAGE_KINDS.has(entry.kind) || entry.state === 'done') continue;
      if (!isInScope(entry.url, this.site)) continue;
      if (await this.exists(entry.path)) continue;
      const href = missingHref(relativeLink(entry.path, MISSING_PAGE), entry.url, entry.reason || 'blad');
      await this.writeLocal(entry.path, redirectHtml(href, 'notArchived', this.opts.language));
    }

    await this.writeLocal(MISSING_PAGE, missingPageHtml({ startPagePath: relativeLink(MISSING_PAGE, this.startPath), language: this.opts.language }));
    if (this.startPath !== 'index.html' && !(await this.exists('index.html'))) {
      await this.writeLocal('index.html', redirectHtml(relativeLink('index.html', this.startPath), 'toCopy', this.opts.language));
    }

    const startEntry = this.entries.get(this.startPath);
    let status;
    if (this.stopReason === 'aborted') status = 'aborted';
    else if (this.stopReason === 'pauza') status = 'paused';
    else if (startEntry?.state !== 'done') status = 'error';
    else if (this.limitHit) status = 'limit';
    else status = 'complete';

    const finishedAt = new Date();
    const manifest = {
      app: 'EasyCopy',
      version: VERSION,
      format: 1,
      startUrl: this.startUrl,
      entry: this.startPath,
      createdAt: this.startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs: finishedAt - this.startedAt,
      status,
      pause: this.pauseInfo,
      settings: {
        preset: this.preset.id,
        maxDepth: Number.isFinite(this.maxDepth) ? this.maxDepth : null,
        maxPages: this.opts.maxPages,
        maxBytes: this.opts.maxBytes,
        subdomains: this.opts.subdomains,
        skipExtensions: [...this.skipExt],
        exclude: this.opts.exclude,
        respectRobots: this.opts.respectRobots,
        externalNewTab: this.opts.externalNewTab,
        allowJavaScript: this.opts.allowJavaScript,
        userAgent: this.userAgent,
      },
      stats: { ...this.stats },
      files: [...this.entries.values()].map((e) => ({
        url: e.url,
        path: e.path,
        kind: e.kind,
        state: e.state,
        ...(e.httpStatus ? { http: e.httpStatus } : {}),
        ...(e.contentType ? { type: e.contentType } : {}),
        ...(e.bytes != null ? { bytes: e.bytes } : {}),
        ...(e.reason ? { reason: e.reason } : {}),
        ...(e.savedAs ? { savedAs: e.savedAs } : {}),
        ...(e.redirect ? { redirect: e.redirect } : {}),
        ...(e.error ? { error: e.error } : {}),
      })),
      notDownloaded: Object.fromEntries(this.notDownloaded),
    };
    await this.writeLocal('manifest.json', `${JSON.stringify(manifest, null, 2)}\n`);
    this.emit('done', manifest);
    return manifest;
  }
}

