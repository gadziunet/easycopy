// Character encoding detection and decoding to text.

/** Encoding from the Content-Type header, e.g. "text/html; charset=ISO-8859-2". */
export function charsetFromContentType(contentType) {
  const m = /charset\s*=\s*"?([^";\s]+)/i.exec(contentType || '');
  return m ? m[1].toLowerCase() : null;
}

/** Encoding from <meta charset> or <meta http-equiv="Content-Type"> in the first 4 KB. */
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

/** Decodes bytes to text. Unknown encoding → UTF-8. */
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
