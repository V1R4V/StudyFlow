// Sessions store `subjectId` as the Firestore doc ID (string) when signed in,
// but subject objects expose two IDs: `firestoreId` (string) and `id` (numeric
// legacy from guest mode). Match against both so the filter works in either
// mode and on legacy session rows.
export function sessionMatchesSubject(session, subject) {
  if (!session || !subject) return false;
  const sid = String(session.subjectId);
  return (
    (subject.firestoreId !== undefined && sid === String(subject.firestoreId)) ||
    (subject.id !== undefined && sid === String(subject.id))
  );
}

export function getSessionMinutes(session) {
  if (typeof session.durationSeconds === 'number') return session.durationSeconds / 60;
  if (typeof session.duration === 'number') return session.duration;
  return 0;
}

// Local-time YYYY-MM-DD. Using toISOString() would key off UTC, which rolls a
// day early/late for users west/east of UTC and made "today" stop matching
// sessions stamped in local time.
export function localDateString(input) {
  const d = input instanceof Date ? input : input != null ? new Date(input) : new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
