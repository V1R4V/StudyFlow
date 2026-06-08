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
  getAllBreaks,
  addBreak as fsAddBreak,
  deleteBreak as fsDeleteBreak,
  getAllHabits,
  addHabit as fsAddHabit,
  updateHabit as fsUpdateHabit,
  deleteHabit as fsDeleteHabit,
  getAllHabitLogs,
  addHabitLog as fsAddHabitLog,
  deleteHabitLog as fsDeleteHabitLog,
} from '../services/firebaseService';

// Single shared store for subjects + sessions. One fetch per session,
// shared across every page. Guest mode reads/writes localStorage; signed-in
// mode reads/writes Firestore and keeps localStorage as a render cache.

const Context = createContext(null);

const SUBJECTS_KEY = 'studyflow-subjects';
const SESSIONS_KEY = 'studyflow-sessions';
const TODOS_KEY = 'studyflow-todos';
const BREAKS_KEY = 'studyflow-breaks';
const HABITS_KEY = 'studyflow-habits';
const HABIT_LOGS_KEY = 'studyflow-habit-logs';

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

function readGuestBreaks() {
  try {
    const raw = localStorage.getItem(BREAKS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function readGuestHabits() {
  try {
    const raw = localStorage.getItem(HABITS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function readGuestHabitLogs() {
  try {
    const raw = localStorage.getItem(HABIT_LOGS_KEY);
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
  const [breaks, setBreaks] = useState(readGuestBreaks);
  const [habits, setHabits] = useState(readGuestHabits);
  const [habitLogs, setHabitLogs] = useState(readGuestHabitLogs);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (user) {
      const [fsSubjects, fsSessions, fsTodos, fsBreaks, fsHabits, fsHabitLogs] = await Promise.all([
        getSubjects(user.uid),
        getAllSessions(user.uid),
        getAllTodos(user.uid),
        getAllBreaks(user.uid),
        getAllHabits(user.uid),
        getAllHabitLogs(user.uid),
      ]);
      setSubjects(fsSubjects);
      setSessions(fsSessions);
      setTodos(fsTodos);
      setBreaks(fsBreaks);
      setHabits(fsHabits);
      setHabitLogs(fsHabitLogs);
      localStorage.setItem(SUBJECTS_KEY, JSON.stringify(fsSubjects));
      localStorage.setItem(SESSIONS_KEY, JSON.stringify(fsSessions));
      localStorage.setItem(TODOS_KEY, JSON.stringify(fsTodos));
      localStorage.setItem(BREAKS_KEY, JSON.stringify(fsBreaks));
      localStorage.setItem(HABITS_KEY, JSON.stringify(fsHabits));
      localStorage.setItem(HABIT_LOGS_KEY, JSON.stringify(fsHabitLogs));
    } else {
      setSubjects(readGuestSubjects());
      setSessions(readGuestSessions());
      setTodos(readGuestTodos());
      setBreaks(readGuestBreaks());
      setHabits(readGuestHabits());
      setHabitLogs(readGuestHabitLogs());
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
      localStorage.setItem(BREAKS_KEY, JSON.stringify(breaks));
    }
  }, [breaks, user, authLoading]);
  useEffect(() => {
    if (!user && !authLoading) {
      localStorage.setItem(HABITS_KEY, JSON.stringify(habits));
    }
  }, [habits, user, authLoading]);
  useEffect(() => {
    if (!user && !authLoading) {
      localStorage.setItem(HABIT_LOGS_KEY, JSON.stringify(habitLogs));
    }
  }, [habitLogs, user, authLoading]);

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

  // ---------- Breaks ----------
  // Breaks live in their own collection and are kept out of every study
  // aggregation. The break timer (BreakContext) is the only writer.

  async function addBreak(breakData) {
    if (user) {
      await fsAddBreak(user.uid, breakData);
      await refresh();
    } else {
      const id = Date.now();
      setBreaks(prev => [{ ...breakData, id }, ...prev]);
    }
  }

  async function deleteBreak(breakLocalId) {
    if (user) {
      const b = breaks.find(x => x.id === breakLocalId);
      if (b?.firestoreId) {
        await fsDeleteBreak(user.uid, b.firestoreId);
        await refresh();
      }
    } else {
      setBreaks(prev => prev.filter(b => b.id !== breakLocalId));
    }
  }

  // ---------- Habits + habit logs ----------
  // The Command Center habit tracker. Completions are stored only when a habit
  // is marked done; "missed"/"pending" are derived at render time.

  async function addHabit(habitData) {
    if (user) {
      await fsAddHabit(user.uid, habitData);
      await refresh();
    } else {
      setHabits(prev => [...prev, habitData]);
    }
  }

  async function updateHabit(habitLocalId, updates) {
    if (user) {
      const h = habits.find(x => x.id === habitLocalId);
      if (h?.firestoreId) {
        await fsUpdateHabit(user.uid, h.firestoreId, updates);
        await refresh();
      }
    } else {
      setHabits(prev => prev.map(h => h.id === habitLocalId ? { ...h, ...updates } : h));
    }
  }

  async function deleteHabit(habitLocalId) {
    if (user) {
      const h = habits.find(x => x.id === habitLocalId);
      if (h?.firestoreId) {
        await fsDeleteHabit(user.uid, h.firestoreId);
        await refresh();
      }
    } else {
      setHabits(prev => prev.filter(h => h.id !== habitLocalId));
      // Drop the now-orphaned completion logs too.
      setHabitLogs(prev => prev.filter(l => String(l.habitId) !== String(habitLocalId)));
    }
  }

  // Mark a habit done/undone for a given date. Done = ensure a log exists;
  // undone = remove the existing log. Idempotent.
  async function toggleHabitDone(habitId, dateStr, done) {
    const existing = habitLogs.find(
      l => String(l.habitId) === String(habitId) && l.date === dateStr
    );
    if (user) {
      if (done && !existing) {
        await fsAddHabitLog(user.uid, { habitId: String(habitId), date: dateStr });
        await refresh();
      } else if (!done && existing?.firestoreId) {
        await fsDeleteHabitLog(user.uid, existing.firestoreId);
        await refresh();
      }
    } else {
      if (done && !existing) {
        setHabitLogs(prev => [
          { id: Date.now(), habitId: String(habitId), date: dateStr, done: true },
          ...prev,
        ]);
      } else if (!done && existing) {
        setHabitLogs(prev => prev.filter(l => l.id !== existing.id));
      }
    }
  }

  return (
    <Context.Provider value={{
      subjects, sessions, todos, breaks, habits, habitLogs, loading,
      addSubject, updateSubject, deleteSubject,
      addSession, updateSession, deleteSession,
      addTodo, updateTodo, deleteTodo,
      addBreak, deleteBreak,
      addHabit, updateHabit, deleteHabit, toggleHabitDone,
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
