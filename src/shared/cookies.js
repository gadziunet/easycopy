// Cookie header parsing (shared by the panel and the archive server).

export function parseCookies(header = '') {
  const out = {};
  for (const part of String(header ?? '').split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    try {
      out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
    } catch {
      // damaged cookie – skipped
    }
  }
  return out;
}
