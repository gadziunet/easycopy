// Minimalny parser robots.txt: grupy User-agent, Allow/Disallow z * i $, Crawl-delay.

export function parseRobots(text) {
  const groups = [];
  let current = null;
  let lastWasAgent = false;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line) continue;
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();

    if (key === 'user-agent') {
      if (!lastWasAgent || !current) {
        current = { agents: [], rules: [], crawlDelay: null };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!current) continue;
    if (key === 'allow' || key === 'disallow') {
      if (key === 'disallow' && value === '') continue; // pusty Disallow = wszystko dozwolone
      current.rules.push({ allow: key === 'allow', pattern: value });
    } else if (key === 'crawl-delay') {
      const n = Number(value);
      if (Number.isFinite(n) && n >= 0) current.crawlDelay = n;
    }
  }
  return groups;
}

function patternToRegex(pattern) {
  let re = '';
  for (const ch of pattern) {
    if (ch === '*') re += '.*';
    else if (ch === '$') re += '$';
    else re += ch.replace(/[.+?^{}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}`);
}

export class Robots {
  constructor(text, agentToken) {
    const groups = parseRobots(text || '');
    const token = agentToken.toLowerCase();
    const specific = groups.filter((g) => g.agents.some((a) => a !== '*' && token.includes(a)));
    const chosen = specific.length ? specific : groups.filter((g) => g.agents.includes('*'));
    this.rules = chosen.flatMap((g) => g.rules).map((r) => ({ ...r, re: patternToRegex(r.pattern), len: r.pattern.length }));
    const delays = chosen.map((g) => g.crawlDelay).filter((d) => d != null);
    this.crawlDelay = delays.length ? Math.max(...delays) : null;
  }

  /** Czy ścieżka (pathname + search) jest dozwolona? Wygrywa najdłuższa reguła, przy remisie Allow. */
  isAllowed(pathWithQuery) {
    let best = null;
    for (const r of this.rules) {
      if (r.re.test(pathWithQuery)) {
        if (!best || r.len > best.len || (r.len === best.len && r.allow)) best = r;
      }
    }
    return best ? best.allow : true;
  }
}

export const ALLOW_ALL = { isAllowed: () => true, crawlDelay: null };
