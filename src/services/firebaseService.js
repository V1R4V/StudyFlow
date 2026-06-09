import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  Timestamp,
  setDoc,
  getDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';

const LIMITS = {
  MAX_SUBJECTS: 50,
  MAX_SESSIONS: 2000,
  SUBJECT_NAME_MAX: 60,
  NOTES_MAX: 500,
  TODO_TEXT_MAX: 200,
  MAX_DAILY_GOAL: 24,
  MAX_WEEKLY_GOAL: 168,
  MAX_SESSION_SECONDS: 24 * 60 * 60,
  MAX_TOTAL_MINUTES: 1_000_000,
  // Breaks are tracked separately from study time and never roll into focus
  // totals. A break can run at most a few hours before we treat the value as
  // garbage.
  MAX_BREAK_SECONDS: 4 * 60 * 60,
  BREAK_NOTE_MAX: 200,
  HABIT_NAME_MAX: 80,
};

const BREAK_TYPES = new Set(['short', 'long', 'custom']);
const HABIT_PRIORITIES = new Set(['low', 'normal', 'high', 'critical']);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const COLOR_RE = /^#[0-9a-fA-F]{6}$/;

function clampNumber(value, min, max, fallback = min) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(min, Math.min(max, num));
}

function trimString(value, max) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

function isHexColor(value) {
  return typeof value === 'string' && COLOR_RE.test(value);
}

function normalizeDate(value) {
  if (typeof value === 'string' && DATE_RE.test(value)) return value;
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function normalizeSubject(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const name = trimString(raw.name, LIMITS.SUBJECT_NAME_MAX);
  if (!name) return null;
  const color = isHexColor(raw.color) ? raw.color : '#2b4bee';
  const dailyGoal = clampNumber(raw.dailyGoal, 0, LIMITS.MAX_DAILY_GOAL, 0);
  const weeklyGoal = clampNumber(raw.weeklyGoal, 0, LIMITS.MAX_WEEKLY_GOAL, 0);
  const totalTimeSpent = clampNumber(raw.totalTimeSpent, 0, LIMITS.MAX_TOTAL_MINUTES, 0);
  const id = raw.id ?? Date.now();
  return { id, name, color, dailyGoal, weeklyGoal, totalTimeSpent };
}

function normalizeSession(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const subjectId = raw.subjectId;
  if (subjectId === undefined || subjectId === null || subjectId === '') return null;
  const subjectName = trimString(raw.subjectName, LIMITS.SUBJECT_NAME_MAX);
  if (!subjectName) return null;
  const subjectColor = isHexColor(raw.subjectColor) ? raw.subjectColor : '#2b4bee';
  const durationSeconds = clampNumber(
    raw.durationSeconds ?? Number(raw.duration) * 60,
    1,
    LIMITS.MAX_SESSION_SECONDS,
    60
  );
  const duration = Math.max(1, Math.ceil(durationSeconds / 60));
  const focusRating = clampNumber(raw.focusRating, 1, 5, 4);
  const notes = trimString(raw.notes, LIMITS.NOTES_MAX);
  const date = normalizeDate(raw.date);
  const id = raw.id ?? Date.now();

  return {
    id,
    subjectId,
    subjectName,
    subjectColor,
    duration,
    durationSeconds,
    focusRating,
    notes,
    date,
  };
}

function normalizeSubjectUpdates(updates) {
  if (!updates || typeof updates !== 'object') return null;
  const safe = {};

  if (Object.prototype.hasOwnProperty.call(updates, 'name')) {
    const name = trimString(updates.name, LIMITS.SUBJECT_NAME_MAX);
    if (name) safe.name = name;
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'color')) {
    if (isHexColor(updates.color)) safe.color = updates.color;
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'dailyGoal')) {
    safe.dailyGoal = clampNumber(updates.dailyGoal, 0, LIMITS.MAX_DAILY_GOAL, 0);
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'weeklyGoal')) {
    safe.weeklyGoal = clampNumber(updates.weeklyGoal, 0, LIMITS.MAX_WEEKLY_GOAL, 0);
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'totalTimeSpent')) {
    safe.totalTimeSpent = clampNumber(updates.totalTimeSpent, 0, LIMITS.MAX_TOTAL_MINUTES, 0);
  }

  return Object.keys(safe).length > 0 ? safe : null;
}

