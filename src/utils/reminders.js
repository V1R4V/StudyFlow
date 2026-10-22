import { localDateString, shiftDateStr } from './sessions.js';

// Pure reminder logic: no React, no Firestore. Everything here takes plain
// reminder objects and date strings so it ports directly to other platforms.

export const PRIORITIES = ['none', 'low', 'medium', 'high'];
export const REPEATS = ['none', 'daily', 'weekdays', 'weekly', 'monthly'];
const PRIORITY_RANK = { none: 0, low: 1, medium: 2, high: 3 };
export const PRIORITY_OPTIONS = [
  { value: 'high', label: 'High', mark: '!!!' },
  { value: 'medium', label: 'Medium', mark: '!!' },
  { value: 'low', label: 'Low', mark: '!' },
  { value: 'none', label: 'No priority', mark: '' },
];

// All-day reminders still need a moment to alert at.
export const ALL_DAY_ALERT_TIME = '09:00';

export function dueAtMs(reminder) {
  if (!reminder?.dueDate) return null;
  return new Date(`${reminder.dueDate}T${reminder.dueTime || ALL_DAY_ALERT_TIME}:00`).getTime();
}

// Timed reminders are overdue once their minute passes; all-day ones only
// once their whole day is over.
export function isOverdue(reminder, now = Date.now()) {
  if (!reminder?.dueDate || reminder.done) return false;
  if (!reminder.dueTime) return reminder.dueDate < localDateString(now);
  return dueAtMs(reminder) < now;
}

export function nextOccurrence(dateStr, repeat) {
  switch (repeat) {
    case 'daily':
      return shiftDateStr(dateStr, 1);
    case 'weekly':
      return shiftDateStr(dateStr, 7);
    case 'weekdays': {
      let next = shiftDateStr(dateStr, 1);
      while ([0, 6].includes(new Date(`${next}T00:00:00`).getDay())) next = shiftDateStr(next, 1);
      return next;
    }
    case 'monthly': {
      const [y, m, d] = dateStr.split('-').map(Number);
      // Day 0 of the month after next = last day of next month.
      const lastDay = new Date(y, m + 1, 0).getDate();
      return localDateString(new Date(y, m, Math.min(d, lastDay)));
    }
    default:
      return dateStr;
  }
}

// Completing a repeating reminder moves it to its next occurrence after
// today, so a week of missed dailies doesn't leave it overdue.
export function advanceRepeat(dateStr, repeat, today = localDateString()) {
  let next = nextOccurrence(dateStr, repeat);
  for (let i = 0; next <= today && i < 1000; i += 1) next = nextOccurrence(next, repeat);
  return next;
}

// All-day sorts before timed on the same day (empty string < "00:00").
function sortKey(reminder) {
  return `${reminder.dueDate ?? '~'} ${reminder.dueTime ?? ''}`;
}

export function compareReminders(a, b) {
  const byDue = sortKey(a).localeCompare(sortKey(b));
  if (byDue !== 0) return byDue;
  const byPriority = (PRIORITY_RANK[b.priority] || 0) - (PRIORITY_RANK[a.priority] || 0);
  if (byPriority !== 0) return byPriority;
  return (a.createdAt || 0) - (b.createdAt || 0);
}

export function dayLabel(dateStr, today = localDateString()) {
  if (dateStr === today) return 'Today';
  if (dateStr === shiftDateStr(today, 1)) return 'Tomorrow';
  if (dateStr === shiftDateStr(today, -1)) return 'Yesterday';
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric',
  });
}

// Shown in the viewer's own clock style: "3:00 PM" in the US, "15:00" in
// the UK, "3:00 pm" in India. `locale` is only passed by tests.
export function formatTime(hhmm, locale) {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(2000, 0, 1, h, m)
    .toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' })
    .replace(/\u202f/g, ' ');
}

// Returns [{ key, label, items }] sections for a view. Empty sections are
// dropped so the UI can render whatever comes back.
export function groupForView(view, reminders, today = localDateString()) {
  const list = Array.isArray(reminders) ? reminders : [];

  if (view === 'completed') {
    const items = list.filter(r => r.done).sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));
    return items.length ? [{ key: 'completed', label: 'Completed', items }] : [];
  }

  const active = list.filter(r => !r.done);
  const undated = active.filter(r => !r.dueDate).sort(compareReminders);
  const undatedGroup = undated.length ? [{ key: 'nodate', label: 'No date', items: undated }] : [];

  if (view === 'anytime') return undatedGroup;

  const dated = active.filter(r => r.dueDate).sort(compareReminders);
  const overdue = dated.filter(r => r.dueDate < today);
  const groups = overdue.length ? [{ key: 'overdue', label: 'Overdue', items: overdue }] : [];

  const upcoming = view === 'today'
    ? dated.filter(r => r.dueDate === today)
    : dated.filter(r => r.dueDate >= today);

  upcoming.forEach(reminder => {
    const last = groups[groups.length - 1];
    if (last?.key === reminder.dueDate) last.items.push(reminder);
    else groups.push({ key: reminder.dueDate, label: dayLabel(reminder.dueDate, today), items: [reminder] });
  });
  // "all": everything open, dated days first, undated last.
  return view === 'all' ? [...groups, ...undatedGroup] : groups;
}

export function badgeCount(reminders, now = Date.now()) {
  const today = localDateString(now);
  return (reminders || []).filter(r => !r.done && r.dueDate && r.dueDate <= today).length;
}

// Dashboard card: what's due on `date`, plus anything overdue when `date` is today.
export function remindersForDate(reminders, date, now = Date.now()) {
  const today = localDateString(now);
  const active = (reminders || []).filter(r => !r.done && r.dueDate).sort(compareReminders);
  return {
    overdue: date === today ? active.filter(r => r.dueDate < today) : [],
    due: active.filter(r => r.dueDate === date),
  };
}

export function matchesSearch(reminder, query) {
  const q = (query || '').trim().toLowerCase();
  if (!q) return true;
  const haystack = [reminder.title, reminder.note, ...(reminder.checklist || []).map(item => item.text)]
    .join('\n').toLowerCase();
  return haystack.includes(q);
}

// A snooze only counts while it's later than the due time; otherwise the due
// time itself is the next alert.
export function nextAlertAt(reminder) {
  const due = dueAtMs(reminder);
  if (due === null) return null;
  return reminder.snoozedUntil && reminder.snoozedUntil > due ? reminder.snoozedUntil : due;
}

// Reminders store a subject's Firestore id when signed in and its numeric id
// in guest mode; match either. A deleted subject simply returns null.
export function subjectForReminder(subjects, reminder) {
  if (!reminder?.subjectId) return null;
  const id = String(reminder.subjectId);
  return (subjects || []).find(s => String(s.firestoreId) === id || String(s.id) === id) || null;
}

export function subjectRefId(subject) {
  return subject ? String(subject.firestoreId ?? subject.id) : null;
}

// The Monday after today ("next week").
export function nextMonday(today = localDateString()) {
  const day = new Date(`${today}T00:00:00`).getDay();
  return shiftDateStr(today, ((8 - day) % 7) || 7);
}
