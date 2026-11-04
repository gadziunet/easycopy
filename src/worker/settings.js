// Presety tempa, User-Agent i pomocnicze parsowanie ustawień.

import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
export const VERSION = pkg.version;

// Adres repozytorium – trafia do User-Agenta i do linku „Kod źródłowy” (wymóg AGPL).
// Fork może podać własny adres w zmiennej EASYCOPY_PROJECT_URL.
export const PROJECT_URL = process.env.EASYCOPY_PROJECT_URL || 'https://github.com/gadziunet/easycopy';

/** rps – zapytania na sekundę do jednego hosta, concurrency – równoległe pobrania. */
export const PRESETS = {
  delikatny: { label: 'Delikatny', rps: 0.5, concurrency: 1 },
  normalny: { label: 'Normalny', rps: 2, concurrency: 2 },
  szybki: { label: 'Szybki', rps: 5, concurrency: 4 },
};

const PRESET_ALIASES = { gentle: 'delikatny', normal: 'normalny', fast: 'szybki' };

export function getPreset(name = 'normalny') {
  const key = PRESET_ALIASES[name] ?? name;
  const preset = PRESETS[key];
  if (!preset) throw new Error(`Nieznany preset „${name}”. Dostępne: ${Object.keys(PRESETS).join(', ')}`);
  return { id: key, ...preset };
}

const OS_TOKENS = {
  win: 'Windows NT 10.0; Win64; x64',
  mac: 'Macintosh; Intel Mac OS X 10_15_7',
  linux: 'X11; Linux x86_64',
  android: 'Linux; Android 14; Pixel 8',
  ios: 'iPhone; CPU iPhone OS 17_6 like Mac OS X',
};

export const BROWSERS = ['easycopy', 'chrome', 'firefox', 'safari', 'edge'];
export const SYSTEMS = Object.keys(OS_TOKENS);

/** Buduje nagłówek User-Agent. Domyślnie uczciwy identyfikator EasyCopy. */
export function buildUserAgent({ browser = 'easycopy', os = 'win', custom } = {}) {
  if (custom) return custom;
  const osToken = OS_TOKENS[os];
  if (!osToken) throw new Error(`Nieznany system „${os}”. Dostępne: ${SYSTEMS.join(', ')}`);
  const mobile = os === 'android' || os === 'ios';
  const chrome = `Mozilla/5.0 (${osToken}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0${mobile ? ' Mobile' : ''} Safari/537.36`;
  switch (browser) {
    case 'easycopy':
      return `EasyCopy/${VERSION} (+${PROJECT_URL})`;
    case 'chrome':
      return chrome;
    case 'edge':
      return `${chrome} Edg/130.0.0.0`;
    case 'firefox':
      return `Mozilla/5.0 (${osToken}; rv:131.0) Gecko/20100101 Firefox/131.0`;
    case 'safari':
      return `Mozilla/5.0 (${osToken}) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6${mobile ? ' Mobile/15E148' : ''} Safari/605.1.15`;
    default:
      throw new Error(`Nieznana przeglądarka „${browser}”. Dostępne: ${BROWSERS.join(', ')}`);
  }
}

/** „2GB”, „500 MB”, „1.5g”, „0” → liczba bajtów (0 = bez limitu). */
export function parseSize(text) {
  if (text == null || text === '') return 0;
  if (typeof text === 'number') return text;
  const m = /^\s*([\d.,]+)\s*([kmgt]?)i?b?\s*$/i.exec(String(text));
  if (!m) throw new Error(`Nie rozumiem rozmiaru „${text}” (przykład: 500MB, 2GB)`);
  const n = Number(m[1].replace(',', '.'));
  const mult = { '': 1, k: 1024, m: 1024 ** 2, g: 1024 ** 3, t: 1024 ** 4 }[m[2].toLowerCase()];
  return Math.round(n * mult);
}

export function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let v = bytes / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 10 ? 0 : 1).replace(/\.0$/, '').replace('.', ',')} ${units[i]}`;
}

/** Wzorzec typu „/koszyk/*” → RegExp dopasowujący ścieżkę (pathname + search). */
export function globToRegex(glob) {
  const escaped = glob.trim().replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${escaped}`);
}

/** Nazwa archiwum z tekstu: „Strona główna” → „strona-glowna”. */
export function slugify(text) {
  const map = { ą: 'a', ć: 'c', ę: 'e', ł: 'l', ń: 'n', ó: 'o', ś: 's', ź: 'z', ż: 'z' };
  return (
    text
      .toLowerCase()
      .replace(/[ąćęłńóśźż]/g, (c) => map[c])
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'archiwum'
  );
}