function normalizeSessionUpdates(updates) {
  if (!updates || typeof updates !== 'object') return null;
  const safe = {};

  if (Object.prototype.hasOwnProperty.call(updates, 'focusRating')) {
    safe.focusRating = clampNumber(updates.focusRating, 1, 5, 4);
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'notes')) {
    safe.notes = trimString(updates.notes, LIMITS.NOTES_MAX);
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'date')) {
    safe.date = normalizeDate(updates.date);
  }
  // Allow editing the recorded duration so users can correct inflated
  // tracked time. Both keys must stay in sync: `duration` is the minutes
  // copy used by older code paths, `durationSeconds` is the source of truth.
  if (Object.prototype.hasOwnProperty.call(updates, 'durationSeconds')) {
    const secs = clampNumber(
      updates.durationSeconds,
      1,
      LIMITS.MAX_SESSION_SECONDS,
      60
    );
    safe.durationSeconds = secs;
    safe.duration = Math.max(1, Math.ceil(secs / 60));
  } else if (Object.prototype.hasOwnProperty.call(updates, 'duration')) {
    const mins = clampNumber(updates.duration, 1, 1440, 1);
    safe.duration = mins;
    safe.durationSeconds = mins * 60;
  }

  return Object.keys(safe).length > 0 ? safe : null;
}

// ============================================================================
// User profile
// ============================================================================

export const initializeUserProfile = async (userId, userData) => {
  try {
    const userRef = doc(db, 'studyflow_v1', userId);

    await setDoc(userRef, {
      displayName: userData.displayName || '',
      email: userData.email || '',
      createdAt: Timestamp.now(),
    }, { merge: true });
  } catch (err) {
    console.error('initializeUserProfile error:', err);
  }
};

export const getUserProfile = async (userId) => {
  try {
    const userRef = doc(db, 'studyflow_v1', userId);
    const snap = await getDoc(userRef);
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  } catch (err) {
    console.error('getUserProfile error:', err);
    return null;
  }
};

// ============================================================================
// Subjects
// ============================================================================

export const addSubject = async (userId, subjectData) => {
  try {
    const safeSubject = normalizeSubject(subjectData);
    if (!safeSubject) return null;

    const subjectsRef = collection(db, 'studyflow_v1', userId, 'subjects');

    const docRef = await addDoc(subjectsRef, {
      ...safeSubject,
      createdAt: Timestamp.now(),
    });

    return { firestoreId: docRef.id, ...safeSubject };
  } catch (err) {
    console.error('addSubject error:', err);
    return null;
  }
};

export const getSubjects = async (userId) => {
  try {
    const subjectsRef = collection(db, 'studyflow_v1', userId, 'subjects');
    const q = query(subjectsRef, orderBy('createdAt', 'asc'));
    const snapshot = await getDocs(q);

    return snapshot.docs.map(d => ({ firestoreId: d.id, ...d.data() }));
  } catch (err) {
    console.error('getSubjects error:', err);
    return [];
  }
};

export const updateSubject = async (userId, subjectId, updates) => {
  try {
    const safeUpdates = normalizeSubjectUpdates(updates);
    if (!safeUpdates) return;

    const subjectRef = doc(db, 'studyflow_v1', userId, 'subjects', subjectId);
    await updateDoc(subjectRef, safeUpdates);
  } catch (err) {
    console.error('updateSubject error:', err);
  }
};

export const deleteSubject = async (userId, subjectId) => {
  try {
    const subjectRef = doc(db, 'studyflow_v1', userId, 'subjects', subjectId);
    await deleteDoc(subjectRef);
  } catch (err) {
    console.error('deleteSubject error:', err);
  }
};

// ============================================================================
// Sessions
// New structure:
// studyflow_v1/{userId}/sessions/{sessionId}
// This avoids collectionGroup queries and loads recent sessions by default.
// ============================================================================

