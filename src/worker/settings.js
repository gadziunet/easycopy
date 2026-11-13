// Rate presets, User-Agent and helpers for parsing settings.

import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
export const VERSION = pkg.version;

// Repository address – used in the User-Agent and in the "Source code" link (AGPL requirement).
// A fork can set its own address in the EASYCOPY_PROJECT_URL variable.
export const PROJECT_URL = process.env.EASYCOPY_PROJECT_URL || 'https://github.com/gadziunet/easycopy';

/** rps – requests per second to one host, concurrency – parallel downloads. */
export const PRESETS = {
  delikatny: { label: 'Delikatny', rps: 0.5, concurrency: 1 },
  normalny: { label: 'Normalny', rps: 2, concurrency: 2 },
  szybki: { label: 'Szybki', rps: 5, concurrency: 4 },
};

const PRESET_ALIASES = { gentle: 'delikatny', normal: 'normalny', fast: 'szybki' };

export function getPreset(name = 'normalny') {
  const key = PRESET_ALIASES[name] ?? name;
  const preset = PRESETS[key];
  if (!preset) throw new Error(`Unknown preset "${name}". Available: gentle, normal, fast (or ${Object.keys(PRESETS).join(', ')})`);
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

/** Builds the User-Agent header. By default an honest EasyCopy identifier. */
export function buildUserAgent({ browser = 'easycopy', os = 'win', custom } = {}) {
  if (custom) return custom;
  const osToken = OS_TOKENS[os];
  if (!osToken) throw new Error(`Unknown system "${os}". Available: ${SYSTEMS.join(', ')}`);
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
      throw new Error(`Unknown browser "${browser}". Available: ${BROWSERS.join(', ')}`);
  }
}

/** "2GB", "500 MB", "1.5g", "0" → number of bytes (0 = no limit). */
export function parseSize(text) {
  if (text == null || text === '') return 0;
  if (typeof text === 'number') return text;
  const m = /^\s*([\d.,]+)\s*([kmgt]?)i?b?\s*$/i.exec(String(text));
  if (!m) throw new Error(`Can't understand the size "${text}" (example: 500MB, 2GB)`);
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

/** Pattern like "/cart/*" → RegExp matching the path (pathname + search). */
export function globToRegex(glob) {
  const escaped = glob.trim().replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${escaped}`);
}

/** Archive name from text, e.g. "Strona główna" → "strona-glowna" (diacritics removed). */
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
