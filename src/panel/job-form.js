// Formularz „Nowa kopia”: wartości domyślne, odczyt i walidacja.

import { BROWSERS, PRESETS, SYSTEMS, parseSize, slugify } from '../worker/settings.js';
import { FREQUENCIES } from './scheduler.js';

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
  repeat: 'none',
  time: '03:00',
  weekday: '1',
  monthday: '1',
};

/** Pola harmonogramu z zapisanego harmonogramu. */
export function scheduleFormValues(schedule) {
  if (!schedule) return {};
  return {
    repeat: schedule.frequency,
    time: schedule.time,
    weekday: String(schedule.weekday ?? 1),
    monthday: String(schedule.monthday ?? 1),
  };
}

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
    repeat: get('repeat') || 'none',
    time: get('time') || '03:00',
    weekday: get('weekday') || '1',
    monthday: get('monthday') || '1',
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
    errors.url = 'errors.url';
  }

  if (!PRESETS[values.preset]) errors.preset = 'errors.preset';
  if (!DEPTH_OPTIONS.some((d) => d.value === values.depth) && !/^\d{1,2}$/.test(values.depth)) errors.depth = 'errors.depth';
  const maxPages = Number(values.maxPages);
  if (!Number.isInteger(maxPages) || maxPages < 0 || maxPages > 1_000_000) errors.maxPages = 'errors.maxPages';
  let maxBytes = 0;
  try {
    maxBytes = parseSize(values.maxSize);
  } catch {
    errors.maxSize = 'errors.maxSize';
  }
  if (!BROWSERS.includes(values.ua) && values.ua !== 'custom') errors.ua = 'errors.ua';
  if (!SYSTEMS.includes(values.os)) errors.os = 'errors.os';
  if (values.ua === 'custom' && !values.customUa) errors.customUa = 'errors.customUa';
  if (values.customUa.length > 500) errors.customUa = 'errors.customUaLong';

  let schedule = null;
  if (values.repeat !== 'none') {
    if (!FREQUENCIES[values.repeat]) errors.repeat = 'errors.repeat';
    if (!/^([01]?\d|2[0-3]):[0-5]\d$/.test(values.time)) errors.time = 'errors.time';
    const weekday = Number(values.weekday);
    const monthday = Number(values.monthday);
    if (values.repeat === 'weekly' && !(Number.isInteger(weekday) && weekday >= 0 && weekday <= 6)) errors.weekday = 'errors.weekday';
    if (values.repeat === 'monthly' && !(Number.isInteger(monthday) && monthday >= 1 && monthday <= 28)) errors.monthday = 'errors.monthday';
    schedule = {
      frequency: values.repeat,
      time: values.time.padStart(5, '0'),
      weekday: values.repeat === 'weekly' ? weekday : null,
      monthday: values.repeat === 'monthly' ? monthday : null,
    };
  }

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
  return { values, errors, job, schedule: job ? schedule : null };
}