export const addSession = async (userId, subjectId, sessionData) => {
  try {
    const safeSession = normalizeSession({
      ...sessionData,
      subjectId: sessionData.subjectId ?? subjectId,
    });

    if (!safeSession) return null;

    const sessionsRef = collection(db, 'studyflow_v1', userId, 'sessions');

    const docRef = await addDoc(sessionsRef, {
      ...safeSession,
      subjectId,
      userId,
      createdAt: Timestamp.now(),
    });

    return {
      firestoreId: docRef.id,
      ...safeSession,
      subjectId,
      userId,
    };
  } catch (err) {
    console.error('addSession error:', err);
    return null;
  }
};

export const getRecentSessions = async (userId, pageSize = 50) => {
  try {
    const sessionsRef = collection(db, 'studyflow_v1', userId, 'sessions');

    const q = query(
      sessionsRef,
      orderBy('date', 'desc'),
      limit(pageSize)
    );

    const snapshot = await getDocs(q);

    const sessions = snapshot.docs
      .map(d => ({ firestoreId: d.id, ...d.data() }))
      .sort((a, b) => {
        if (a.date !== b.date) return a.date < b.date ? 1 : -1;
        const aMs = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const bMs = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return bMs - aMs;
      });

    return {
      sessions,
      lastDoc: snapshot.docs[snapshot.docs.length - 1] || null,
    };
  } catch (err) {
    console.error('getRecentSessions error:', err);
    return { sessions: [], lastDoc: null };
  }
};

export const getMoreSessions = async (userId, lastDoc, pageSize = 50) => {
  try {
    if (!lastDoc) return { sessions: [], lastDoc: null };

    const sessionsRef = collection(db, 'studyflow_v1', userId, 'sessions');

    const q = query(
      sessionsRef,
      orderBy('date', 'desc'),
      startAfter(lastDoc),
      limit(pageSize)
    );

    const snapshot = await getDocs(q);

    return {
      sessions: snapshot.docs.map(d => ({ firestoreId: d.id, ...d.data() })),
      lastDoc: snapshot.docs[snapshot.docs.length - 1] || null,
    };
  } catch (err) {
    console.error('getMoreSessions error:', err);
    return { sessions: [], lastDoc: null };
  }
};

// How far back analytics (heatmap, study debt, day/hour charts, KPIs) reach.
// A full year + one month of slack so a 12-month heatmap is always complete.
const ANALYTICS_WINDOW_DAYS = 396;
// Safety ceiling so a pathological account can't pull an unbounded read.
// A heavy user logging ~10 sessions/day for a year is ~3650 docs.
const ANALYTICS_MAX_DOCS = 5000;

function dateStringDaysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Loads the trailing year of sessions for analytics. Bounded by date (so the
// query cost scales with one year of activity, not the user's entire history)
// and hard-capped by ANALYTICS_MAX_DOCS. Older sessions remain reachable via
// the paginated getRecentSessions/getMoreSessions path used by the list view.
export const getSessionsForAnalytics = async (
  userId,
  days = ANALYTICS_WINDOW_DAYS
) => {
  try {
    const sessionsRef = collection(db, 'studyflow_v1', userId, 'sessions');
    const cutoff = dateStringDaysAgo(days);

    const q = query(
      sessionsRef,
      where('date', '>=', cutoff),
      orderBy('date', 'desc'),
      limit(ANALYTICS_MAX_DOCS)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ firestoreId: d.id, ...d.data() }));
  } catch (err) {
    console.error('getSessionsForAnalytics error:', err);
    return [];
  }
};

// Backward-compatible name so existing imports do not break. Returns the
// trailing year of sessions so long-horizon analytics (heatmap, multi-week
// study debt, yearly KPIs) stay accurate.
export const getAllSessions = async (userId) => {
  return getSessionsForAnalytics(userId);
};

export const updateSession = async (userId, subjectId, sessionId, updates) => {
  try {
    const safeUpdates = normalizeSessionUpdates(updates);
    if (!safeUpdates) return;

    const sessionRef = doc(db, 'studyflow_v1', userId, 'sessions', sessionId);
    await updateDoc(sessionRef, safeUpdates);
  } catch (err) {
    console.error('updateSession error:', err);
  }
};

export const deleteSession = async (userId, subjectId, sessionId) => {
  try {
    const sessionRef = doc(db, 'studyflow_v1', userId, 'sessions', sessionId);
    await deleteDoc(sessionRef);
  } catch (err) {
    console.error('deleteSession error:', err);
  }
};

// ============================================================================
// Sync helpers
// ============================================================================

