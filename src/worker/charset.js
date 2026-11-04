// Wykrywanie kodowania znaków i dekodowanie do tekstu.

/** Kodowanie z nagłówka Content-Type, np. "text/html; charset=ISO-8859-2". */
export function charsetFromContentType(contentType) {
  const m = /charset\s*=\s*"?([^";\s]+)/i.exec(contentType || '');
  return m ? m[1].toLowerCase() : null;
}

/** Kodowanie z <meta charset> lub <meta http-equiv="Content-Type"> w pierwszych 4 KB. */
export function charsetFromHtmlBytes(buf) {
  const head = buf.subarray(0, 4096).toString('latin1');
  let m = /<meta[^>]+charset\s*=\s*["']?\s*([a-z0-9_.:-]+)/i.exec(head);
  if (m) return m[1].toLowerCase();
  m = /<meta[^>]+content\s*=\s*["'][^"']*charset\s*=\s*([a-z0-9_.:-]+)/i.exec(head);
  return m ? m[1].toLowerCase() : null;
}

function bomCharset(buf) {
  if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) return 'utf-8';
  if (buf[0] === 0xff && buf[1] === 0xfe) return 'utf-16le';
  if (buf[0] === 0xfe && buf[1] === 0xff) return 'utf-16be';
  return null;
}

/** Dekoduje bajty do tekstu. Nieznane kodowanie → UTF-8. */
export function decodeText(buf, charset) {
  const enc = bomCharset(buf) || charset || 'utf-8';
  let decoder;
  try {
    decoder = new TextDecoder(enc, { fatal: false });
  } catch {
    decoder = new TextDecoder('utf-8', { fatal: false });
  }
  return decoder.decode(buf);
}
