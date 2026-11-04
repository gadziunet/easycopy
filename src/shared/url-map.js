// Deterministyczne mapowanie URL → lokalna ścieżka w kopii.
// Ten sam URL (i ten sam rodzaj) zawsze daje tę samą ścieżkę, dzięki czemu
// linki można przepisać od razu, zanim plik docelowy zostanie pobrany.

import { createHash } from 'node:crypto';
import path from 'node:path';

/** Rozszerzenia, które traktujemy jako „stronę” (zapisywaną jako .html). */
const PAGE_EXTENSIONS = new Set([
  '', 'html', 'htm', 'xhtml', 'shtml', 'php', 'php3', 'php5', 'asp', 'aspx', 'jsp', 'jspx', 'cfm', 'cgi', 'pl',
]);

const MAX_SEGMENT = 120;
const MAX_QUERY_SUFFIX = 60;

export function hash8(text) {
  return createHash('sha1').update(text).digest('hex').slice(0, 8);
}

/** Usuwa fragment (#...) i normalizuje URL. Zwraca null dla nieobsługiwanych adresów. */
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

/** Host bez prefiksu „www.” – baza do porównań w obrębie witryny. */
export function baseHost(hostname) {
  return hostname.toLowerCase().replace(/^www\./, '');
}

/** Opis witryny, z której robimy kopię. */
export function createSite(startUrl, { subdomains = false } = {}) {
  const u = new URL(startUrl);
  return { startUrl: u.href, origin: u.origin, base: baseHost(u.hostname), subdomains };
}

/** Czy host jest „główny” (jego pliki lądują w katalogu głównym kopii)? */
export function isPrimaryHost(hostname, site) {
  const h = hostname.toLowerCase();
  return h === site.base || h === `www.${site.base}`;
}

/** Czy strona pod tym adresem należy do archiwizowanej witryny (może być pobierana jako strona)? */
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

/** Zamienia dowolny fragment ścieżki na bezpieczną nazwę pliku/katalogu. */
export function sanitizeSegment(segment) {
  let s = safeDecode(segment)
    // znaki niedozwolone w Windows/macOS/Linux + znaki sterujące
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

/** „?page=2&sort=asc” → „_page-2_sort-asc” (długie zapytania zamieniane na skrót). */
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
 * Lokalna ścieżka (POSIX, względna wobec katalogu kopii) dla adresu.
 * kind: 'page' | 'css' | 'js' | 'asset'
 *
 *   https://example.com/              → index.html
 *   https://example.com/o-nas/        → o-nas/index.html
 *   https://example.com/o-nas         → o-nas/index.html
 *   https://example.com/blog?page=2   → blog/index_page-2.html
 *   https://cdn.example.net/x.css     → _ext/cdn.example.net/x.css
 */
export function urlToLocalPath(url, kind, site) {
  const u = new URL(url);
  const prefix = isPrimaryHost(u.hostname, site)
    ? []
    : ['_ext', sanitizeSegment(u.port ? `${u.hostname}_${u.port}` : u.hostname)];

  const rawSegments = u.pathname.split('/').slice(1); // pierwszy element to '' przed '/'
  const last = rawSegments.pop() ?? '';
  const dirs = rawSegments.filter((s) => s !== '').map(sanitizeSegment);
  const lastName = last === '' ? '' : sanitizeSegment(last);
  const { stem, ext } = splitExt(lastName);
  const q = querySuffix(u.search);

  let parts;
  if (kind === 'page' && PAGE_EXTENSIONS.has(ext)) {
    if (lastName === '' || ext === '') {
      // /o-nas, /o-nas/ → o-nas/index.html
      parts = [...dirs, ...(lastName ? [lastName] : []), `index${q}.html`];
    } else {
      // /kontakt.php → kontakt.html, /o-nas.html → o-nas.html
      parts = [...dirs, `${stem}${q}.html`];
    }
  } else {
    const forcedExt = kind === 'css' ? 'css' : kind === 'js' ? 'js' : null;
    let fileName;
    if (lastName === '') {
      fileName = `index${q}.${forcedExt ?? 'bin'}`;
    } else if (forcedExt && ext !== forcedExt) {
      // np. fonts.googleapis.com/css2?family=... → css2_family-....css
      fileName = `${lastName}${q}.${forcedExt}`;
    } else if (ext === '') {
      // plik bez rozszerzenia – dopisujemy .bin, żeby nie kolidował z katalogiem o tej samej nazwie
      fileName = `${lastName}${q}.bin`;
    } else {
      fileName = `${stem}${q}.${ext}`;
    }
    parts = [...dirs, fileName];
  }
  return [...prefix, ...parts].join('/');
}

/** Link względny z pliku `fromPath` do pliku `toPath` (oba w formacie POSIX), z kodowaniem znaków. */
export function relativeLink(fromPath, toPath) {
  const rel = path.posix.relative(path.posix.dirname(fromPath), toPath) || path.posix.basename(toPath);
  return rel
    .split('/')
    .map((seg) => (seg === '..' ? seg : encodeSegment(seg)))
    .join('/');
}

/** Koduje fragment ścieżki, zostawiając czytelne znaki dozwolone w URL (np. @ w logo@2x.png). */
function encodeSegment(seg) {
  // „:” i „,” zostają zakodowane: „:” mógłby udawać schemat (a:b.png), „,” rozdziela srcset
  return encodeURIComponent(seg).replace(/%(40|21|24|27|28|29|2A|2B|3B|3D)/gi, (m) => decodeURIComponent(m));
}
