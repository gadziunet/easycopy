// Translations: t('key.path', { params }), plural forms, locale-aware dates and sizes.
// Supported languages: English (default) and Polish.

import en from './locales/en.js';
import pl from './locales/pl.js';

export const LANGUAGES = { en: 'English', pl: 'Polski' };
export const DEFAULT_LANGUAGE = 'en';
export const DICTS = { en, pl };
const LOCALES = { en: 'en-GB', pl: 'pl-PL' };

/** 'pl', 'pl-PL', 'pl_PL.UTF-8' → 'pl'; unknown → null */
export function normalizeLanguage(value) {
  const m = /^([a-z]{2})/i.exec(String(value ?? '').trim());
  const code = m?.[1].toLowerCase();
  return code && DICTS[code] ? code : null;
}

/** Best language from an Accept-Language header. */
export function languageFromHeader(header, fallback = DEFAULT_LANGUAGE) {
  const items = String(header ?? '')
    .split(',')
    .map((part) => {
      const [tag, ...rest] = part.trim().split(';');
      const q = rest.map((r) => /^q=([\d.]+)$/.exec(r.trim())?.[1]).find(Boolean);
      return { lang: normalizeLanguage(tag), q: q ? Number(q) : 1 };
    })
    .filter((x) => x.lang)
    .sort((a, b) => b.q - a.q);
  return items[0]?.lang ?? fallback;
}

/** Language for the command line: EASYCOPY_LANG, then the system locale. */
export function cliLanguage(env = process.env) {
  return normalizeLanguage(env.EASYCOPY_LANG) ?? normalizeLanguage(env.LC_ALL) ?? normalizeLanguage(env.LC_MESSAGES) ?? normalizeLanguage(env.LANG) ?? DEFAULT_LANGUAGE;
}

function lookup(dict, key) {
  let node = dict;
  for (const part of key.split('.')) {
    if (node == null || typeof node !== 'object') return undefined;
    node = node[part];
  }
  return node;
}

function interpolate(text, params) {
  return text.replace(/\{(\w+)\}/g, (m, name) => (params[name] == null ? m : String(params[name])));
}

function pluralForm(lang, n) {
  const abs = Math.abs(n);
  if (lang === 'pl') {
    if (abs === 1) return 'one';
    const d = abs % 10;
    const h = abs % 100;
    return d >= 2 && d <= 4 && (h < 12 || h > 14) ? 'few' : 'many';
  }
  return abs === 1 ? 'one' : 'other';
}

export function translator(language) {
  const lang = normalizeLanguage(language) ?? DEFAULT_LANGUAGE;
  const dict = DICTS[lang];
  const locale = LOCALES[lang];

  /** t('jobs.title') / t('log.page', { size, url }) */
  const t = (key, params = {}) => {
    let value = lookup(dict, key);
    if (value === undefined && lang !== DEFAULT_LANGUAGE) value = lookup(DICTS[DEFAULT_LANGUAGE], key);
    if (value === undefined) return key;
    if (typeof value === 'object' && params.count != null) value = value[pluralForm(lang, params.count)] ?? value.other ?? value.many;
    if (typeof value !== 'string') return key;
    return interpolate(value, params);
  };

  /** „5 stron” / “5 pages” */
  t.count = (n, key) => `${n} ${t(key, { count: n })}`;
  t.lang = lang;
  t.locale = locale;
  t.has = (key) => lookup(dict, key) !== undefined || lookup(DICTS[DEFAULT_LANGUAGE], key) !== undefined;

  t.size = (bytes) => {
    const b = Number(bytes) || 0;
    if (b < 1024) return `${b} B`;
    const units = ['KB', 'MB', 'GB', 'TB'];
    let v = b / 1024;
    let i = 0;
    while (v >= 1024 && i < units.length - 1) {
      v /= 1024;
      i++;
    }
    const text = v.toFixed(v >= 10 ? 0 : 1).replace(/\.0$/, '');
    return `${lang === 'pl' ? text.replace('.', ',') : text} ${units[i]}`;
  };

  t.date = (ms) => (ms ? new Date(ms).toLocaleString(locale, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
  t.time = (ms) => new Date(ms).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  t.duration = (ms) => {
    if (ms == null || ms < 0) return '—';
    const s = Math.round(ms / 1000);
    if (s < 60) return `${s} s`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m} min ${s % 60} s`;
    return `${Math.floor(m / 60)} h ${m % 60} min`;
  };

  return t;
}

// ---------- text stored for later translation (log, job errors, pause reasons) ----------
// msg('log.page', { size: { $size: 1234 }, url }) → "@log.page|{...}" – translated when displayed.
// Special parameter values: { $size: bytes }, { $duration: ms }, { $count: [n, 'units.pages'] },
// and nested "@key|…" strings.

export function msg(key, params) {
  return params && Object.keys(params).length ? `@${key}|${JSON.stringify(params)}` : `@${key}`;
}

function localizeParam(t, value) {
  if (typeof value === 'string') return localize(t, value);
  if (value && typeof value === 'object') {
    if ('$size' in value) return t.size(value.$size);
    if ('$duration' in value) return t.duration(value.$duration);
    if ('$count' in value) return t.count(value.$count[0], value.$count[1]);
  }
  return value;
}

/** Translates text stored with msg(); plain text (e.g. older log entries) is returned as is. */
export function localize(t, value) {
  if (typeof value !== 'string' || value[0] !== '@') return value ?? '';
  const sep = value.indexOf('|');
  const key = value.slice(1, sep === -1 ? undefined : sep);
  if (!/^[\w.]+$/.test(key)) return value;
  let params = {};
  if (sep !== -1) {
    try {
      params = JSON.parse(value.slice(sep + 1));
    } catch {
      return value;
    }
  }
  const resolved = Object.fromEntries(Object.entries(params).map(([k, v]) => [k, localizeParam(t, v)]));
  return t(key, resolved);
}
