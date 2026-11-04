// Formularz „Nowa kopia”: wartości domyślne, odczyt i walidacja.

import { BROWSERS, PRESETS, SYSTEMS, parseSize, slugify } from '../worker/settings.js';

export const DEPTH_OPTIONS = [
  { value: '0', label: 'Tylko ta strona (0)' },
  { value: '1', label: '1 poziom' },
  { value: '2', label: '2 poziomy' },
  { value: '3', label: '3 poziomy' },
  { value: '5', label: '5 poziomów' },
  { value: 'bez-limitu', label: 'Cała witryna (bez limitu)' },
];

export const SIZE_OPTIONS = [
  { value: '500MB', label: '500 MB' },
  { value: '2GB', label: '2 GB' },
  { value: '10GB', label: '10 GB' },
  { value: '0', label: 'Bez limitu' },
];

export const FORM_DEFAULTS = {
  url: '',
  name: '',
  preset: 'normalny',
  depth: '3',
  maxPages: '500',
  maxSize: '2GB',
  sameDomain: true,
  respectRobots: true,
  allowJs: false,
  externalNewTab: false,
  skip: '',
  exclude: '',
  ua: 'easycopy',
  os: 'win',
  customUa: '',
};

const list = (text) => String(text || '').split(',').map((s) => s.trim()).filter(Boolean);

/** Wartości formularza z opcji istniejącego zadania (np. „Nowa kopia z tymi ustawieniami”). */
export function formFromJob(job) {
  const o = job.options || {};
  const size = SIZE_OPTIONS.find((s) => parseSize(s.value) === o.maxBytes);
  return {
    ...FORM_DEFAULTS,
    url: job.url,
    name: job.name,
    preset: o.preset ?? 'normalny',
    depth: o.maxDepth == null || o.maxDepth < 0 ? 'bez-limitu' : String(o.maxDepth),
    maxPages: String(o.maxPages ?? 500),
    maxSize: size ? size.value : '0',
    sameDomain: !o.subdomains,
    respectRobots: o.respectRobots !== false,
    allowJs: Boolean(o.allowJavaScript),
    externalNewTab: Boolean(o.externalNewTab),
    skip: (o.skipExtensions || []).join(', '),
    exclude: (o.exclude || []).join(', '),
    ua: o.userAgent ? 'custom' : o.browser ?? 'easycopy',
    os: o.os ?? 'win',
    customUa: o.userAgent ?? '',
  };
}

/**
 * Odczytuje formularz (URLSearchParams). Zwraca { values, errors, job }.
 * job = { url, name, options } – gotowe do zapisania, gdy brak błędów.
 */
export function parseJobForm(params) {
  const get = (k) => (params.get(k) ?? '').trim();
  const values = {
    url: get('url'),
    name: get('name'),
    preset: get('preset') || 'normalny',
    depth: get('depth') || '3',
    maxPages: get('maxPages') || '0',
    maxSize: get('maxSize') || '0',
    sameDomain: params.has('sameDomain'),
    respectRobots: params.has('respectRobots'),
    allowJs: params.has('allowJs'),
    externalNewTab: params.has('externalNewTab'),
    skip: get('skip'),
    exclude: get('exclude'),
    ua: get('ua') || 'easycopy',
    os: get('os') || 'win',
    customUa: get('customUa'),
  };
  const errors = {};

  let url = values.url;
  const otherScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(url) && !/^https?:\/\//i.test(url);
  if (url && !otherScheme && !/^https?:\/\//i.test(url)) url = `https://${url}`;
  try {
    if (otherScheme) throw new Error();
    const u = new URL(url);
    if (!['http:', 'https:'].includes(u.protocol) || !u.hostname) throw new Error();
    url = u.href;
  } catch {
    errors.url = 'Podaj pełny adres strony, np. https://www.example.com/';
  }

  if (!PRESETS[values.preset]) errors.preset = 'Wybierz tempo pobierania';
  if (!DEPTH_OPTIONS.some((d) => d.value === values.depth) && !/^\d{1,2}$/.test(values.depth)) errors.depth = 'Nieprawidłowa głębokość';
  const maxPages = Number(values.maxPages);
  if (!Number.isInteger(maxPages) || maxPages < 0 || maxPages > 1_000_000) errors.maxPages = 'Podaj liczbę od 0 (bez limitu) do 1 000 000';
  let maxBytes = 0;
  try {
    maxBytes = parseSize(values.maxSize);
  } catch {
    errors.maxSize = 'Nieprawidłowy limit rozmiaru';
  }
  if (!BROWSERS.includes(values.ua) && values.ua !== 'custom') errors.ua = 'Nieznana przeglądarka';
  if (!SYSTEMS.includes(values.os)) errors.os = 'Nieznany system';
  if (values.ua === 'custom' && !values.customUa) errors.customUa = 'Wpisz własny nagłówek User-Agent';
  if (values.customUa.length > 500) errors.customUa = 'Nagłówek User-Agent jest za długi';

  let name = values.name ? slugify(values.name) : '';
  if (!name && !errors.url) name = slugify(new URL(url).hostname.replace(/^www\./, ''));

  const job = Object.keys(errors).length
    ? null
    : {
        url,
        name,
        options: {
          preset: values.preset,
          maxDepth: values.depth === 'bez-limitu' ? -1 : Number(values.depth),
          maxPages,
          maxBytes,
          subdomains: !values.sameDomain,
          skipExtensions: list(values.skip).map((e) => e.replace(/^\./, '').toLowerCase()),
          exclude: list(values.exclude),
          respectRobots: values.respectRobots,
          allowJavaScript: values.allowJs,
          externalNewTab: values.externalNewTab,
          browser: values.ua === 'custom' ? 'easycopy' : values.ua,
          os: values.os,
          userAgent: values.ua === 'custom' ? values.customUa : null,
        },
      };
  return { values, errors, job };
}
