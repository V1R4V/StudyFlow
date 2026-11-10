const STORAGE_KEY = 'studyflow-session-time-zone';
export const TIME_ZONE_EVENT = 'studyflow:time-zone-changed';
const formatters = new Map();

export function deviceTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

export function isTimeZone(value) {
  try {
    if (typeof value !== 'string' || !value) return false;
    new Intl.DateTimeFormat('en', { timeZone: value }).format();
    return true;
  } catch { return false; }
}

export function timeZonePreference() {
  try {
    const saved = globalThis.localStorage?.getItem(STORAGE_KEY);
    return isTimeZone(saved) ? saved : 'automatic';
  } catch { return 'automatic'; }
}

export function sessionTimeZone() {
  const preference = timeZonePreference();
  return preference === 'automatic' ? deviceTimeZone() : preference;
}

export function saveTimeZonePreference(value) {
  if (value !== 'automatic' && !isTimeZone(value)) return;
  localStorage.setItem(STORAGE_KEY, value);
  window.dispatchEvent(new Event(TIME_ZONE_EVENT));
}

export function availableTimeZones() {
  return [...new Set([deviceTimeZone(), sessionTimeZone(), 'UTC',
    ...(Intl.supportedValuesOf?.('timeZone') || [])])].sort();
}

// A wall-clock value for display/editing, never a replacement for the stored instant.
export function zonedDateTimeInput(milliseconds, timeZone = sessionTimeZone()) {
  if (!Number.isFinite(milliseconds) || Number.isNaN(new Date(milliseconds).getTime())) return '';
  if (!formatters.has(timeZone)) formatters.set(timeZone, new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }));
  const parts = Object.fromEntries(formatters.get(timeZone).formatToParts(milliseconds).map(p => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
}

// Resolve wall time with candidate UTC offsets on both sides of any DST change.
// Gaps are invalid. Repeated times prefer the original session's occurrence.
export function parseZonedDateTime(value, timeZone = sessionTimeZone(), originalInstant) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(value)) return NaN;
  const target = value.length === 16 ? `${value}:00` : value;
  const naive = Date.parse(`${target}Z`);
  if (!Number.isFinite(naive)) return NaN;
  const offsets = new Set();
  for (let hours = -36; hours <= 36; hours += 6) {
    const probe = naive + hours * 3600000;
    offsets.add(Date.parse(`${zonedDateTimeInput(probe, timeZone)}Z`) - probe);
  }
  const candidates = [...offsets].map(offset => naive - offset)
    .filter(instant => zonedDateTimeInput(instant, timeZone) === target)
    .sort((a, b) => Number.isFinite(originalInstant)
      ? Math.abs(a - originalInstant) - Math.abs(b - originalInstant) : a - b);
  return candidates[0] ?? NaN;
}
