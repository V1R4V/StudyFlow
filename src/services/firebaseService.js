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
    const subjectsRef = collection(db, 'studyflow_v1', userId, 'subjects');
    const docRef = await addDoc(subjectsRef, {
      ...subjectData,
      createdAt: Timestamp.now(),
    });
    return { firestoreId: docRef.id, ...subjectData };
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
    const subjectRef = doc(db, 'studyflow_v1', userId, 'subjects', subjectId);
    await updateDoc(subjectRef, updates);
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
    const sessionsRef = collection(
      db,
      'studyflow_v1', userId, 'subjects', subjectId, 'sessions'
    );
    const docRef = await addDoc(sessionsRef, {
      ...sessionData,
      userId,
      createdAt: Timestamp.now(),
    });
    return { firestoreId: docRef.id, ...sessionData };
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
    const sessionRef = doc(
      db,
      'studyflow_v1', userId, 'subjects', subjectId, 'sessions', sessionId
    );
    await updateDoc(sessionRef, updates);
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

      if (localSubjects.length > 0) {
        // Sequential subject writes because we need the firestoreId mapping.
        const idMap = {};
        for (const subject of localSubjects) {
          const result = await addSubject(userId, subject);
          if (result?.firestoreId) idMap[subject.id] = result.firestoreId;
        }

        // Sessions can be batched (500 ops per batch is Firestore's limit).
        if (localSessions.length > 0) {
          const batch = writeBatch(db);
          let opsInBatch = 0;
          const batches = [batch];
          for (const session of localSessions) {
            const fsSubjectId = idMap[session.subjectId];
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
