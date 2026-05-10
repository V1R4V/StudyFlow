import {
  collection,
  collectionGroup,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
  orderBy,
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
  MAX_DAILY_GOAL: 24,
  MAX_WEEKLY_GOAL: 168,
  MAX_SESSION_SECONDS: 24 * 60 * 60,
  MAX_TOTAL_MINUTES: 1_000_000,
};

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
  return new Date().toISOString().slice(0, 10);
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
// Every session doc carries a `userId` field so a single collectionGroup
// query can fetch ALL of a user's sessions in one round trip instead of one
// query per subject (N+1).
// ============================================================================

export const addSession = async (userId, subjectId, sessionData) => {
  try {
    const safeSession = normalizeSession(sessionData);
    if (!safeSession) return null;
    const sessionsRef = collection(
      db,
      'studyflow_v1', userId, 'subjects', subjectId, 'sessions'
    );
    const docRef = await addDoc(sessionsRef, {
      ...safeSession,
      userId,
      createdAt: Timestamp.now(),
    });
    return { firestoreId: docRef.id, ...safeSession };
  } catch (err) {
    console.error('addSession error:', err);
    return null;
  }
};

// One collectionGroup query across the entire `sessions` collection group,
// filtered to the current user. Requires a Firestore composite index that
// the console will prompt for on first run.
export const getAllSessions = async (userId) => {
  try {
    const q = query(
      collectionGroup(db, 'sessions'),
      where('userId', '==', userId)
    );
    const snapshot = await getDocs(q);
    const all = snapshot.docs.map(d => ({ firestoreId: d.id, ...d.data() }));
    all.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    return all;
  } catch (err) {
    console.error('getAllSessions error:', err);
    return [];
  }
};

export const updateSession = async (userId, subjectId, sessionId, updates) => {
  try {
    const safeUpdates = normalizeSessionUpdates(updates);
    if (!safeUpdates) return;
    const sessionRef = doc(
      db,
      'studyflow_v1', userId, 'subjects', subjectId, 'sessions', sessionId
    );
    await updateDoc(sessionRef, safeUpdates);
  } catch (err) {
    console.error('updateSession error:', err);
  }
};

export const deleteSession = async (userId, subjectId, sessionId) => {
  try {
    const sessionRef = doc(
      db,
      'studyflow_v1', userId, 'subjects', subjectId, 'sessions', sessionId
    );
    await deleteDoc(sessionRef);
  } catch (err) {
    console.error('deleteSession error:', err);
  }
};

// ============================================================================
// Sync helpers (called from AuthContext)
// ============================================================================

const SUBJECTS_KEY = 'studyflow-subjects';
const SESSIONS_KEY = 'studyflow-sessions';
const TIMER_KEY = 'studyflow-timer';

// On login: migrate any pre-existing guest localStorage data up to Firestore
// (only if the account is empty), then mirror Firestore back into the cache.
// Uses writeBatch for migration so it's atomic and a single round trip.
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
        // Sequential subject writes because we need the firestoreId mapping.
        const idMap = {};
        for (const subject of safeSubjects) {
          const result = await addSubject(userId, subject);
          if (result?.firestoreId) idMap[String(subject.id)] = result.firestoreId;
        }

        // Sessions can be batched (500 ops per batch is Firestore's limit).
        if (safeSessions.length > 0) {
          const batch = writeBatch(db);
          let opsInBatch = 0;
          const batches = [batch];
          for (const session of safeSessions) {
            const fsSubjectId = idMap[String(session.subjectId)];
            if (!fsSubjectId) continue;
            const sessionRef = doc(
              collection(db, 'studyflow_v1', userId, 'subjects', fsSubjectId, 'sessions')
            );
            batches[batches.length - 1].set(sessionRef, {
              ...session,
              userId,
              createdAt: Timestamp.now(),
            });
            opsInBatch++;
            if (opsInBatch >= 450) {
              batches.push(writeBatch(db));
              opsInBatch = 0;
            }
          }
          await Promise.all(batches.map(b => b.commit()));
        }

        fsSubjects = await getSubjects(userId);
      }
    }

    const fsSessions = await getAllSessions(userId);

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
  window.dispatchEvent(new Event('studyflow:data-changed'));
}