const SUBJECTS_KEY = 'studyflow-subjects';
const SESSIONS_KEY = 'studyflow-sessions';
const TIMER_KEY = 'studyflow-timer';

export async function syncUserDataOnLogin(userId, userInfo) {
  try {
    await initializeUserProfile(userId, userInfo);

    let fsSubjects = await getSubjects(userId);

    if (fsSubjects.length === 0) {
      const localSubjects = JSON.parse(localStorage.getItem(SUBJECTS_KEY) || '[]');
      const localSessions = JSON.parse(localStorage.getItem(SESSIONS_KEY) || '[]');

      const safeSubjects = localSubjects
        .map(normalizeSubject)
        .filter(Boolean)
        .slice(0, LIMITS.MAX_SUBJECTS);

      const safeSubjectIds = new Set(safeSubjects.map(s => String(s.id)));

      const safeSessions = localSessions
        .map(normalizeSession)
        .filter(Boolean)
        .filter(s => safeSubjectIds.has(String(s.subjectId)))
        .slice(0, LIMITS.MAX_SESSIONS);

      if (safeSubjects.length > 0) {
        const idMap = {};

        for (const subject of safeSubjects) {
          const result = await addSubject(userId, subject);
          if (result?.firestoreId) idMap[String(subject.id)] = result.firestoreId;
        }

        if (safeSessions.length > 0) {
          let batch = writeBatch(db);
          const batches = [];
          let opsInBatch = 0;

          for (const session of safeSessions) {
            const fsSubjectId = idMap[String(session.subjectId)];
            if (!fsSubjectId) continue;

            const sessionRef = doc(collection(db, 'studyflow_v1', userId, 'sessions'));

            batch.set(sessionRef, {
              ...session,
              subjectId: fsSubjectId,
              userId,
              createdAt: Timestamp.now(),
            });

            opsInBatch++;

            if (opsInBatch >= 450) {
              batches.push(batch);
              batch = writeBatch(db);
              opsInBatch = 0;
            }
          }

          if (opsInBatch > 0) {
            batches.push(batch);
          }

          await Promise.all(batches.map(b => b.commit()));
        }

        fsSubjects = await getSubjects(userId);
      }
    }

    const fsSessions = await getSessionsForAnalytics(userId);

    localStorage.setItem(SUBJECTS_KEY, JSON.stringify(fsSubjects));
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(fsSessions));

    window.dispatchEvent(new Event('studyflow:data-changed'));

    return { subjects: fsSubjects, sessions: fsSessions };
  } catch (err) {
    console.error('syncUserDataOnLogin error:', err);
    return null;
  }
}

export function clearLocalDataOnLogout() {
  localStorage.removeItem(SUBJECTS_KEY);
  localStorage.removeItem(SESSIONS_KEY);
  localStorage.removeItem(TIMER_KEY);
  localStorage.removeItem(TODOS_KEY);
  localStorage.removeItem(PLAN_ENTRIES_KEY);
  localStorage.removeItem(BREAKS_KEY);
  localStorage.removeItem(HABITS_KEY);
  localStorage.removeItem(HABIT_LOGS_KEY);
  window.dispatchEvent(new Event('studyflow:data-changed'));
}

// ============================================================================
// Todos (Daily Planner)
// studyflow_v1/{userId}/todos/{todoId}
// Each todo belongs to a single date (YYYY-MM-DD), optionally tagged to a subject.
// ============================================================================

const TODOS_KEY = 'studyflow-todos';

function normalizeTodo(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const text = trimString(raw.text, LIMITS.TODO_TEXT_MAX);
  if (!text) return null;
  const date = normalizeDate(raw.date);
  const done = Boolean(raw.done);
  // subjectId is optional; if missing keep null so we can render an untagged todo
  const subjectId = raw.subjectId ? String(raw.subjectId) : null;
  const subjectName = subjectId ? trimString(raw.subjectName, LIMITS.SUBJECT_NAME_MAX) : null;
  const subjectColor = subjectId && isHexColor(raw.subjectColor) ? raw.subjectColor : null;
  const id = raw.id ?? Date.now();
  return { id, text, date, done, subjectId, subjectName, subjectColor };
}

