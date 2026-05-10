import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuthContext } from './AuthContext';
import {
  getSubjects,
  getAllSessions,
  addSubject as fsAddSubject,
  deleteSubject as fsDeleteSubject,
  updateSubject as fsUpdateSubject,
  addSession as fsAddSession,
  updateSession as fsUpdateSession,
  deleteSession as fsDeleteSession,
} from '../services/firebaseService';

// Single shared store for subjects + sessions. One fetch per session,
// shared across every page. Guest mode reads/writes localStorage; signed-in
// mode reads/writes Firestore and keeps localStorage as a render cache.

const Context = createContext(null);

const SUBJECTS_KEY = 'studyflow-subjects';
const SESSIONS_KEY = 'studyflow-sessions';

function readGuestSubjects() {
  try {
    const raw = localStorage.getItem(SUBJECTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function readGuestSessions() {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function StudyDataProvider({ children }) {
  const { user, loading: authLoading } = useAuthContext();

  // Hydrate immediately from the cache so the UI doesn't flash empty.
  const [subjects, setSubjects] = useState(readGuestSubjects);
  const [sessions, setSessions] = useState(readGuestSessions);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (user) {
      const [fsSubjects, fsSessions] = await Promise.all([
        getSubjects(user.uid),
        getAllSessions(user.uid),
      ]);
      setSubjects(fsSubjects);
      setSessions(fsSessions);
      localStorage.setItem(SUBJECTS_KEY, JSON.stringify(fsSubjects));
      localStorage.setItem(SESSIONS_KEY, JSON.stringify(fsSessions));
    } else {
      setSubjects(readGuestSubjects());
      setSessions(readGuestSessions());
    }
  }, [user]);

  // Load when auth settles and whenever the signed-in identity changes.
  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;
    setLoading(true);
    refresh().finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [authLoading, user, refresh]);

  // Listen for external mutations (e.g., TimerContext saving a session).
  useEffect(() => {
    function onChange() { refresh(); }
    window.addEventListener('studyflow:data-changed', onChange);
    return () => window.removeEventListener('studyflow:data-changed', onChange);
  }, [refresh]);

  // Persist guest state to localStorage on changes.
  useEffect(() => {
    if (!user && !authLoading) {
      localStorage.setItem(SUBJECTS_KEY, JSON.stringify(subjects));
    }
  }, [subjects, user, authLoading]);
  useEffect(() => {
    if (!user && !authLoading) {
      localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
    }
  }, [sessions, user, authLoading]);

  // ---------- Mutations ----------

  async function addSubject(subject) {
    if (user) {
      await fsAddSubject(user.uid, subject);
      await refresh();
    } else {
      setSubjects(prev => [...prev, subject]);
    }
  }

  async function updateSubject(localId, updates) {
    if (user) {
      const subj = subjects.find(s => s.id === localId);
      if (subj?.firestoreId) {
        await fsUpdateSubject(user.uid, subj.firestoreId, updates);
        await refresh();
      }
    } else {
      setSubjects(prev => prev.map(s => s.id === localId ? { ...s, ...updates } : s));
    }
  }

  async function deleteSubject(localId) {
    if (user) {
      const subj = subjects.find(s => s.id === localId);
      if (subj?.firestoreId) {
        await fsDeleteSubject(user.uid, subj.firestoreId);
        await refresh();
      }
    } else {
      setSubjects(prev => prev.filter(s => s.id !== localId));
      setSessions(prev => prev.filter(s => s.subjectId !== localId));
    }
  }

  async function addSession(subjectLocalId, sessionData) {
    if (user) {
      const subj = subjects.find(s => s.id === subjectLocalId);
      if (subj?.firestoreId) {
        await fsAddSession(user.uid, subj.firestoreId, sessionData);
        await refresh();
      }
    } else {
      setSessions(prev => [sessionData, ...prev]);
    }
  }

  async function updateSession(sessionLocalId, updates) {
    if (user) {
      const sess = sessions.find(s => s.id === sessionLocalId);
      const subj = subjects.find(s => s.id === sess?.subjectId);
      if (subj?.firestoreId && sess?.firestoreId) {
        await fsUpdateSession(user.uid, subj.firestoreId, sess.firestoreId, updates);
        await refresh();
      }
    } else {
      setSessions(prev => prev.map(s => s.id === sessionLocalId ? { ...s, ...updates } : s));
    }
  }

  async function deleteSession(sessionLocalId) {
    if (user) {
      const sess = sessions.find(s => s.id === sessionLocalId);
      const subj = subjects.find(s => s.id === sess?.subjectId);
      if (subj?.firestoreId && sess?.firestoreId) {
        await fsDeleteSession(user.uid, subj.firestoreId, sess.firestoreId);
        await refresh();
      }
    } else {
      setSessions(prev => prev.filter(s => s.id !== sessionLocalId));
    }
  }

  return (
    <Context.Provider value={{
      subjects, sessions, loading,
      addSubject, updateSubject, deleteSubject,
      addSession, updateSession, deleteSession,
      refresh,
    }}>
      {children}
    </Context.Provider>
  );
}

export function useStudyData() {
  const ctx = useContext(Context);
  if (!ctx) throw new Error('useStudyData must be used inside <StudyDataProvider>');
  return ctx;
}
