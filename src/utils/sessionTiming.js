import { getSessionMinutes, localDateString, sessionMatchesSubject } from './sessions.js';

// Milliseconds since epoch survive Firestore and localStorage unchanged.
export function recordedSessionTiming(session) {
  const { startedAt, endedAt } = session || {};
  if (!Number.isFinite(startedAt) || !Number.isFinite(endedAt)
    || startedAt <= 0 || endedAt <= startedAt || endedAt > 8640000000000000) return null;
  return { startedAt, endedAt };
}

export function localDateTimeInput(milliseconds) {
  if (!Number.isFinite(milliseconds)) return '';
  const d = new Date(milliseconds);
  const pad = n => String(n).padStart(2, '0');
  return `${localDateString(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function timingValidationError(startedAt, endedAt, durationSeconds, now = Date.now()) {
  if (!recordedSessionTiming({ startedAt, endedAt })) return 'Enter a valid start and end. End must be after start.';
  if (endedAt > now + 1000) return 'Session times cannot be in the future.';
  if (durationSeconds > (endedAt - startedAt) / 1000 + 1) return 'Real time spent cannot exceed the time between start and end.';
  return '';
}

export function sessionTimingFields(raw) {
  if (raw.startedAt == null && raw.endedAt == null) return {};
  const timing = recordedSessionTiming(raw);
  if (!timing) throw new Error('Invalid session start or end.');
  return { ...timing, date: localDateString(timing.startedAt) };
}

export function formatRecordedDateTime(milliseconds) {
  return new Date(milliseconds).toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit',
  });
}

export function hourLabel(hour) {
  return new Date(2026, 0, 1, hour).toLocaleTimeString(undefined, { hour: 'numeric' });
}

export function studyTimingSummary(sessions, subjects = []) {
  const bySubject = new Map();
  const hourlyMinutes = Array(24).fill(0);
  const hourlyStarts = Array(24).fill(0);
  const recorded = [];
  for (const session of sessions) {
    const timing = recordedSessionTiming(session);
    if (!timing) continue;
    const subject = subjects.find(s => sessionMatchesSubject(session, s));
    const key = String(subject?.firestoreId ?? subject?.id ?? session.subjectId);
    if (!bySubject.has(key)) bySubject.set(key, {
      key, name: subject?.name || session.subjectName || 'Unknown subject',
      color: subject?.color || session.subjectColor || '#6b7280', starts: Array(24).fill(0), count: 0,
    });
    const row = bySubject.get(key);
    const hour = new Date(timing.startedAt).getHours();
    row.starts[hour] += 1;
    row.count += 1;
    hourlyStarts[hour] += 1;
    recorded.push({ session, ...timing, subject: row, hour });

    // Exact pause positions aren't stored. Distribute focused minutes over the
    // recorded window proportionally, and label the result as an estimate.
    const weight = Math.min(1, getSessionMinutes(session) * 60000 / (timing.endedAt - timing.startedAt));
    let cursor = timing.startedAt;
    while (cursor < timing.endedAt) {
      const d = new Date(cursor);
      const hr = d.getHours();
      // Advance on the absolute timeline, including repeated DST hours.
      const next = Math.min(timing.endedAt, cursor + (60 - d.getMinutes()) * 60000 - d.getSeconds() * 1000 - d.getMilliseconds());
      hourlyMinutes[hr] += (next - cursor) / 60000 * weight;
      cursor = next;
    }
  }
  return {
    subjects: [...bySubject.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    recorded: recorded.sort((a, b) => b.startedAt - a.startedAt), hourlyMinutes, hourlyStarts,
    missing: sessions.length - recorded.length,
  };
}
