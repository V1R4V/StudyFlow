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
