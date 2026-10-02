import { getSessionMinutes, localDateString, shiftDateStr, sessionMatchesSubject } from './sessions.js';
import { plannedHoursFor, subjectKey, weekStartStr } from './plan.js';

const positiveNumber = value => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;

// Keep seconds until display time. Small sessions must never disappear through
// rounding, and goal completion must be based on the actual saved duration.
export function formatStudyTime(minutes, unit = 'duration') {
  const safe = positiveNumber(minutes);
  if (unit === 'hours') {
    const hours = safe / 60;
    return `${hours > 0 && hours < 0.01 ? '<0.01' : Number(hours.toFixed(2))} h`;
  }
  if (unit === 'minutes') {
    return `${safe > 0 && safe < 0.1 ? '<0.1' : Number(safe.toFixed(1))} min`;
  }
  const seconds = Math.round(safe * 60);
  if (seconds > 0 && seconds < 60) return `${seconds}s`;
  const wholeMinutes = Math.floor(seconds / 60);
  const hours = Math.floor(wholeMinutes / 60);
  const remainder = wholeMinutes % 60;
  if (!hours) return `${wholeMinutes}m`;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}

export function formatWeekRange(start, end = shiftDateStr(start, 6)) {
  const first = new Date(`${start}T00:00:00`);
  const last = new Date(`${end}T00:00:00`);
  const sameYear = first.getFullYear() === last.getFullYear();
  const options = { month: 'short', day: 'numeric', ...(!sameYear && { year: 'numeric' }) };
  return `${first.toLocaleDateString(undefined, options)} – ${last.toLocaleDateString(undefined, options)}`;
}

export function progressPercent(logged, target) {
  return target > 0 ? Math.min(100, Math.floor((logged / target) * 100 + 1e-8)) : 0;
}

// Every weekly surface uses the same Sunday–Saturday window, including when
// reviewing a past week. Future-dated sessions do not count as completed work.
export function weekProgress({ subjects, sessions, planEntries, anchorDate, today = localDateString() }) {
  const start = weekStartStr(anchorDate);
  const end = shiftDateStr(start, 6);
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = shiftDateStr(start, index);
    const minutes = date <= today
      ? sessions.filter(session => session.date === date).reduce((sum, session) => sum + getSessionMinutes(session), 0)
      : 0;
    return { date, minutes, isFuture: date > today };
  });
  const weekSessions = sessions.filter(session => session.date >= start && session.date <= end && session.date <= today);
  const rows = subjects.map(subject => {
    const loggedMinutes = weekSessions.filter(session => sessionMatchesSubject(session, subject))
      .reduce((sum, session) => sum + getSessionMinutes(session), 0);
    const plannedMinutes = days.reduce((sum, day) => sum + positiveNumber(plannedHoursFor(planEntries, subjectKey(subject), day.date)) * 60, 0);
    const goalMinutes = positiveNumber(subject.weeklyGoal) * 60;
    return {
      subject,
      loggedMinutes,
      plannedMinutes,
      goalMinutes,
      goalPct: progressPercent(loggedMinutes, goalMinutes),
      goalMet: goalMinutes > 0 && loggedMinutes >= goalMinutes,
      remainingMinutes: Math.max(0, goalMinutes - loggedMinutes),
      schedulePct: progressPercent(loggedMinutes, plannedMinutes),
    };
  });
  const totalMinutes = days.reduce((sum, day) => sum + day.minutes, 0);
  const goalMinutes = rows.reduce((sum, row) => sum + row.goalMinutes, 0);
  const plannedMinutes = rows.reduce((sum, row) => sum + row.plannedMinutes, 0);
  // Surplus DSA time cannot complete an untouched goal for another subject.
  const goalCredit = rows.reduce((sum, row) => sum + Math.min(row.loggedMinutes, row.goalMinutes), 0);
  const scheduleCredit = rows.reduce((sum, row) => sum + Math.min(row.loggedMinutes, row.plannedMinutes), 0);
  const elapsedDays = days.filter(day => !day.isFuture).length;
  const previousEnd = start === weekStartStr(today)
    ? shiftDateStr(shiftDateStr(start, -7), Math.max(0, elapsedDays - 1))
    : shiftDateStr(start, -1);
  const previousStart = shiftDateStr(start, -7);
  const previousMinutes = sessions.filter(session => session.date >= previousStart && session.date <= previousEnd && session.date <= today)
    .reduce((sum, session) => sum + getSessionMinutes(session), 0);
  return {
    start, end, days, rows, totalMinutes, goalMinutes, plannedMinutes,
    goalPct: progressPercent(goalCredit, goalMinutes),
    remainingGoalMinutes: Math.max(0, goalMinutes - goalCredit),
    schedulePct: progressPercent(scheduleCredit, plannedMinutes),
    remainingScheduleMinutes: Math.max(0, plannedMinutes - scheduleCredit),
    goalCount: rows.filter(row => row.goalMinutes > 0).length,
    goalsMet: rows.filter(row => row.goalMet).length,
    elapsedDays,
    previousMinutes,
  };
}
