// Harmonogram: kopie cykliczne (codziennie, co tydzień, co miesiąc) o wybranej godzinie.
// Czas liczony w strefie z TZ (w Dockerze np. TZ=Europe/Warsaw).

export const FREQUENCIES = {
  daily: 'Codziennie',
  weekly: 'Co tydzień',
  monthly: 'Co miesiąc',
};

// 1 = poniedziałek … 0 = niedziela (jak w Date.getDay)
export const WEEKDAYS = [
  { value: 1, label: 'poniedziałek', short: 'pon.' },
  { value: 2, label: 'wtorek', short: 'wt.' },
  { value: 3, label: 'środa', short: 'śr.' },
  { value: 4, label: 'czwartek', short: 'czw.' },
  { value: 5, label: 'piątek', short: 'pt.' },
  { value: 6, label: 'sobota', short: 'sob.' },
  { value: 0, label: 'niedziela', short: 'niedz.' },
];

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
  if (!t) throw new Error(`Nieprawidłowa godzina „${time}”`);
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
  throw new Error(`Nieznana częstotliwość „${frequency}”`);
}

/** „Co tydzień, pon. 03:00” */
export function describeSchedule(s) {
  if (!s) return 'Jednorazowo';
  if (s.frequency === 'daily') return `Codziennie, ${s.time}`;
  if (s.frequency === 'weekly') return `Co tydzień, ${WEEKDAYS.find((w) => w.value === Number(s.weekday))?.short ?? '?'} ${s.time}`;
  if (s.frequency === 'monthly') return `Co miesiąc, ${s.monthday}. dnia, ${s.time}`;
  return s.frequency;
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
      log(`Harmonogram „${s.name}”: poprzednia kopia jeszcze trwa – pomijam ten termin`);
      db.markScheduleRun(s.id, { nextRunAt });
      continue;
    }
    const jobId = db.createJob({ url: s.url, name: s.name, options: s.options, scheduleId: s.id });
    db.addLog(jobId, 'info', `Uruchomione z harmonogramu (${describeSchedule(s)})`, 'schedule');
    db.markScheduleRun(s.id, { nextRunAt, jobId });
    log(`Harmonogram „${s.name}”: zadanie #${jobId}`);
    created.push(jobId);
  }
  return created;
}
