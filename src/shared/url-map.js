// Deterministic mapping of a URL → local path in the copy.
// The same URL (and the same kind) always gives the same path, so
// links can be rewritten right away, before the target file is downloaded.

import { createHash } from 'node:crypto';
import path from 'node:path';

/** Extensions we treat as a "page" (saved as .html). */
const PAGE_EXTENSIONS = new Set([
  '', 'html', 'htm', 'xhtml', 'shtml', 'php', 'php3', 'php5', 'asp', 'aspx', 'jsp', 'jspx', 'cfm', 'cgi', 'pl',
]);

const MAX_SEGMENT = 120;
const MAX_QUERY_SUFFIX = 60;

export function hash8(text) {
  return createHash('sha1').update(text).digest('hex').slice(0, 8);
}

/** Removes the fragment (#...) and normalizes the URL. Returns null for unsupported addresses. */
export function normalizeUrl(input, base) {
  let u;
  try {
    u = base ? new URL(input, base) : new URL(input);
  } catch {
    return null;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  u.hash = '';
  return u.href;
}

/** Host without the "www." prefix – the base for comparisons within the site. */
export function baseHost(hostname) {
  return hostname.toLowerCase().replace(/^www\./, '');
}

/** Description of the site being copied. */
export function createSite(startUrl, { subdomains = false } = {}) {
  const u = new URL(startUrl);
  return { startUrl: u.href, origin: u.origin, base: baseHost(u.hostname), subdomains };
}

/** Is the host a "main" host (its files go to the root directory of the copy)? */
export function isPrimaryHost(hostname, site) {
  const h = hostname.toLowerCase();
  return h === site.base || h === `www.${site.base}`;
}

/** Does the page at this address belong to the archived site (can it be downloaded as a page)? */
export function isInScope(url, site) {
  let u;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
  if (isPrimaryHost(u.hostname, site)) return true;
  return site.subdomains && u.hostname.toLowerCase().endsWith(`.${site.base}`);
}

function safeDecode(text) {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

/** Turns any path fragment into a safe file/directory name. */
export function sanitizeSegment(segment) {
  let s = safeDecode(segment)
    // characters not allowed on Windows/macOS/Linux + control characters
    .replace(/[\u0000-\u001f\u007f\\/:*?"<>|]/g, '-')
    .trim();
  if (s === '' || s === '.' || s === '..') s = '_';
  if (s.length > MAX_SEGMENT) s = `${s.slice(0, MAX_SEGMENT - 9)}~${hash8(s)}`;
  return s;
}

function splitExt(name) {
  const dot = name.lastIndexOf('.');
  if (dot <= 0) return { stem: name, ext: '' };
  return { stem: name.slice(0, dot), ext: name.slice(dot + 1).toLowerCase() };
}

/** "?page=2&sort=asc" → "_page-2_sort-asc" (long queries are replaced with a hash). */
function querySuffix(search) {
  const q = search.replace(/^\?/, '');
  if (!q) return '';
  const readable = safeDecode(q.replace(/\+/g, ' '))
    .replace(/=/g, '-')
    .replace(/&/g, '_')
    .replace(/[\u0000-\u001f\u007f\\/:*?"<>|#%\s]/g, '-');
  if (readable.length > MAX_QUERY_SUFFIX) return `_q${hash8(q)}`;
  return `_${readable}`;
}

/**
 * Local path (POSIX, relative to the copy directory) for an address.
 * kind: 'page' | 'css' | 'js' | 'asset'
 *
 *   https://example.com/              → index.html
 *   https://example.com/about/        → about/index.html
 *   https://example.com/about         → about/index.html
 *   https://example.com/blog?page=2   → blog/index_page-2.html
 *   https://cdn.example.net/x.css     → _ext/cdn.example.net/x.css
 */
export function urlToLocalPath(url, kind, site) {
  const u = new URL(url);
  const prefix = isPrimaryHost(u.hostname, site)
    ? []
    : ['_ext', sanitizeSegment(u.port ? `${u.hostname}_${u.port}` : u.hostname)];

  const rawSegments = u.pathname.split('/').slice(1); // the first element is '' before '/'
  const last = rawSegments.pop() ?? '';
  const dirs = rawSegments.filter((s) => s !== '').map(sanitizeSegment);
  const lastName = last === '' ? '' : sanitizeSegment(last);
  const { stem, ext } = splitExt(lastName);
  const q = querySuffix(u.search);

  let parts;
  if (kind === 'page' && PAGE_EXTENSIONS.has(ext)) {
    if (lastName === '' || ext === '') {
      // /about, /about/ → about/index.html
      parts = [...dirs, ...(lastName ? [lastName] : []), `index${q}.html`];
    } else {
      // /contact.php → contact.html, /about.html → about.html
      parts = [...dirs, `${stem}${q}.html`];
    }
  } else {
    const forcedExt = kind === 'css' ? 'css' : kind === 'js' ? 'js' : null;
    let fileName;
    if (lastName === '') {
      fileName = `index${q}.${forcedExt ?? 'bin'}`;
    } else if (forcedExt && ext !== forcedExt) {
      // e.g. fonts.googleapis.com/css2?family=... → css2_family-....css
      fileName = `${lastName}${q}.${forcedExt}`;
    } else if (ext === '') {
      // file without an extension – we add .bin so it does not collide with a directory of the same name
      fileName = `${lastName}${q}.bin`;
    } else {
      fileName = `${stem}${q}.${ext}`;
    }
    parts = [...dirs, fileName];
  }
  return [...prefix, ...parts].join('/');
}

/** Relative link from file `fromPath` to file `toPath` (both POSIX), with character encoding. */
export function relativeLink(fromPath, toPath) {
  const rel = path.posix.relative(path.posix.dirname(fromPath), toPath) || path.posix.basename(toPath);
  return rel
    .split('/')
    .map((seg) => (seg === '..' ? seg : encodeSegment(seg)))
    .join('/');
}

/** Encodes a path fragment, keeping readable characters allowed in URLs (e.g. @ in logo@2x.png). */
function encodeSegment(seg) {
  // ":" and "," stay encoded: ":" could look like a scheme (a:b.png), "," separates srcset entries
  return encodeURIComponent(seg).replace(/%(40|21|24|27|28|29|2A|2B|3B|3D)/gi, (m) => decodeURIComponent(m));
}