function normalizeTodoUpdates(updates) {
  if (!updates || typeof updates !== 'object') return null;
  const safe = {};

  if (Object.prototype.hasOwnProperty.call(updates, 'text')) {
    const text = trimString(updates.text, LIMITS.TODO_TEXT_MAX);
    if (text) safe.text = text;
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'done')) {
    safe.done = Boolean(updates.done);
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'subjectId')) {
    safe.subjectId = updates.subjectId ? String(updates.subjectId) : null;
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'subjectName')) {
    safe.subjectName = updates.subjectName
      ? trimString(updates.subjectName, LIMITS.SUBJECT_NAME_MAX)
      : null;
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'subjectColor')) {
    safe.subjectColor = isHexColor(updates.subjectColor) ? updates.subjectColor : null;
  }

  return Object.keys(safe).length > 0 ? safe : null;
}

export const addTodo = async (userId, todoData) => {
  try {
    const safe = normalizeTodo(todoData);
    if (!safe) return null;

    const todosRef = collection(db, 'studyflow_v1', userId, 'todos');
    const docRef = await addDoc(todosRef, {
      ...safe,
      createdAt: Timestamp.now(),
    });
    return { firestoreId: docRef.id, ...safe };
  } catch (err) {
    console.error('addTodo error:', err);
    return null;
  }
};

export const getAllTodos = async (userId) => {
  try {
    const todosRef = collection(db, 'studyflow_v1', userId, 'todos');
    const q = query(todosRef, orderBy('date', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ firestoreId: d.id, ...d.data() }));
  } catch (err) {
    console.error('getAllTodos error:', err);
    return [];
  }
};

export const updateTodo = async (userId, todoId, updates) => {
  try {
    const safe = normalizeTodoUpdates(updates);
    if (!safe) return;
    const todoRef = doc(db, 'studyflow_v1', userId, 'todos', todoId);
    await updateDoc(todoRef, safe);
  } catch (err) {
    console.error('updateTodo error:', err);
  }
};

export const deleteTodo = async (userId, todoId) => {
  try {
    const todoRef = doc(db, 'studyflow_v1', userId, 'todos', todoId);
    await deleteDoc(todoRef);
  } catch (err) {
    console.error('deleteTodo error:', err);
  }
};

// ============================================================================
// Plan entries (Command Center study planner)
// studyflow_v1/{userId}/planEntries/{id}
// One entry = planned target hours for a subject on a day. scope 'weekly' uses
// `day` (0=Sun…6=Sat) and recurs every week; scope 'once' uses a specific
// `date`. Logged study time is compared against these to show plan progress.
// ============================================================================

const PLAN_ENTRIES_KEY = 'studyflow-plan-entries';
const MAX_PLAN_HOURS = 24;

function normalizePlanEntry(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const subjectId = raw.subjectId ? String(raw.subjectId) : null;
  if (!subjectId) return null;
  const hours = clampNumber(raw.hours, 0, MAX_PLAN_HOURS, 0);
  const scope = raw.scope === 'once' ? 'once' : 'weekly';
  let day = null;
  let date = null;

  if (scope === 'weekly') {
    const d = Math.floor(Number(raw.day));
    if (!Number.isFinite(d) || d < 0 || d > 6) return null;
    day = d;
  } else {
    date = normalizeDate(raw.date);
  }

  const id = raw.id ?? Date.now();
  return { id, subjectId, hours, scope, day, date };
}

function normalizePlanEntryUpdates(updates) {
  if (!updates || typeof updates !== 'object') return null;
  const safe = {};
  if (Object.prototype.hasOwnProperty.call(updates, 'hours')) {
    safe.hours = clampNumber(updates.hours, 0, MAX_PLAN_HOURS, 0);
  }
  return Object.keys(safe).length > 0 ? safe : null;
}

export const addPlanEntry = async (userId, entryData) => {
  try {
    const safe = normalizePlanEntry(entryData);
    if (!safe) return null;
    const ref = collection(db, 'studyflow_v1', userId, 'planEntries');
    const docRef = await addDoc(ref, { ...safe, createdAt: Timestamp.now() });
    return { firestoreId: docRef.id, ...safe };
  } catch (err) {
    console.error('addPlanEntry error:', err);
    return null;
  }
};

