// Baza panelu: zadania (kolejka i historia), dziennik zadań, ustawienia.
// Kopie stron leżą w plikach – w bazie są tylko informacje o zadaniach.

import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';

import { DatabaseSync } from '../shared/sqlite.js';

const MIGRATIONS = [
  // 1: pierwsza wersja schematu
  `
  CREATE TABLE jobs (
    id INTEGER PRIMARY KEY,
    url TEXT NOT NULL,
    name TEXT NOT NULL,
    options TEXT NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'queued',
    run_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    started_at INTEGER,
    finished_at INTEGER,
    version TEXT,
    stats TEXT,
    pause TEXT,
    error TEXT,
    cancel_requested INTEGER NOT NULL DEFAULT 0,
    retry_of INTEGER
  );
  CREATE INDEX jobs_queue ON jobs (status, run_at, id);
  CREATE INDEX jobs_name ON jobs (name, id);

  CREATE TABLE job_log (
    id INTEGER PRIMARY KEY,
    job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    at INTEGER NOT NULL,
    level TEXT NOT NULL,
    code TEXT,
    message TEXT NOT NULL
  );
  CREATE INDEX job_log_job ON job_log (job_id, id);

  CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  `,
  // 2: konta panelu
  `
  CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    session_key TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    last_login_at INTEGER
  );
  `,
  // 3: harmonogram (kopie cykliczne)
  `
  CREATE TABLE schedules (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    url TEXT NOT NULL,
    options TEXT NOT NULL DEFAULT '{}',
    frequency TEXT NOT NULL,
    time_hm TEXT NOT NULL,
    weekday INTEGER,
    monthday INTEGER,
    enabled INTEGER NOT NULL DEFAULT 1,
    next_run_at INTEGER,
    last_job_id INTEGER,
    created_at INTEGER NOT NULL
  );
  ALTER TABLE jobs ADD COLUMN schedule_id INTEGER;
  `,
];

export const ACTIVE_STATUSES = ['queued', 'running'];
export const FINAL_STATUSES = ['complete', 'limit', 'paused', 'error', 'aborted', 'cancelled'];

function parseJson(text, fallback = null) {
  if (text == null) return fallback;
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

function mapJob(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    url: row.url,
    name: row.name,
    options: parseJson(row.options, {}),
    status: row.status,
    runAt: row.run_at,
    createdAt: row.created_at,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    version: row.version,
    stats: parseJson(row.stats),
    pause: parseJson(row.pause),
    error: row.error,
    cancelRequested: Boolean(row.cancel_requested),
    retryOf: row.retry_of,
    scheduleId: row.schedule_id ?? null,
  };
}

export class Db {
  constructor(file) {
    if (file !== ':memory:') mkdirSync(path.dirname(file), { recursive: true });
    this.file = file;
    this.db = new DatabaseSync(file);
    this.db.exec('PRAGMA busy_timeout = 5000');
    if (file !== ':memory:') this.db.exec('PRAGMA journal_mode = WAL');
    this.db.exec('PRAGMA foreign_keys = ON');
    this.db.exec('PRAGMA synchronous = NORMAL');
    this.migrate();
  }

  migrate() {
    const { user_version: current } = this.db.prepare('PRAGMA user_version').get();
    for (let v = current; v < MIGRATIONS.length; v++) {
      this.db.exec('BEGIN');
      try {
        this.db.exec(MIGRATIONS[v]);
        this.db.exec(`PRAGMA user_version = ${v + 1}`);
        this.db.exec('COMMIT');
      } catch (err) {
        this.db.exec('ROLLBACK');
        throw err;
      }
    }
  }

  close() {
    this.db.close();
  }

  // ---------- zadania ----------

