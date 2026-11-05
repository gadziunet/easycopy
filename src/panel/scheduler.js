// Schedule: recurring copies (daily, weekly, monthly) at a chosen time.
// Times are in the TZ time zone (in Docker e.g. TZ=Europe/Warsaw).

import { msg } from '../shared/i18n.js';

export const FREQUENCIES = { daily: true, weekly: true, monthly: true };

// 1 = Monday … 0 = Sunday (as in Date.getDay)
export const WEEKDAYS = [1, 2, 3, 4, 5, 6, 0];

function parseTime(hm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hm || '');
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h <= 23 && min <= 59 ? { h, min } : null;
}

/** Następny termin (ms) ściśle po `from`. */
export function computeNextRun({ frequency, time, weekday, monthday }, from = Date.now()) {
  const t = parseTime(time);
  if (!t) throw new Error(`Invalid time "${time}"`);
  const base = new Date(from);
  const at = (y, mo, d) => new Date(y, mo, d, t.h, t.min, 0, 0).getTime();

  if (frequency === 'daily') {
    let next = at(base.getFullYear(), base.getMonth(), base.getDate());
    if (next <= from) next = at(base.getFullYear(), base.getMonth(), base.getDate() + 1);
    return next;
  }
  if (frequency === 'weekly') {
    const wd = Number(weekday);
    for (let i = 0; i <= 7; i++) {
      const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i);
      if (d.getDay() !== wd) continue;
      const next = at(d.getFullYear(), d.getMonth(), d.getDate());
      if (next > from) return next;
    }
    return at(base.getFullYear(), base.getMonth(), base.getDate() + 7);
  }
  if (frequency === 'monthly') {
    const day = Math.min(Math.max(Number(monthday) || 1, 1), 28);
    let next = at(base.getFullYear(), base.getMonth(), day);
    if (next <= from) next = at(base.getFullYear(), base.getMonth() + 1, day);
    return next;
  }
  throw new Error(`Unknown frequency "${frequency}"`);
}

/** "Weekly, Mon 03:00" */
export function describeSchedule(t, s) {
  if (!s) return t('scheduleText.once');
  if (s.frequency === 'daily') return t('scheduleText.daily', { time: s.time });
  if (s.frequency === 'weekly') return t('scheduleText.weekly', { day: t(`weekdays.${Number(s.weekday)}.short`), time: s.time });
  if (s.frequency === 'monthly') return t('scheduleText.monthly', { day: s.monthday, time: s.time });
  return s.frequency;
}

/** Schedule description stored for later translation. */
export function scheduleMsg(s) {
  if (s.frequency === 'weekly') return msg('scheduleText.weekly', { day: `@weekdays.${Number(s.weekday)}.short`, time: s.time });
  if (s.frequency === 'monthly') return msg('scheduleText.monthly', { day: s.monthday, time: s.time });
  return msg('scheduleText.daily', { time: s.time });
}

/**
 * Jeden przebieg harmonogramu: dla każdego terminu, który już minął, dodaje zadanie do kolejki.
 * Gdy poprzednia kopia tego archiwum jeszcze trwa, termin jest pomijany (bez kumulowania zadań).
 */
export function schedulerTick(db, now = Date.now(), log = () => {}) {
  const created = [];
  for (const s of db.dueSchedules(now)) {
    const nextRunAt = computeNextRun(s, now);
    if (db.hasActiveJob(s.name)) {
      log(`Schedule "${s.name}": the previous copy is still running – skipping this run`);
      db.markScheduleRun(s.id, { nextRunAt });
      continue;
    }
    const jobId = db.createJob({ url: s.url, name: s.name, options: s.options, scheduleId: s.id });
    db.addLog(jobId, 'info', msg('log.fromSchedule', { schedule: scheduleMsg(s) }), 'schedule');
    db.markScheduleRun(s.id, { nextRunAt, jobId });
    log(`Schedule "${s.name}": job #${jobId}`);
    created.push(jobId);
  }
  return created;
}