export const getAllPlanEntries = async (userId) => {
  try {
    const ref = collection(db, 'studyflow_v1', userId, 'planEntries');
    const snapshot = await getDocs(ref);
    return snapshot.docs.map(d => ({ firestoreId: d.id, ...d.data() }));
  } catch (err) {
    console.error('getAllPlanEntries error:', err);
    return [];
  }
};

export const updatePlanEntry = async (userId, entryId, updates) => {
  try {
    const safe = normalizePlanEntryUpdates(updates);
    if (!safe) return;
    const ref = doc(db, 'studyflow_v1', userId, 'planEntries', entryId);
    await updateDoc(ref, safe);
  } catch (err) {
    console.error('updatePlanEntry error:', err);
  }
};

export const deletePlanEntry = async (userId, entryId) => {
  try {
    const ref = doc(db, 'studyflow_v1', userId, 'planEntries', entryId);
    await deleteDoc(ref);
  } catch (err) {
    console.error('deletePlanEntry error:', err);
  }
};

// ============================================================================
// Breaks
// studyflow_v1/{userId}/breaks/{breakId}
// Breaks are logged and aggregated entirely separately from study sessions.
// They never contribute to focus/session minutes anywhere in the app — they
// are surfaced only as "extra info" (break insights). Shape mirrors a trimmed
// session: a date, a tracked duration, and a type (short/long/custom).
// ============================================================================

const BREAKS_KEY = 'studyflow-breaks';

function normalizeBreak(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const durationSeconds = clampNumber(
    raw.durationSeconds ?? Number(raw.duration) * 60,
    1,
    LIMITS.MAX_BREAK_SECONDS,
    60
  );
  const duration = Math.max(1, Math.ceil(durationSeconds / 60));
  const type = BREAK_TYPES.has(raw.type) ? raw.type : 'custom';
  const note = trimString(raw.note, LIMITS.BREAK_NOTE_MAX);
  const date = normalizeDate(raw.date);
  const id = raw.id ?? Date.now();
  return { id, date, durationSeconds, duration, type, note };
}

export const addBreak = async (userId, breakData) => {
  try {
    const safe = normalizeBreak(breakData);
    if (!safe) return null;

    const breaksRef = collection(db, 'studyflow_v1', userId, 'breaks');
    const docRef = await addDoc(breaksRef, {
      ...safe,
      userId,
      createdAt: Timestamp.now(),
    });
    return { firestoreId: docRef.id, ...safe };
  } catch (err) {
    console.error('addBreak error:', err);
    return null;
  }
};

export const getAllBreaks = async (userId) => {
  try {
    const breaksRef = collection(db, 'studyflow_v1', userId, 'breaks');
    const q = query(breaksRef, orderBy('date', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ firestoreId: d.id, ...d.data() }));
  } catch (err) {
    console.error('getAllBreaks error:', err);
    return [];
  }
};

export const deleteBreak = async (userId, breakId) => {
  try {
    const breakRef = doc(db, 'studyflow_v1', userId, 'breaks', breakId);
    await deleteDoc(breakRef);
  } catch (err) {
    console.error('deleteBreak error:', err);
  }
};

// ============================================================================
// Habits + habit logs (the Command Center habit tracker)
// studyflow_v1/{userId}/habits/{habitId}      - habit definitions (tied to a subject)
// studyflow_v1/{userId}/habitLogs/{logId}     - one doc per completed habit-day
// A habit recurs on chosen weekdays; completions are stored only when done, so
// "missed"/"pending" are derived, never written. Habits are completely separate
// from study sessions and break tracking.
// ============================================================================

const HABITS_KEY = 'studyflow-habits';
const HABIT_LOGS_KEY = 'studyflow-habit-logs';

function normalizeDays(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  for (const d of raw) {
    const n = Math.floor(Number(d));
    if (Number.isFinite(n) && n >= 0 && n <= 6) seen.add(n);
  }
  return [...seen].sort((a, b) => a - b);
}