  createJob({ url, name, options = {}, runAt = Date.now(), retryOf = null, scheduleId = null }) {
    const now = Date.now();
    const r = this.db
      .prepare('INSERT INTO jobs (url, name, options, status, run_at, created_at, retry_of, schedule_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(url, name, JSON.stringify(options), 'queued', runAt, now, retryOf, scheduleId);
    return Number(r.lastInsertRowid);
  }

  /** Poprawa ustawień zadania, które jeszcze czeka w kolejce. */
  updateQueuedJob(id, { url, name, options }) {
    const r = this.db
      .prepare("UPDATE jobs SET url = ?, name = ?, options = ? WHERE id = ? AND status = 'queued'")
      .run(url, name, JSON.stringify(options), id);
    return Number(r.changes) === 1;
  }

  hasActiveJob(name) {
    return Boolean(this.db.prepare("SELECT 1 FROM jobs WHERE name = ? AND status IN ('queued', 'running') LIMIT 1").get(name));
  }

  /** Usuwa zakończone zadanie z historii (z dziennikiem). Pliki kopii zostają. */
  deleteJob(id) {
    const r = this.db.prepare("DELETE FROM jobs WHERE id = ? AND status NOT IN ('queued', 'running')").run(id);
    return Number(r.changes) === 1;
  }

  /** Usuwa historię zakończonych zadań danego archiwum. */
  deleteJobsByName(name) {
    return Number(this.db.prepare("DELETE FROM jobs WHERE name = ? AND status NOT IN ('queued', 'running')").run(name).changes);
  }

  getJob(id) {
    return mapJob(this.db.prepare('SELECT * FROM jobs WHERE id = ?').get(id));
  }

  listJobs({ limit = 100 } = {}) {
    return this.db.prepare('SELECT * FROM jobs ORDER BY id DESC LIMIT ?').all(limit).map(mapJob);
  }

  activeJobs() {
    return this.db
      .prepare("SELECT * FROM jobs WHERE status IN ('queued', 'running') ORDER BY CASE status WHEN 'running' THEN 0 ELSE 1 END, run_at, id")
      .all()
      .map(mapJob);
  }

  /** Ostatnie zadanie dla każdej nazwy archiwum (do linku „Szczegóły” na liście archiwów). */
  latestJobByName() {
    const rows = this.db.prepare('SELECT name, MAX(id) AS id FROM jobs GROUP BY name').all();
    return new Map(rows.map((r) => [r.name, Number(r.id)]));
  }

  /** Bierze następne zadanie z kolejki (atomowo). */
  claimNextJob(now = Date.now()) {
    return mapJob(
      this.db
        .prepare(
          `UPDATE jobs SET status = 'running', started_at = ?
           WHERE id = (SELECT id FROM jobs WHERE status = 'queued' AND run_at <= ? ORDER BY run_at, id LIMIT 1)
           RETURNING *`,
        )
        .get(now, now),
    );
  }

  updateProgress(id, { stats, version }) {
    this.db
      .prepare('UPDATE jobs SET stats = COALESCE(?, stats), version = COALESCE(?, version) WHERE id = ?')
      .run(stats ? JSON.stringify(stats) : null, version ?? null, id);
  }

  finishJob(id, { status, stats = null, pause = null, error = null }) {
    this.db
      .prepare('UPDATE jobs SET status = ?, finished_at = ?, stats = COALESCE(?, stats), pause = ?, error = ? WHERE id = ?')
      .run(status, Date.now(), stats ? JSON.stringify(stats) : null, pause ? JSON.stringify(pause) : null, error, id);
  }

  /** Anulowanie: zadanie w kolejce znika od razu, uruchomione dostaje prośbę o zatrzymanie. */
  requestCancel(id) {
    const job = this.getJob(id);
    if (!job) return null;
    if (job.status === 'queued') {
      this.db.prepare("UPDATE jobs SET status = 'cancelled', finished_at = ? WHERE id = ? AND status = 'queued'").run(Date.now(), id);
    } else if (job.status === 'running') {
      this.db.prepare('UPDATE jobs SET cancel_requested = 1 WHERE id = ?').run(id);
    }
    return this.getJob(id);
  }

  isCancelRequested(id) {
    const row = this.db.prepare('SELECT cancel_requested FROM jobs WHERE id = ?').get(id);
    return Boolean(row?.cancel_requested);
  }

  /** Zadania „w trakcie” po restarcie aplikacji nie mają już procesu – oznaczamy je jako przerwane. */
  recoverInterrupted() {
    const r = this.db
      .prepare("UPDATE jobs SET status = 'aborted', finished_at = ?, error = ? WHERE status = 'running'")
      .run(Date.now(), 'Przerwane przez restart aplikacji');
    return Number(r.changes);
  }

  // ---------- dziennik ----------

  addLog(jobId, level, message, code = null) {
    this.db.prepare('INSERT INTO job_log (job_id, at, level, code, message) VALUES (?, ?, ?, ?, ?)').run(jobId, Date.now(), level, code, message);
  }

  getLog(jobId, { afterId = 0, limit = 200 } = {}) {
    // najnowsze wpisy, ale zwracane od najstarszego
    return this.db
      .prepare('SELECT id, at, level, code, message FROM job_log WHERE job_id = ? AND id > ? ORDER BY id DESC LIMIT ?')
      .all(jobId, afterId, limit)
      .reverse()
      .map((r) => ({ ...r, id: Number(r.id) }));
  }

  /** Rotacja dziennika: starsze niż `days` dni oraz ponad `perJob` wpisów na zadanie. */
  pruneLogs({ days = 30, perJob = 2000 } = {}) {
    this.db.prepare('DELETE FROM job_log WHERE at < ?').run(Date.now() - days * 86_400_000);
    this.db
      .prepare(
        `DELETE FROM job_log WHERE id IN (
           SELECT id FROM (
             SELECT id, ROW_NUMBER() OVER (PARTITION BY job_id ORDER BY id DESC) AS n FROM job_log
           ) WHERE n > ?
         )`,
      )
      .run(perJob);
  }

  // ---------- harmonogram ----------

  static mapSchedule(row) {
    if (!row) return null;
    return {
      id: Number(row.id),
      name: row.name,
      url: row.url,
      options: parseJson(row.options, {}),
      frequency: row.frequency,
      time: row.time_hm,
      weekday: row.weekday,
      monthday: row.monthday,
      enabled: Boolean(row.enabled),
      nextRunAt: row.next_run_at,
      lastJobId: row.last_job_id,
      createdAt: row.created_at,
    };
  }

  /** Tworzy albo podmienia harmonogram archiwum (jeden harmonogram na nazwę). */
  saveSchedule({ name, url, options, frequency, time, weekday = null, monthday = null, nextRunAt, enabled = true }) {
    this.db
      .prepare(
        `INSERT INTO schedules (name, url, options, frequency, time_hm, weekday, monthday, enabled, next_run_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(name) DO UPDATE SET url = excluded.url, options = excluded.options, frequency = excluded.frequency,
           time_hm = excluded.time_hm, weekday = excluded.weekday, monthday = excluded.monthday,
           enabled = excluded.enabled, next_run_at = excluded.next_run_at`,
      )
      .run(name, url, JSON.stringify(options), frequency, time, weekday, monthday, enabled ? 1 : 0, nextRunAt, Date.now());
    return this.getScheduleByName(name);
  }

  getSchedule(id) {
    return Db.mapSchedule(this.db.prepare('SELECT * FROM schedules WHERE id = ?').get(id));
  }

  getScheduleByName(name) {
    return Db.mapSchedule(this.db.prepare('SELECT * FROM schedules WHERE name = ?').get(name));
  }

  listSchedules() {
    return this.db.prepare('SELECT * FROM schedules ORDER BY name').all().map(Db.mapSchedule);
  }

  dueSchedules(now = Date.now()) {
    return this.db
      .prepare('SELECT * FROM schedules WHERE enabled = 1 AND next_run_at IS NOT NULL AND next_run_at <= ? ORDER BY next_run_at')
      .all(now)
      .map(Db.mapSchedule);
  }

  setScheduleEnabled(id, enabled, nextRunAt) {
    this.db.prepare('UPDATE schedules SET enabled = ?, next_run_at = ? WHERE id = ?').run(enabled ? 1 : 0, nextRunAt, id);
  }

  markScheduleRun(id, { nextRunAt, jobId = null }) {
    this.db.prepare('UPDATE schedules SET next_run_at = ?, last_job_id = COALESCE(?, last_job_id) WHERE id = ?').run(nextRunAt, jobId, id);
  }

  deleteSchedule(id) {
    return Number(this.db.prepare('DELETE FROM schedules WHERE id = ?').run(id).changes) === 1;
  }

  deleteScheduleByName(name) {
    return Number(this.db.prepare('DELETE FROM schedules WHERE name = ?').run(name).changes);
  }

  // ---------- konta ----------

  countUsers() {
    return Number(this.db.prepare('SELECT COUNT(*) AS n FROM users').get().n);
  }

  /** Pierwsze konto zakładane tylko wtedy, gdy nie ma żadnego (atomowo – dwa kreatory naraz nie przejdą). */
  createFirstUser(username, passwordHash) {
    const r = this.db
      .prepare(
        `INSERT INTO users (username, password_hash, session_key, created_at)
         SELECT ?, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM users)`,
      )
      .run(username, passwordHash, randomBytes(16).toString('hex'), Date.now());
    return r.changes ? Number(r.lastInsertRowid) : null;
  }

  getUser(id) {
    return this.db.prepare('SELECT * FROM users WHERE id = ?').get(id) ?? null;
  }

  getUserByName(username) {
    return this.db.prepare('SELECT * FROM users WHERE username = ?').get(username) ?? null;
  }

  listUsers() {
    return this.db.prepare('SELECT id, username, created_at, last_login_at FROM users ORDER BY id').all();
  }

  /** Nowe hasło unieważnia wszystkie dotychczasowe sesje tego konta. */
  setPassword(id, passwordHash) {
    this.db.prepare('UPDATE users SET password_hash = ?, session_key = ? WHERE id = ?').run(passwordHash, randomBytes(16).toString('hex'), id);
  }

  touchLogin(id) {
    this.db.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').run(Date.now(), id);
  }

  // ---------- ustawienia ----------

  getSetting(key) {
    return this.db.prepare('SELECT value FROM settings WHERE key = ?').get(key)?.value ?? null;
  }

  setSetting(key, value) {
    this.db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value);
  }

  /** Sekret do podpisywania ciasteczek sesji – tworzony przy pierwszym starcie. */
  sessionSecret() {
    let secret = this.getSetting('session_secret');
    if (!secret) {
      secret = randomBytes(32).toString('hex');
      this.setSetting('session_secret', secret);
    }
    return secret;
  }
}

export function openDatabase(file) {
  return new Db(file);
}
