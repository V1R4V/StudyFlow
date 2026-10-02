import { getSessionMinutes, localDateString, shiftDateStr } from './sessions.js';
import { weekStartStr } from './plan.js';

export function sessionDurationSeconds(session) {
  return Math.floor(getSessionMinutes(session) * 60 + 1e-8);
}

export function formatSessionDuration(seconds) {
  const total = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remainder = total % 60;
  return [hours && `${hours}h`, minutes && `${minutes}m`, remainder && `${remainder}s`]
    .filter(Boolean).join(' ') || '0s';
}

export function timestampMillis(timestamp) {
  if (!timestamp) return null;
  if (typeof timestamp.toMillis === 'function') {
    const milliseconds = timestamp.toMillis();
    return Number.isFinite(milliseconds) ? milliseconds : null;
  }
  if (Number.isFinite(timestamp.seconds)) {
    return timestamp.seconds * 1000 + (Number.isFinite(timestamp.nanoseconds) ? timestamp.nanoseconds / 1e6 : 0);
  }
  return null;
}

export function formatSessionTimeRange(session, locale) {
  const end = timestampMillis(session.createdAt);
  // A changed date or an imported session has no trustworthy clock range.
  if (end === null || (session.date && localDateString(end) !== session.date)) return null;
  const formatter = new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' });
  return formatter.formatRange(new Date(end - sessionDurationSeconds(session) * 1000), new Date(end));
}

export function compareSessionsNewest(a, b) {
  const orderTime = session => timestampMillis(session.createdAt)
    ?? (Number.isFinite(Number(session.id)) ? Number(session.id) : 0);
  return String(b.date || '').localeCompare(String(a.date || ''))
    || orderTime(b) - orderTime(a);
}

export function sessionActivityStats(sessions, today) {
  const pastSessions = sessions.filter(session => session.date && session.date <= today);
  const byDate = new Map();
  pastSessions.forEach(session => byDate.set(session.date, (byDate.get(session.date) || 0) + 1));
  const start = weekStartStr(today);
  const previousStart = shiftDateStr(start, -7);
  const previousEnd = shiftDateStr(today, -7);
  const total = pastSessions.length;
  const activeDays = byDate.size;
  const todayCount = byDate.get(today) || 0;
  const todayMin = pastSessions.filter(session => session.date === today)
    .reduce((sum, session) => sum + getSessionMinutes(session), 0);
  const thisWeek = pastSessions.filter(session => session.date >= start).length;
  const lastWeek = pastSessions.filter(session => session.date >= previousStart && session.date <= previousEnd).length;
  const best = [...byDate.entries()].sort((a, b) => b[1] - a[1] || b[0].localeCompare(a[0]))[0];
  return {
    total, activeDays, todayCount, todayMin, thisWeek, lastWeek,
    avgPerActiveDay: activeDays > 0 ? total / activeDays : 0,
    bestDate: best?.[0] || null,
    bestCount: best?.[1] || 0,
  };
}