function normalizeHabit(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const name = trimString(raw.name, LIMITS.HABIT_NAME_MAX);
  if (!name) return null;
  const subjectId = raw.subjectId ? String(raw.subjectId) : null;
  if (!subjectId) return null;
  const subjectName = trimString(raw.subjectName, LIMITS.SUBJECT_NAME_MAX) || name;
  const subjectColor = isHexColor(raw.subjectColor) ? raw.subjectColor : '#2b4bee';
  const priority = HABIT_PRIORITIES.has(raw.priority) ? raw.priority : 'normal';
  const days = normalizeDays(raw.days);
  const active = raw.active === undefined ? true : Boolean(raw.active);
  const startDate = normalizeDate(raw.startDate);
  const id = raw.id ?? Date.now();
  return { id, subjectId, subjectName, subjectColor, name, priority, days, active, startDate };
}

function normalizeHabitUpdates(updates) {
  if (!updates || typeof updates !== 'object') return null;
  const safe = {};
  if (Object.prototype.hasOwnProperty.call(updates, 'name')) {
    const name = trimString(updates.name, LIMITS.HABIT_NAME_MAX);
    if (name) safe.name = name;
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'priority')) {
    if (HABIT_PRIORITIES.has(updates.priority)) safe.priority = updates.priority;
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'days')) {
    safe.days = normalizeDays(updates.days);
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'active')) {
    safe.active = Boolean(updates.active);
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'subjectId')) {
    safe.subjectId = updates.subjectId ? String(updates.subjectId) : null;
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'subjectName')) {
    safe.subjectName = trimString(updates.subjectName, LIMITS.SUBJECT_NAME_MAX);
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'subjectColor')) {
    if (isHexColor(updates.subjectColor)) safe.subjectColor = updates.subjectColor;
  }
  return Object.keys(safe).length > 0 ? safe : null;
}

function normalizeHabitLog(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const habitId = raw.habitId ? String(raw.habitId) : null;
  if (!habitId) return null;
  const date = normalizeDate(raw.date);
  const id = raw.id ?? Date.now();
  return { id, habitId, date, done: true };
}

export const addHabit = async (userId, habitData) => {
  try {
    const safe = normalizeHabit(habitData);
    if (!safe) return null;
    const habitsRef = collection(db, 'studyflow_v1', userId, 'habits');
    const docRef = await addDoc(habitsRef, { ...safe, createdAt: Timestamp.now() });
    return { firestoreId: docRef.id, ...safe };
  } catch (err) {
    console.error('addHabit error:', err);
    return null;
  }
};

export const getAllHabits = async (userId) => {
  try {
    const habitsRef = collection(db, 'studyflow_v1', userId, 'habits');
    const q = query(habitsRef, orderBy('createdAt', 'asc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ firestoreId: d.id, ...d.data() }));
  } catch (err) {
    console.error('getAllHabits error:', err);
    return [];
  }
};

export const updateHabit = async (userId, habitId, updates) => {
  try {
    const safe = normalizeHabitUpdates(updates);
    if (!safe) return;
    const habitRef = doc(db, 'studyflow_v1', userId, 'habits', habitId);
    await updateDoc(habitRef, safe);
  } catch (err) {
    console.error('updateHabit error:', err);
  }
};

export const deleteHabit = async (userId, habitId) => {
  try {
    const habitRef = doc(db, 'studyflow_v1', userId, 'habits', habitId);
    await deleteDoc(habitRef);
  } catch (err) {
    console.error('deleteHabit error:', err);
  }
};

export const addHabitLog = async (userId, logData) => {
  try {
    const safe = normalizeHabitLog(logData);
    if (!safe) return null;
    const logsRef = collection(db, 'studyflow_v1', userId, 'habitLogs');
    const docRef = await addDoc(logsRef, { ...safe, createdAt: Timestamp.now() });
    return { firestoreId: docRef.id, ...safe };
  } catch (err) {
    console.error('addHabitLog error:', err);
    return null;
  }
};

export const getAllHabitLogs = async (userId) => {
  try {
    const logsRef = collection(db, 'studyflow_v1', userId, 'habitLogs');
    const q = query(logsRef, orderBy('date', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ firestoreId: d.id, ...d.data() }));
  } catch (err) {
    console.error('getAllHabitLogs error:', err);
    return [];
  }
};

export const deleteHabitLog = async (userId, logId) => {
  try {
    const logRef = doc(db, 'studyflow_v1', userId, 'habitLogs', logId);
    await deleteDoc(logRef);
  } catch (err) {
    console.error('deleteHabitLog error:', err);
  }
};
