import { localDateString, shiftDateStr } from './sessions';

// Priority → weight. Higher-priority habits move the weighted grade more, the
// same idea as the reference's planned_score = Σ(item_score·weight)/Σ(weight).
export const PRIORITY_WEIGHTS = { low: 1, normal: 2, high: 3, critical: 5 };
export const PRIORITY_LABELS = { low: 'Low', normal: 'Normal', high: 'High', critical: 'Critical' };

export function weightFor(priority) {
  return PRIORITY_WEIGHTS[priority] || PRIORITY_WEIGHTS.normal;
}

function weekday(dateStr) {
  return new Date(`${dateStr}T00:00:00`).getDay(); // 0=Sun … 6=Sat
}

// Most recent Sunday on or before dateStr (matches the rest of the app's
// Sunday-anchored weeks).
export function weekStartStr(dateStr) {
  return shiftDateStr(dateStr, -weekday(dateStr));
}

// Active habits scheduled on the weekday of dateStr that already existed then.
export function scheduledFor(habits, dateStr) {
  const dow = weekday(dateStr);
  return habits.filter(
    h =>
      h.active !== false &&
      Array.isArray(h.days) &&
      h.days.includes(dow) &&
      (!h.startDate || h.startDate <= dateStr)
  );
}

export function isDone(habitLogs, habitId, dateStr) {
  return habitLogs.some(
    l => String(l.habitId) === String(habitId) && l.date === dateStr
  );
}

// done | missed | pending for a single habit on a single date.
export function instanceStatus(habit, habitLogs, dateStr, todayStr = localDateString()) {
  if (isDone(habitLogs, habit.id, dateStr)) return 'done';
  return dateStr < todayStr ? 'missed' : 'pending';
}

// Weighted completion ratio (0–100) over the habits scheduled that day, or null
// when nothing was scheduled (a "no-plan" day — not counted, not penalized).
export function dayGrade(habits, habitLogs, dateStr) {
  const scheduled = scheduledFor(habits, dateStr);
  if (scheduled.length === 0) return null;
  let earned = 0;
  let possible = 0;
  for (const h of scheduled) {
    const w = weightFor(h.priority);
    possible += w;
    if (isDone(habitLogs, h.id, dateStr)) earned += w;
  }
  if (possible === 0) return null;
  return Math.round((earned / possible) * 100);
}

// Weighted grade across every scheduled instance in [startStr, endStr].
export function rangeGrade(habits, habitLogs, startStr, endStr) {
  let earned = 0;
  let possible = 0;
  let cursor = startStr;
  while (cursor <= endStr) {
    for (const h of scheduledFor(habits, cursor)) {
      const w = weightFor(h.priority);
      possible += w;
      if (isDone(habitLogs, h.id, cursor)) earned += w;
    }
    cursor = shiftDateStr(cursor, 1);
  }
  if (possible === 0) return null;
  return Math.round((earned / possible) * 100);
}

// Grade for the Sunday-anchored week containing dateStr, counted only up to
// dateStr so upcoming days in the week don't drag it down.
export function weekGrade(habits, habitLogs, dateStr) {
  return rangeGrade(habits, habitLogs, weekStartStr(dateStr), dateStr);
}

// done/total counts for a day (used by the "Scheduled today" KPI + checklist).
export function dayCounts(habits, habitLogs, dateStr) {
  const scheduled = scheduledFor(habits, dateStr);
  const done = scheduled.filter(h => isDone(habitLogs, h.id, dateStr)).length;
  return { done, total: scheduled.length };
}

const DOW_FULL = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

// Last `days` daily grades ending on endStr, for the trend line. Each entry's
// grade is a number or null (no-plan day).
export function gradeTrend(habits, habitLogs, endStr, days = 14) {
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const dateStr = shiftDateStr(endStr, -i);
    out.push({
      date: dateStr,
      label: DOW_FULL[weekday(dateStr)],
      grade: dayGrade(habits, habitLogs, dateStr),
    });
  }
  return out;
}

// Average day-grade per weekday across the trailing `days` window. Returns 7
// entries (index 0=Sun…6=Sat); avg is null when that weekday had no plan.
export function dowAverages(habits, habitLogs, endStr, days = 28) {
  const buckets = Array.from({ length: 7 }, () => ({ sum: 0, count: 0 }));
  for (let i = 0; i < days; i++) {
    const dateStr = shiftDateStr(endStr, -i);
    const g = dayGrade(habits, habitLogs, dateStr);
    if (g === null) continue;
    const dow = weekday(dateStr);
    buckets[dow].sum += g;
    buckets[dow].count += 1;
  }
  return buckets.map((b, i) => ({
    label: DOW_FULL[i],
    avg: b.count > 0 ? Math.round(b.sum / b.count) : null,
    count: b.count,
  }));
}

// Discrete heatmap color states, matching the reference's "discrete score
// states". Returns a CSS custom-property reference.
export function gradeColor(grade) {
  if (grade === null || grade === undefined) return 'var(--grade-none)';
  if (grade <= 0) return 'var(--grade-zero)';
  if (grade < 50) return 'var(--grade-low)';
  if (grade < 80) return 'var(--grade-mid)';
  if (grade < 100) return 'var(--grade-high)';
  return 'var(--grade-full)';
}
