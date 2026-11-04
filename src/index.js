// Publiczne API workera – z niego później skorzysta panel.
export { Crawler, DEFAULTS } from './worker/crawler.js';
export { archiveSite, createVersionDir, updateLatest } from './worker/archive.js';
export { PRESETS, buildUserAgent, parseSize, formatSize, slugify } from './worker/settings.js';
export { urlToLocalPath, relativeLink, normalizeUrl } from './shared/url-map.js';
export { createArchiveServer, createArchiveHandler } from './server/archive-server.js';
export { listArchives, latestVersion, listVersions } from './server/archives.js';
