import {
  getSessionMinutes,
  sessionMatchesSubject,
  shiftDateStr,
} from './sessions';

// A day planned past this is treated as unrealistic and flagged.
export const OVERLOAD_HOURS = 16;

// Plan entries key a subject by the same id sessions use (Firestore id when
// signed in, legacy numeric id as guest) so planned and logged time line up.
export function subjectKey(subject) {
  return String(subject.firestoreId ?? subject.id);
}

// Most recent Sunday on or before dateStr (Sunday-anchored, like the Dashboard).
export function weekStartStr(dateStr) {
  const dow = new Date(`${dateStr}T00:00:00`).getDay();
  return shiftDateStr(dateStr, -dow);
}

function weekday(dateStr) {
  return new Date(`${dateStr}T00:00:00`).getDay();
}

// The planner used to have a "repeat weekly" mode that stored day-of-week
// entries applying to every week, which made future weeks look pre-filled.
// Those legacy entries still resolve for weeks that started before this
// cutoff (so past plans and reviews stay intact, with no data migration),
// but every week from the cutoff on is owned by explicit per-date entries.
export const LEGACY_WEEKLY_CUTOFF = '2026-06-14';

// Hours contributed by a legacy recurring entry for this date, or 0 when the
// date falls in a post-cutoff week.
export function legacyWeeklyHoursFor(planEntries, subjectIdKey, dateStr) {
  if (weekStartStr(dateStr) >= LEGACY_WEEKLY_CUTOFF) return 0;
  const key = String(subjectIdKey);
  const dow = weekday(dateStr);
  const weekly = planEntries.find(
    e => e.scope === 'weekly' && String(e.subjectId) === key && e.day === dow
  );
  return weekly ? weekly.hours || 0 : 0;
}

// Resolved planned hours for a subject on a date: a 'once' entry for that exact
// date (including an explicit 0 that clears a legacy value) wins, then the
// legacy recurring entry for pre-cutoff weeks.
export function plannedHoursFor(planEntries, subjectIdKey, dateStr) {
  const key = String(subjectIdKey);
  const once = planEntries.find(
    e => e.scope === 'once' && String(e.subjectId) === key && e.date === dateStr
  );
  if (once) return once.hours || 0;
  return legacyWeeklyHoursFor(planEntries, subjectIdKey, dateStr);
}

// True when a 'once' entry overrides the recurring plan for this subject+date.
export function hasOnceOverride(planEntries, subjectIdKey, dateStr) {
  const key = String(subjectIdKey);
  return planEntries.some(
    e => e.scope === 'once' && String(e.subjectId) === key && e.date === dateStr
  );
}

// Subjects with planned hours > 0 on a date (drives Today's Plan).
export function planForDate(subjects, planEntries, dateStr) {
  return subjects
    .map(s => ({ subject: s, plannedHours: plannedHoursFor(planEntries, subjectKey(s), dateStr) }))
    .filter(x => x.plannedHours > 0);
}

export function loggedHoursFor(sessions, subject, dateStr) {
  const mins = sessions
    .filter(s => s.date === dateStr && sessionMatchesSubject(s, subject))
    .reduce((acc, s) => acc + getSessionMinutes(s), 0);
  return mins / 60;
}

export function loggedHoursForWeek(sessions, subject, weekStart) {
  const end = shiftDateStr(weekStart, 6);
  const mins = sessions
    .filter(s => s.date >= weekStart && s.date <= end && sessionMatchesSubject(s, subject))
    .reduce((acc, s) => acc + getSessionMinutes(s), 0);
  return mins / 60;
}

// Sum of resolved planned hours for a subject across the displayed week.
export function subjectWeekPlanned(planEntries, subject, weekStart) {
  let total = 0;
  for (let i = 0; i < 7; i++) {
    total += plannedHoursFor(planEntries, subjectKey(subject), shiftDateStr(weekStart, i));
  }
  return total;
}

const round1 = n => Math.round(n * 10) / 10;

// Compares a subject's planned weekly hours to its weekly goal. This is the
// "does this plan hit your target?" signal shown as a bar + message.
export function feasibility(subject, plannedWeekHours) {
  const goal = Number(subject.weeklyGoal) || 0;
  if (goal <= 0) {
    return { status: 'nogoal', deltaHours: 0, message: 'No weekly goal set', pct: 0 };
  }
  const planned = round1(plannedWeekHours);
  const delta = round1(planned - goal);
  const pct = Math.min(100, Math.round((planned / goal) * 100));
  if (Math.abs(delta) < 0.05) {
    return { status: 'met', deltaHours: 0, message: `Plan hits your ${goal}h goal`, pct: 100 };
  }
  if (delta < 0) {
    return {
      status: 'short',
      deltaHours: delta,
      message: `${Math.abs(delta)}h more to plan for your ${goal}h goal. Add it where the week has room.`,
      pct,
    };
  }
  return {
    status: 'stretch',
    deltaHours: delta,
    message: `${delta}h above your ${goal}h goal. Great for exam weeks, just keep the balance.`,
    pct: 100,
  };
}

// Planned hours per day across the week (overload detection + calendar strip).
export function dayLoad(planEntries, subjects, weekStart) {
  const out = [];
  for (let i = 0; i < 7; i++) {
    const dateStr = shiftDateStr(weekStart, i);
    let hours = 0;
    for (const s of subjects) hours += plannedHoursFor(planEntries, subjectKey(s), dateStr);
    out.push({ date: dateStr, hours: round1(hours), overloaded: hours > OVERLOAD_HOURS });
  }
  return out;
}
