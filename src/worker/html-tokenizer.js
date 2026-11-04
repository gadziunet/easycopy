// Lekki tokenizer HTML, który pozwala zmieniać atrybuty znaczników bez
// przebudowywania całego dokumentu. Wszystko, czego nie zmieniamy, zostaje
// bajt w bajt takie samo jak w oryginale.

const RAW_TEXT_ELEMENTS = new Set(['script', 'style', 'textarea', 'title', 'xmp', 'plaintext']);

const NAMED_ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
};

/** Dekoduje encje HTML w wartości atrybutu (wystarczająco dla adresów URL). */
export function decodeEntities(text) {
  if (!text.includes('&')) return text;
  return text.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);?/gi, (match, body) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return match;
      try {
        return String.fromCodePoint(code);
      } catch {
        return match;
      }
    }
    const named = NAMED_ENTITIES[body.toLowerCase()];
    return named ?? match;
  });
}

export function escapeAttr(value) {
  return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

function isWs(ch) {
  return ch === ' ' || ch === '\n' || ch === '\t' || ch === '\r' || ch === '\f';
}

/**
 * Parsuje znacznik otwierający zaczynający się na pozycji `start` (znak '<').
 * Zwraca { name, attrs, end, closeStart, selfClosing } albo null.
 */
function parseStartTag(html, start) {
  let i = start + 1;
  const nameStart = i;
  while (i < html.length && !isWs(html[i]) && html[i] !== '>' && html[i] !== '/') i++;
  const name = html.slice(nameStart, i).toLowerCase();
  const attrs = [];
  let selfClosing = false;

  while (i < html.length) {
    const wsStart = i;
    while (i < html.length && (isWs(html[i]) || (html[i] === '/' && html[i + 1] !== '>'))) i++;
    if (i >= html.length) break;
    if (html[i] === '>') {
      return { name, attrs, end: i + 1, closeStart: i, selfClosing };
    }
    if (html[i] === '/' && html[i + 1] === '>') {
      selfClosing = true;
      return { name, attrs, end: i + 2, closeStart: i, selfClosing };
    }
    // nazwa atrybutu
    const attrStart = i;
    while (i < html.length && !isWs(html[i]) && html[i] !== '>' && !(html[i] === '/' && html[i + 1] === '>') && (html[i] !== '=' || i === attrStart)) i++;
    const attrName = html.slice(attrStart, i).toLowerCase();
    let j = i;
    while (j < html.length && isWs(html[j])) j++;
    let value = null;
    let valueStart = -1;
    let valueEnd = -1;
    let quote = '';
    if (html[j] === '=') {
      j++;
      while (j < html.length && isWs(html[j])) j++;
      if (html[j] === '"' || html[j] === "'") {
        quote = html[j];
        const close = html.indexOf(quote, j + 1);
        valueStart = j + 1;
        valueEnd = close === -1 ? html.length : close;
        i = close === -1 ? html.length : close + 1;
      } else {
        valueStart = j;
        while (j < html.length && !isWs(html[j]) && html[j] !== '>') j++;
        valueEnd = j;
        i = j;
      }
      value = html.slice(valueStart, valueEnd);
    }
    attrs.push({
      name: attrName,
      raw: value,
      value: value === null ? null : decodeEntities(value),
      wsStart,
      start: attrStart,
      end: i,
    });
  }
  return { name, attrs, end: html.length, closeStart: html.length, selfClosing };
}

/** Szuka zamknięcia elementu raw-text (np. </script>) bez rozróżniania wielkości liter. */
function findRawTextEnd(html, from, name) {
  const lower = html.toLowerCase();
  const needle = `</${name}`;
  let idx = lower.indexOf(needle, from);
  while (idx !== -1) {
    const after = lower[idx + needle.length];
    if (after === undefined || after === '>' || after === '/' || isWs(after)) return idx;
    idx = lower.indexOf(needle, idx + 1);
  }
  return html.length;
}

/**
 * Przechodzi przez dokument i wywołuje `visitor` dla każdego znacznika otwierającego
 * oraz dla zawartości <style>. Visitor zmienia znacznik przez API obiektu `tag`.
 *
 * visitor.tag(tag)          – tag.name, tag.get(n), tag.has(n), tag.attrs,
 *                              tag.set(n, v), tag.remove(n), tag.add(n, v),
 *                              tag.drop() (usuwa cały znacznik), tag.after(html)
 * visitor.styleText(css)    – zwraca nową zawartość elementu <style>
 */
export function rewriteHtml(html, visitor) {
  const out = [];
  let pos = 0; // początek fragmentu, którego jeszcze nie skopiowaliśmy
  let i = 0;

  while (i < html.length) {
    const lt = html.indexOf('<', i);
    if (lt === -1) break;
    i = lt;

    if (html.startsWith('<!--', i)) {
      const end = html.indexOf('-->', i + 4);
      i = end === -1 ? html.length : end + 3;
      continue;
    }
    const next = html[i + 1];
    if (next === '!' || next === '?') {
      const end = html.indexOf('>', i + 2);
      i = end === -1 ? html.length : end + 1;
      continue;
    }
    if (next === '/') {
      const end = html.indexOf('>', i + 2);
      i = end === -1 ? html.length : end + 1;
      continue;
    }
    if (!next || !/[a-zA-Z]/.test(next)) {
      i++;
      continue;
    }

    const parsed = parseStartTag(html, i);
    const tagStart = i;
    i = parsed.end;

    const edits = []; // { start, end, text } – w obrębie oryginalnego znacznika
    let dropped = false;
    let afterText = '';
    const inserts = [];

    const tag = {
      name: parsed.name,
      attrs: parsed.attrs,
      has(name) {
        return parsed.attrs.some((a) => a.name === name);
      },
      get(name) {
        const a = parsed.attrs.find((x) => x.name === name);
        return a ? a.value : undefined;
      },
      set(name, value) {
        const a = parsed.attrs.find((x) => x.name === name);
        if (!a) return tag.add(name, value);
        edits.push({ start: a.start, end: a.end, text: `${a.name}="${escapeAttr(value)}"` });
        a.value = value;
        return tag;
      },
      remove(name) {
        for (const a of parsed.attrs) {
          if (a.name === name) edits.push({ start: a.wsStart, end: a.end, text: '' });
        }
        return tag;
      },
      add(name, value) {
        inserts.push(` ${name}="${escapeAttr(value)}"`);
        return tag;
      },
      drop() {
        dropped = true;
        return tag;
      },
      after(text) {
        afterText += text;
        return tag;
      },
    };

    visitor.tag?.(tag);

    if (dropped || edits.length || inserts.length || afterText) {
      out.push(html.slice(pos, tagStart));
      if (!dropped) {
        let tagText = html.slice(tagStart, parsed.end);
        const closeRel = parsed.closeStart - tagStart;
        // wstawki przed zamknięciem znacznika, edycje od końca, żeby nie przesuwać pozycji
        if (inserts.length) tagText = tagText.slice(0, closeRel) + inserts.join('') + tagText.slice(closeRel);
        edits.sort((a, b) => b.start - a.start);
        for (const e of edits) {
          const s = e.start - tagStart;
          const en = e.end - tagStart;
          tagText = tagText.slice(0, s) + e.text + tagText.slice(en);
        }
        out.push(tagText);
      }
      out.push(afterText);
      pos = parsed.end;
    }

    if (RAW_TEXT_ELEMENTS.has(parsed.name) && !parsed.selfClosing) {
      const rawEnd = findRawTextEnd(html, i, parsed.name);
      if (parsed.name === 'style' && visitor.styleText && !dropped) {
        const css = html.slice(i, rawEnd);
        const newCss = visitor.styleText(css);
        if (newCss !== css) {
          out.push(html.slice(pos, i));
          out.push(newCss);
          pos = rawEnd;
        }
      }
      i = rawEnd;
    }
  }

  out.push(html.slice(pos));
  return out.join('');
}

/** Parsuje atrybut srcset na listę { url, descriptor }. */
export function parseSrcset(value) {
  const result = [];
  let i = 0;
  const s = value;
  while (i < s.length) {
    while (i < s.length && (isWs(s[i]) || s[i] === ',')) i++;
    if (i >= s.length) break;
    const urlStart = i;
    while (i < s.length && !isWs(s[i])) i++;
    let url = s.slice(urlStart, i);
    let descriptor = '';
    if (url.endsWith(',')) {
      url = url.replace(/,+$/, '');
    } else {
      const descStart = i;
      while (i < s.length && s[i] !== ',') i++;
      descriptor = s.slice(descStart, i).trim();
    }
    if (url) result.push({ url, descriptor });
  }
  return result;
}

export function serializeSrcset(items) {
  return items.map((it) => (it.descriptor ? `${it.url} ${it.descriptor}` : it.url)).join(', ');
}
