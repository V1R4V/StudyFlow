import { getSessionMinutes, localDateString, shiftDateStr } from './sessions';

const DAY_LABELS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

// Minutes for a single break record. Mirrors getSessionMinutes so a break
// stored with second-level precision still reports accurately.
export function getBreakMinutes(brk) {
  if (!brk) return 0;
  if (typeof brk.durationSeconds === 'number') return brk.durationSeconds / 60;
  if (typeof brk.duration === 'number') return brk.duration;
  return 0;
}

// Most recent Sunday on or before the given date (matches the Dashboard's
// Sunday-anchored week so break stats line up with study stats).
export function weekStartStr(dateStr) {
  const dayObj = new Date(`${dateStr}T00:00:00`);
  return shiftDateStr(dateStr, -dayObj.getDay());
}

function sumMinutes(records, getMinutes) {
  return records.reduce((acc, r) => acc + getMinutes(r), 0);
}

// One pass over breaks (and sessions, for the work:break ratio) producing every
// figure the break insights surface. `breaks` and `sessions` are the raw arrays
// from StudyDataContext; nothing here ever feeds back into study totals.
export function summarizeBreaks(breaks = [], sessions = [], anchorStr = localDateString()) {
  const todayStr = anchorStr;
  const weekStart = weekStartStr(todayStr);

  const todays = breaks.filter(b => b.date === todayStr);
  const weeks = breaks.filter(b => b.date >= weekStart && b.date <= todayStr);

  const todayMinutes = sumMinutes(todays, getBreakMinutes);
  const weekMinutes = sumMinutes(weeks, getBreakMinutes);

  const allMinutes = breaks.map(getBreakMinutes);
  const totalCount = breaks.length;
  const avgMinutes = totalCount > 0 ? sumMinutes(breaks, getBreakMinutes) / totalCount : 0;
  const longestMinutes = allMinutes.length > 0 ? Math.max(...allMinutes) : 0;

  // Study minutes for the same windows, used only to express a ratio.
  const studyToday = sumMinutes(
    sessions.filter(s => s.date === todayStr),
    getSessionMinutes
  );
  const studyWeek = sumMinutes(
    sessions.filter(s => s.date >= weekStart && s.date <= todayStr),
    getSessionMinutes
  );

  // Rolling 7 days ending today, for the mini trend chart.
  const last7 = [];
  const anchorMs = new Date(`${todayStr}T00:00:00`).getTime();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(anchorMs - i * 86400000);
    const dateStr = localDateString(d);
    const minutes = sumMinutes(
      breaks.filter(b => b.date === dateStr),
      getBreakMinutes
    );
    last7.push({ date: dateStr, label: DAY_LABELS[d.getDay()], minutes: Math.round(minutes) });
  }

  return {
    todayCount: todays.length,
    todayMinutes,
    weekCount: weeks.length,
    weekMinutes,
    avgMinutes,
    longestMinutes,
    studyToday,
    studyWeek,
    last7,
  };
}

// Compact "study : break" ratio text, e.g. "4.0 : 1" or "—" when there is no
// break time to compare against.
export function ratioText(studyMinutes, breakMinutes) {
  if (breakMinutes <= 0) return studyMinutes > 0 ? '∞ : 1' : '—';
  const ratio = studyMinutes / breakMinutes;
  return `${ratio.toFixed(1)} : 1`;
}
