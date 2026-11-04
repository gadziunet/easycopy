// Przepisywanie adresów w pobranej stronie HTML.
// Decyzje „co z tym linkiem zrobić” podejmuje crawler (ctx.planPage / ctx.planResource),
// tutaj tylko rozpoznajemy, gdzie w HTML są adresy i jakiego są rodzaju.

import { rewriteHtml, parseSrcset, serializeSrcset } from './html-tokenizer.js';
import { rewriteCss } from './css-rewriter.js';

const SKIP_SCHEME = /^\s*(#|javascript:|mailto:|tel:|sms:|data:|blob:|about:|file:)/i;

/** Atrybuty z adresem zasobu (obrazek, wideo itd.) – dla dowolnego elementu. */
const LAZY_ATTRS = ['data-src', 'data-lazy-src', 'data-original', 'data-bg', 'data-background', 'data-background-image'];
const LAZY_SRCSET_ATTRS = ['data-srcset', 'data-lazy-srcset'];

/** Atrybuty z adresem zasobu zależnie od elementu. */
const RESOURCE_ATTRS = {
  img: ['src'],
  source: ['src'],
  video: ['src', 'poster'],
  audio: ['src'],
  track: ['src'],
  embed: ['src'],
  object: ['data'],
  input: ['src'],
  image: ['href', 'xlink:href'], // SVG <image>
  use: ['href', 'xlink:href'], // SVG <use>
  body: ['background'],
  table: ['background'],
  td: ['background'],
  th: ['background'],
};

const SRCSET_ELEMENTS = new Set(['img', 'source']);

function linkRelKind(rel, as) {
  const tokens = (rel || '').toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.includes('stylesheet')) return 'css';
  if (tokens.includes('modulepreload')) return 'js';
  if (tokens.includes('preload') || tokens.includes('prefetch')) {
    const a = (as || '').toLowerCase();
    if (a === 'style') return 'css';
    if (a === 'script') return 'js';
    if (a === 'font' || a === 'image' || a === 'fetch') return 'asset';
    return null;
  }
  if (tokens.some((t) => t === 'icon' || t === 'apple-touch-icon' || t === 'apple-touch-icon-precomposed' || t === 'mask-icon')) {
    return 'asset';
  }
  return null; // canonical, alternate, manifest itd. – zostawiamy jako adres absolutny
}

function splitHash(value) {
  const idx = value.indexOf('#');
  return idx === -1 ? [value, ''] : [value.slice(0, idx), value.slice(idx)];
}

/**
 * ctx:
 *   baseUrl                          – adres strony (po przekierowaniach)
 *   planPage(absUrl)                 – link nawigacyjny → href (lokalny, _brak.html…) albo null = zostaw absolutny
 *   planResource(absUrl, kind)       – zasób → href lokalny albo null = zostaw absolutny
 *   isExternal(absUrl)               – czy adres spoza archiwizowanej witryny
 *   externalNewTab                   – dodawaj target="_blank" do linków zewnętrznych
 */
