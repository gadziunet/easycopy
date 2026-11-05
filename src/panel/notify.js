// Notifications: ntfy, Gotify, Pushover, Discord and a generic JSON webhook.
// Settings are stored as JSON in the panel database (settings table, key "notifications").

import { localize, msg, normalizeLanguage, translator } from '../shared/i18n.js';

const SETTINGS_KEY = 'notifications';
export const CHANNELS = ['ntfy', 'gotify', 'pushover', 'discord', 'webhook'];
const SECRETS = { ntfy: ['token'], gotify: ['token'], pushover: ['user', 'token'], discord: ['url'], webhook: [] };
const CHANNEL_NAMES = { ntfy: 'ntfy', gotify: 'Gotify', pushover: 'Pushover', discord: 'Discord', webhook: 'Webhook' };
export const PUSHOVER_API = 'https://api.pushover.net/1/messages.json';

/** Job status → notification event (cancelled in the panel: no notification). */
const EVENT_OF = { complete: 'complete', limit: 'limit', paused: 'paused', error: 'error', aborted: 'error' };

export function defaultNotifySettings() {
  return {
    events: { complete: true, limit: true, paused: true, error: true },
    scheduledOnly: false,
    panelUrl: '',
    language: 'en',
    channels: {
      ntfy: { enabled: false, url: '', token: '' },
      gotify: { enabled: false, url: '', token: '' },
      pushover: { enabled: false, user: '', token: '' },
      discord: { enabled: false, url: '' },
      webhook: { enabled: false, url: '' },
    },
  };
}

export function loadNotifySettings(db) {
  const base = defaultNotifySettings();
  let saved = {};
  try {
    saved = JSON.parse(db.getSetting(SETTINGS_KEY) ?? '{}') ?? {};
  } catch {
    saved = {};
  }
  return {
    ...base,
    ...saved,
    events: { ...base.events, ...saved.events },
    channels: Object.fromEntries(CHANNELS.map((c) => [c, { ...base.channels[c], ...saved.channels?.[c] }])),
  };
}

export function saveNotifySettings(db, settings) {
  db.setSetting(SETTINGS_KEY, JSON.stringify(settings));
}

const isHttpUrl = (value) => {
  try {
    const u = new URL(value);
    return (u.protocol === 'http:' || u.protocol === 'https:') && Boolean(u.hostname);
  } catch {
    return false;
  }
};

/**
 * Reads the settings form. Secret fields left empty keep the saved value.
 * Returns { settings, errors } – errors map field name → translation key.
 */
export function parseNotifyForm(params, current, language = 'en') {
  const get = (k) => (params.get(k) ?? '').trim();
  const errors = {};
  const settings = defaultNotifySettings();
  settings.language = normalizeLanguage(language) ?? 'en';
  for (const ev of Object.keys(settings.events)) settings.events[ev] = params.has(`ev.${ev}`);
  settings.scheduledOnly = params.has('scheduledOnly');
  settings.panelUrl = get('panelUrl').replace(/\/+$/, '');
  if (settings.panelUrl && !isHttpUrl(settings.panelUrl)) errors.panelUrl = 'notifications.invalidUrl';

  for (const c of CHANNELS) {
    const ch = settings.channels[c];
    ch.enabled = params.has(`${c}.enabled`);
    for (const field of Object.keys(ch)) {
      if (field === 'enabled') continue;
      const value = get(`${c}.${field}`);
      ch[field] = !value && SECRETS[c].includes(field) ? current.channels[c][field] ?? '' : value;
    }
    for (const field of ['url'].filter((f) => f in ch)) {
      if (ch[field] && !isHttpUrl(ch[field])) errors[`${c}.${field}`] = 'notifications.invalidUrl';
    }
    if (ch.enabled) {
      const required = { ntfy: ['url'], gotify: ['url', 'token'], pushover: ['user', 'token'], discord: ['url'], webhook: ['url'] }[c];
      for (const field of required) if (!ch[field] && !errors[`${c}.${field}`]) errors[`${c}.${field}`] = 'notifications.required';
    }
  }
  return { settings, errors };
}

export const enabledChannels = (settings) => CHANNELS.filter((c) => settings.channels[c]?.enabled);

/** RFC 2047 for non-ASCII header values (ntfy decodes them). */
function headerValue(text) {
  return /^[\x20-\x7e]*$/.test(text) ? text : `=?UTF-8?B?${Buffer.from(text, 'utf8').toString('base64')}?=`;
}

