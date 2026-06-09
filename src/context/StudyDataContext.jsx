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
  getAllTodos,
  addTodo as fsAddTodo,
  updateTodo as fsUpdateTodo,
  deleteTodo as fsDeleteTodo,
  getAllPlanEntries,
  addPlanEntry as fsAddPlanEntry,
  updatePlanEntry as fsUpdatePlanEntry,
  deletePlanEntry as fsDeletePlanEntry,
} from '../services/firebaseService';

// Single shared store for subjects + sessions. One fetch per session,
// shared across every page. Guest mode reads/writes localStorage; signed-in
// mode reads/writes Firestore and keeps localStorage as a render cache.

const Context = createContext(null);

const SUBJECTS_KEY = 'studyflow-subjects';
const SESSIONS_KEY = 'studyflow-sessions';
const TODOS_KEY = 'studyflow-todos';
const PLAN_ENTRIES_KEY = 'studyflow-plan-entries';

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

function readGuestTodos() {
  try {
    const raw = localStorage.getItem(TODOS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function readGuestPlanEntries() {
  try {
    const raw = localStorage.getItem(PLAN_ENTRIES_KEY);
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
  const [todos, setTodos] = useState(readGuestTodos);
  const [planEntries, setPlanEntries] = useState(readGuestPlanEntries);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (user) {
      const [fsSubjects, fsSessions, fsTodos, fsPlan] = await Promise.all([
        getSubjects(user.uid),
        getAllSessions(user.uid),
        getAllTodos(user.uid),
        getAllPlanEntries(user.uid),
      ]);
      setSubjects(fsSubjects);
      setSessions(fsSessions);
      setTodos(fsTodos);
      setPlanEntries(fsPlan);
      localStorage.setItem(SUBJECTS_KEY, JSON.stringify(fsSubjects));
      localStorage.setItem(SESSIONS_KEY, JSON.stringify(fsSessions));
      localStorage.setItem(TODOS_KEY, JSON.stringify(fsTodos));
      localStorage.setItem(PLAN_ENTRIES_KEY, JSON.stringify(fsPlan));
    } else {
      setSubjects(readGuestSubjects());
      setSessions(readGuestSessions());
      setTodos(readGuestTodos());
      setPlanEntries(readGuestPlanEntries());
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
  useEffect(() => {
    if (!user && !authLoading) {
      localStorage.setItem(TODOS_KEY, JSON.stringify(todos));
    }
  }, [todos, user, authLoading]);
  useEffect(() => {
    if (!user && !authLoading) {
      localStorage.setItem(PLAN_ENTRIES_KEY, JSON.stringify(planEntries));
    }
  }, [planEntries, user, authLoading]);

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
      setPlanEntries(prev => prev.filter(p => String(p.subjectId) !== String(localId)));
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
      if (sess?.firestoreId) {
        await fsUpdateSession(user.uid, sess.subjectId, sess.firestoreId, updates);
        await refresh();
      }
    } else {
      setSessions(prev => prev.map(s => s.id === sessionLocalId ? { ...s, ...updates } : s));
    }
  }

  async function deleteSession(sessionLocalId) {
    if (user) {
      const sess = sessions.find(s => s.id === sessionLocalId);
      if (sess?.firestoreId) {
        await fsDeleteSession(user.uid, sess.subjectId, sess.firestoreId);
        await refresh();
      }
    } else {
      setSessions(prev => prev.filter(s => s.id !== sessionLocalId));
    }
  }

  // ---------- Todos ----------

  async function addTodo(todoData) {
    if (user) {
      await fsAddTodo(user.uid, todoData);
      await refresh();
    } else {
      const id = Date.now();
      setTodos(prev => [{ ...todoData, id, done: Boolean(todoData.done) }, ...prev]);
    }
  }

  async function updateTodo(todoLocalId, updates) {
    if (user) {
      const t = todos.find(x => x.id === todoLocalId);
      if (t?.firestoreId) {
        await fsUpdateTodo(user.uid, t.firestoreId, updates);
        await refresh();
      }
    } else {
      setTodos(prev => prev.map(t => t.id === todoLocalId ? { ...t, ...updates } : t));
    }
  }

  async function deleteTodo(todoLocalId) {
    if (user) {
      const t = todos.find(x => x.id === todoLocalId);
      if (t?.firestoreId) {
        await fsDeleteTodo(user.uid, t.firestoreId);
        await refresh();
      }
    } else {
      setTodos(prev => prev.filter(t => t.id !== todoLocalId));
    }
  }

  // ---------- Plan entries (study planner) ----------
  // One entry per (subjectId, scope, day|date). Upsert is the single write path:
  // hours > 0 creates/updates the cell, hours <= 0 clears it.

  function planKeyMatch(e, subjectId, scope, day, date) {
    return (
      String(e.subjectId) === String(subjectId) &&
      e.scope === scope &&
      (scope === 'weekly' ? e.day === day : e.date === date)
    );
  }

  async function upsertPlanEntry(subjectId, { scope, day = null, date = null, hours }) {
    const safeScope = scope === 'once' ? 'once' : 'weekly';
    const key = { day: safeScope === 'weekly' ? day : null, date: safeScope === 'once' ? date : null };
    const h = Math.max(0, Number(hours) || 0);
    const existing = planEntries.find(e => planKeyMatch(e, subjectId, safeScope, key.day, key.date));

    if (user) {
      if (h <= 0) {
        if (existing?.firestoreId) {
          await fsDeletePlanEntry(user.uid, existing.firestoreId);
          await refresh();
        }
      } else if (existing?.firestoreId) {
        await fsUpdatePlanEntry(user.uid, existing.firestoreId, { hours: h });
        await refresh();
      } else {
        await fsAddPlanEntry(user.uid, { subjectId: String(subjectId), scope: safeScope, ...key, hours: h });
        await refresh();
      }
    } else {
      if (h <= 0) {
        if (existing) setPlanEntries(prev => prev.filter(e => e.id !== existing.id));
      } else if (existing) {
        setPlanEntries(prev => prev.map(e => (e.id === existing.id ? { ...e, hours: h } : e)));
      } else {
        const entry = {
          id: Date.now() + Math.floor(Math.random() * 1000),
          subjectId: String(subjectId),
          scope: safeScope,
          ...key,
          hours: h,
        };
        setPlanEntries(prev => [...prev, entry]);
      }
    }
  }

  return (
    <Context.Provider value={{
      subjects, sessions, todos, planEntries, loading,
      addSubject, updateSubject, deleteSubject,
      addSession, updateSession, deleteSession,
      addTodo, updateTodo, deleteTodo,
      upsertPlanEntry,
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
