// Rewriting addresses in CSS: url(...) and @import.

const CSS_URL_RE =
  /@import\s+(?:url\(\s*)?(?:"([^"]*)"|'([^']*)'|([^\s;'")]+))\s*\)?|url\(\s*(?:"([^"]*)"|'([^']*)'|([^)'"\s]*))\s*\)/gi;

function skippable(url) {
  const u = url.trim();
  return u === '' || u.startsWith('#') || /^(data|about|javascript|blob):/i.test(u);
}

/**
 * mapUrl(url, kind) → new address (string) or null (no change).
 * kind: 'css' for @import, 'asset' for url(...).
 */
export function rewriteCss(css, mapUrl) {
  let out = css.replace(CSS_URL_RE, (match, i1, i2, i3, u1, u2, u3) => {
    if (match[0] === '@') {
      const url = i1 ?? i2 ?? i3 ?? '';
      if (skippable(url)) return match;
      const mapped = mapUrl(url.trim(), 'css');
      return mapped == null ? match : `@import url("${mapped}")`;
    }
    const url = u1 ?? u2 ?? u3 ?? '';
    if (skippable(url)) return match;
    const mapped = mapUrl(url.trim(), 'asset');
    return mapped == null ? match : `url("${mapped}")`;
  });
  // the file is always saved in UTF-8
  out = out.replace(/@charset\s+["'][^"']*["']\s*;/i, '@charset "UTF-8";');
  return out;
}

/** Reads the encoding from the @charset rule (if present). */
export function cssCharset(textLatin1) {
  const m = /^﻿?@charset\s+"([^"]+)"/i.exec(textLatin1);
  return m ? m[1] : null;
}