async function post(fetchImpl, url, { headers = {}, body }, timeoutMs) {
  const res = await fetchImpl(url, { method: 'POST', headers, body, signal: AbortSignal.timeout(timeoutMs), redirect: 'follow' });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}${text ? ` – ${text.slice(0, 120).trim()}` : ''}`);
  }
  await res.arrayBuffer().catch(() => {});
}

const SENDERS = {
  async ntfy(ch, m, o) {
    const headers = { title: headerValue(m.title), priority: m.important ? 'high' : 'default', tags: m.important ? 'warning' : 'floppy_disk', 'content-type': 'text/plain; charset=utf-8' };
    if (m.link) headers.click = m.link;
    if (ch.token) headers.authorization = `Bearer ${ch.token}`;
    await post(o.fetchImpl, ch.url, { headers, body: m.body }, o.timeoutMs);
  },
  async gotify(ch, m, o) {
    const body = { title: m.title, message: m.link ? `${m.body}\n${m.link}` : m.body, priority: m.important ? 8 : 5 };
    if (m.link) body.extras = { 'client::notification': { click: { url: m.link } } };
    await post(o.fetchImpl, `${ch.url.replace(/\/+$/, '')}/message`, {
      headers: { 'content-type': 'application/json', 'x-gotify-key': ch.token },
      body: JSON.stringify(body),
    }, o.timeoutMs);
  },
  async pushover(ch, m, o) {
    const form = new URLSearchParams({ token: ch.token, user: ch.user, title: m.title, message: m.body, priority: m.important ? '1' : '0' });
    if (m.link) {
      form.set('url', m.link);
      form.set('url_title', m.linkTitle);
    }
    await post(o.fetchImpl, o.pushoverApi, { headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: form.toString() }, o.timeoutMs);
  },
  async discord(ch, m, o) {
    const embed = { title: m.title, description: m.body, color: m.important ? 0xd97706 : 0x16a34a };
    if (m.link) embed.url = m.link;
    await post(o.fetchImpl, ch.url, {
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'EasyCopy', embeds: [embed], allowed_mentions: { parse: [] } }),
    }, o.timeoutMs);
  },
  async webhook(ch, m, o) {
    await post(o.fetchImpl, ch.url, {
      headers: { 'content-type': 'application/json', 'user-agent': 'EasyCopy' },
      body: JSON.stringify({ event: m.event, title: m.title, message: m.body, link: m.link, ...m.data }),
    }, o.timeoutMs);
  },
};

/** Sends a message to every enabled channel. Returns [{ channel, name, ok, error }]. */
export async function sendToChannels(settings, message, { fetchImpl = fetch, timeoutMs = 10_000, pushoverApi = PUSHOVER_API } = {}) {
  const opts = { fetchImpl, timeoutMs, pushoverApi };
  return Promise.all(
    enabledChannels(settings).map(async (c) => {
      try {
        await SENDERS[c](settings.channels[c], message, opts);
        return { channel: c, name: CHANNEL_NAMES[c], ok: true };
      } catch (err) {
        const error = err.name === 'TimeoutError' ? 'timeout' : err.cause?.code ?? err.message;
        return { channel: c, name: CHANNEL_NAMES[c], ok: false, error };
      }
    }),
  );
}

/** Notification text for a finished job. */
export function jobMessage(t, job, settings) {
  const s = job.stats ?? {};
  const event = EVENT_OF[job.status];
  const durationMs = job.startedAt && job.finishedAt ? job.finishedAt - job.startedAt : null;
  let body = t('notifications.msgBody', {
    pages: t.count(s.pages ?? 0, 'units.pages'),
    files: t.count(s.files ?? 0, 'units.files'),
    size: t.size(s.bytes ?? 0),
    duration: t.duration(durationMs),
  });
  if (job.status === 'paused' && job.pause?.message) body = `${localize(t, job.pause.message)}${job.pause.host ? ` (${job.pause.host})` : ''}\n${body}`;
  if (job.error && job.status !== 'paused') body = `${localize(t, job.error)}\n${body}`;
  const link = settings.panelUrl ? `${settings.panelUrl}/zadania/${job.id}` : null;
  return {
    event,
    important: event === 'paused' || event === 'error',
    title: t('notifications.msgTitle', { name: job.name, status: t(`statusWords.${job.status}`) }),
    body,
    link,
    linkTitle: t('notifications.msgOpen'),
    data: {
      job: { id: job.id, name: job.name, url: job.url, status: job.status, version: job.version, scheduled: Boolean(job.scheduleId) },
      stats: { pages: s.pages ?? 0, files: s.files ?? 0, bytes: s.bytes ?? 0, failed: s.failed ?? 0, durationMs },
    },
  };
}

export function testMessage(t, settings) {
  return {
    event: 'test',
    important: false,
    title: t('notifications.msgTestTitle'),
    body: t('notifications.msgTestBody'),
    link: settings.panelUrl || null,
    linkTitle: 'EasyCopy',
    data: {},
  };
}

/** Called by the worker after a job finishes. Results go to the job log. */
export async function notifyJob(db, job, options = {}) {
  if (!job) return [];
  const settings = loadNotifySettings(db);
  const event = EVENT_OF[job.status];
  if (!event || !settings.events[event]) return [];
  if (settings.scheduledOnly && !job.scheduleId) return [];
  if (!enabledChannels(settings).length) return [];
  const t = translator(settings.language);
  const results = await sendToChannels(settings, jobMessage(t, job, settings), options);
  const sent = results.filter((r) => r.ok).map((r) => r.name);
  if (sent.length) db.addLog(job.id, 'info', msg('log.notifySent', { channels: sent.join(', ') }), 'notify');
  for (const r of results.filter((x) => !x.ok)) db.addLog(job.id, 'warn', msg('log.notifyFailed', { channel: r.name, error: r.error }), 'notify');
  return results;
}
