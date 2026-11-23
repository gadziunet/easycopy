// Panel CSS and JS: read once at start, with a content hash for the ?v= parameter,
// so browsers load the new files right after an update (also between dev builds of the same version).

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

function file(name, type) {
  const body = readFileSync(new URL(`./static/${name}`, import.meta.url));
  return { type, body, hash: createHash('sha256').update(body).digest('hex').slice(0, 10) };
}

export const STATIC = {
  '/static/app.css': file('app.css', 'text/css; charset=utf-8'),
  '/static/app.js': file('app.js', 'text/javascript; charset=utf-8'),
};

/** Address of a static file with its content hash, e.g. /static/app.css?v=1a2b3c4d5e */
export function staticUrl(path) {
  return `${path}?v=${STATIC[path].hash}`;
}