export function rewritePage(html, ctx) {
  let baseUrl = ctx.baseUrl;
  const hasMetaCharset = /<meta[^>]+charset/i.test(html);
  let charsetInserted = hasMetaCharset;

  const resolve = (value) => {
    if (value == null) return null;
    const v = value.trim();
    if (v === '' || SKIP_SCHEME.test(v)) return null;
    try {
      const u = new URL(v, baseUrl);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
      return u;
    } catch {
      return null;
    }
  };

  const mapNav = (value) => {
    const u = resolve(value);
    if (!u) return null;
    const hash = u.hash;
    u.hash = '';
    const href = ctx.planPage(u.href);
    if (href == null) return u.href + hash;
    // _brak.html#… ma już własny fragment – nie doklejamy kotwicy
    return href.includes('#') ? href : href + hash;
  };

  const mapResource = (value, kind) => {
    const u = resolve(value);
    if (!u) return null;
    const hash = u.hash;
    u.hash = '';
    const href = ctx.planResource(u.href, kind);
    return (href == null ? u.href : href) + hash;
  };

  const cssMapper = (cssBase) => (url, kind) => {
    let u;
    try {
      u = new URL(url, cssBase);
    } catch {
      return null;
    }
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    const [clean, hash] = splitHash(u.href);
    const href = ctx.planResource(clean, kind === 'css' ? 'css' : 'asset');
    return (href == null ? clean : href) + hash;
  };

  const rewriteSrcset = (tag, attr) => {
    const value = tag.get(attr);
    if (!value) return;
    const items = parseSrcset(value).map((it) => ({ ...it, url: mapResource(it.url, 'asset') ?? it.url }));
    tag.set(attr, serializeSrcset(items));
  };

  const setIf = (tag, attr, newValue) => {
    if (newValue != null && newValue !== tag.get(attr)) tag.set(attr, newValue);
  };

  const result = rewriteHtml(html, {
    tag(tag) {
      const name = tag.name;

      if (name === 'base') {
        const u = resolve(tag.get('href'));
        if (u) baseUrl = u.href;
        tag.drop();
        return;
      }

      if (name === 'head' && !charsetInserted) {
        tag.after('<meta charset="utf-8">');
        charsetInserted = true;
      }

      if (name === 'meta') {
        const httpEquiv = (tag.get('http-equiv') || '').toLowerCase();
        if (tag.has('charset')) {
          tag.set('charset', 'utf-8');
        } else if (httpEquiv === 'content-type') {
          tag.set('content', 'text/html; charset=utf-8');
        } else if (httpEquiv === 'content-security-policy') {
          tag.drop(); // CSP oryginału blokowałby lokalne pliki
        } else if (httpEquiv === 'refresh') {
          const content = tag.get('content') || '';
          const m = /^(\s*[\d.]+\s*[;,]?\s*(?:url\s*=\s*)?)(['"]?)(.*?)\2\s*$/i.exec(content);
          if (m && m[3]) {
            const mapped = mapNav(m[3]);
            if (mapped) tag.set('content', `${m[1]}${mapped}`);
          }
        }
        return;
      }

      if (name === 'a' || name === 'area') {
        const href = tag.get('href');
        if (href != null) {
          const u = resolve(href);
          const mapped = mapNav(href);
          setIf(tag, 'href', mapped);
          if (ctx.externalNewTab && u && ctx.isExternal(u.href) && !tag.has('target')) {
            tag.add('target', '_blank');
            if (!tag.has('rel')) tag.add('rel', 'noopener noreferrer');
          }
        }
      } else if (name === 'form') {
        const u = resolve(tag.get('action'));
        if (u) setIf(tag, 'action', u.href); // formularze i tak nie działają offline
      } else if (name === 'link') {
        const kind = linkRelKind(tag.get('rel'), tag.get('as'));
        const href = tag.get('href');
        if (href != null) {
          if (kind) {
            setIf(tag, 'href', mapResource(href, kind));
            tag.remove('integrity');
            tag.remove('crossorigin');
          } else {
            const u = resolve(href);
            if (u) setIf(tag, 'href', u.href);
          }
        }
        if (tag.has('imagesrcset')) rewriteSrcset(tag, 'imagesrcset');
      } else if (name === 'script') {
        const src = tag.get('src');
        if (src != null) {
          setIf(tag, 'src', mapResource(src, 'js'));
          tag.remove('integrity');
          tag.remove('crossorigin');
        }
      } else if (name === 'iframe' || name === 'frame') {
        const src = tag.get('src');
        if (src != null) setIf(tag, 'src', mapResource(src, 'frame'));
      }

      const resAttrs = RESOURCE_ATTRS[name];
      if (resAttrs) {
        for (const attr of resAttrs) {
          const v = tag.get(attr);
          if (v != null && !(name === 'use' && v.trim().startsWith('#'))) setIf(tag, attr, mapResource(v, 'asset'));
        }
        if (name === 'img' || name === 'source') {
          tag.remove('integrity');
          tag.remove('crossorigin');
        }
      }
      if (SRCSET_ELEMENTS.has(name) && tag.has('srcset')) rewriteSrcset(tag, 'srcset');

      for (const attr of LAZY_ATTRS) {
        const v = tag.get(attr);
        if (v) setIf(tag, attr, mapResource(v, 'asset'));
      }
      for (const attr of LAZY_SRCSET_ATTRS) {
        if (tag.has(attr)) rewriteSrcset(tag, attr);
      }

      const style = tag.get('style');
      if (style && /url\(|@import/i.test(style)) {
        const newStyle = rewriteCss(style, cssMapper(baseUrl));
        if (newStyle !== style) tag.set('style', newStyle);
      }
    },
    styleText(css) {
      return rewriteCss(css, cssMapper(baseUrl));
    },
  });

  if (!charsetInserted) {
    // brak <head> – wstawiamy deklarację na początku (po doctype, jeśli jest)
    const m = /^\s*<!doctype[^>]*>/i.exec(result);
    if (m) return `${m[0]}<meta charset="utf-8">${result.slice(m[0].length)}`;
    return `<meta charset="utf-8">${result}`;
  }
  return result;
}
