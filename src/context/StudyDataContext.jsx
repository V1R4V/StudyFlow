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
  addBreak as fsAddBreak,
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
const PLAN_ENTRIES_KEY = 'studyflow-plan-entries';
const PLAN_PENDING_KEY = 'studyflow-plan-pending-writes';
let planSyncInFlight = false;

// Habit/todo/break insight surfaces are archived until v3. Their old
// components/services remain in the repo, but the active app intentionally
// skips those collection reads.

function readGuestSubjects() {
  try {
    const raw = localStorage.getItem(SUBJECTS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function readGuestSessions() {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function readGuestPlanEntries() {
  try {
    const raw = localStorage.getItem(PLAN_ENTRIES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function readPendingPlanWrites() {
  try {
    const raw = localStorage.getItem(PLAN_PENDING_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writePendingPlanWrites(writes) {
  localStorage.setItem(PLAN_PENDING_KEY, JSON.stringify(Array.isArray(writes) ? writes : []));
}

function planWriteKey(subjectId, scope, day, date) {
  const safeScope = scope === 'once' ? 'once' : 'weekly';
  return `${safeScope}:${String(subjectId)}:${safeScope === 'weekly' ? day : date}`;
}

function planEntryWriteKey(entry) {
  return planWriteKey(entry.subjectId, entry.scope, entry.day, entry.date);
}

function queuePendingPlanWrite(write) {
  const key = write.key || planEntryWriteKey(write.entry || write);
  const pending = readPendingPlanWrites().filter(item => item.key !== key);

  if (write.op === 'delete' && !write.firestoreId) {
    writePendingPlanWrites(pending);
    return;
  }

  writePendingPlanWrites([
    ...pending,
    { ...write, key, createdAt: write.createdAt || Date.now() },
  ]);
}

function removePendingPlanWrite(key) {
  writePendingPlanWrites(readPendingPlanWrites().filter(item => item.key !== key));
}

function applyPendingPlanWrites(entries, writes) {
  let next = Array.isArray(entries) ? [...entries] : [];
  (Array.isArray(writes) ? writes : []).forEach(write => {
    const key = write.key || (write.entry ? planEntryWriteKey(write.entry) : null);
    if (!key) return;

    if (write.op === 'delete') {
      next = next.filter(entry => planEntryWriteKey(entry) !== key);
      return;
    }

    if (write.op === 'upsert' && write.entry) {
      const index = next.findIndex(entry => planEntryWriteKey(entry) === key);
      if (index === -1) next.push(write.entry);
      else next[index] = { ...next[index], ...write.entry };
    }
  });
  return next;
}

export function StudyDataProvider({ children }) {
  const { user, loading: authLoading } = useAuthContext();

  // Hydrate immediately from the cache so the UI doesn't flash empty.
  const [subjects, setSubjects] = useState(readGuestSubjects);
  const [sessions, setSessions] = useState(readGuestSessions);
  const [planEntries, setPlanEntries] = useState(readGuestPlanEntries);
  const [loading, setLoading] = useState(true);
  const safePlanEntries = Array.isArray(planEntries) ? planEntries : [];

  const refresh = useCallback(async () => {
    if (user) {
      const [fsSubjects, fsSessions, fsPlan] = await Promise.all([
        getSubjects(user.uid),
        getAllSessions(user.uid),
        getAllPlanEntries(user.uid),
      ]);
      setSubjects(fsSubjects);
      setSessions(fsSessions);
      const cachedPlan = readGuestPlanEntries();
      let pendingPlanWrites = readPendingPlanWrites();

      if (Array.isArray(fsPlan)) {
        const localOnly = cachedPlan.filter(entry => {
          const key = planEntryWriteKey(entry);
          return (
            !entry.firestoreId &&
            !fsPlan.some(serverEntry => planEntryWriteKey(serverEntry) === key) &&
            !pendingPlanWrites.some(write => write.key === key)
          );
        });

        if (localOnly.length > 0) {
          pendingPlanWrites = [
            ...pendingPlanWrites,
            ...localOnly.map(entry => ({
              op: 'upsert',
              key: planEntryWriteKey(entry),
              entry,
              createdAt: Date.now(),
            })),
          ];
          writePendingPlanWrites(pendingPlanWrites);
        }
      }

      const nextPlan = Array.isArray(fsPlan)
        ? applyPendingPlanWrites(fsPlan, pendingPlanWrites)
        : applyPendingPlanWrites(cachedPlan, pendingPlanWrites);

      setPlanEntries(nextPlan);
      localStorage.setItem(PLAN_ENTRIES_KEY, JSON.stringify(nextPlan));
      localStorage.setItem(SUBJECTS_KEY, JSON.stringify(fsSubjects));
      localStorage.setItem(SESSIONS_KEY, JSON.stringify(fsSessions));
      if (pendingPlanWrites.length > 0) {
        await flushPendingPlanWrites(user.uid);
      }
    } else {
      setSubjects(readGuestSubjects());
      setSessions(readGuestSessions());
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
    if (!authLoading) {
      localStorage.setItem(PLAN_ENTRIES_KEY, JSON.stringify(safePlanEntries));
    }
  }, [safePlanEntries, user, authLoading]);

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

  // ---------- Breaks ----------
  // Breaks live in their own collection and never count toward study minutes.
  // Break insights are archived, so break saves do not trigger a full refresh.

  async function addBreak(breakData) {
    if (user) {
      await fsAddBreak(user.uid, breakData);
    } else {
      // Archived surface: keep break logging non-blocking in guest mode.
      let prev = [];
      try {
        const raw = localStorage.getItem('studyflow-breaks');
        prev = raw ? JSON.parse(raw) : [];
      } catch {
        prev = [];
      }
      localStorage.setItem('studyflow-breaks', JSON.stringify([{ ...breakData, id: Date.now() }, ...prev]));
    }
  }

  // ---------- Plan entries ----------
  // Weekly planner cells share one write path. Hours > 0 creates/updates a
  // cell; hours <= 0 clears it.

  function planKeyMatch(entry, subjectId, scope, day, date) {
    return (
      String(entry.subjectId) === String(subjectId) &&
      entry.scope === scope &&
      (scope === 'weekly' ? entry.day === day : entry.date === date)
    );
  }

  async function flushPendingPlanWrites(userId) {
    const pending = readPendingPlanWrites();
    if (!userId || pending.length === 0 || planSyncInFlight) return;

    planSyncInFlight = true;

    try {
      const remaining = [];
      const synced = [];

      for (const write of pending) {
        if (write.op === 'delete') {
          if (!write.firestoreId) continue;
          const ok = await fsDeletePlanEntry(userId, write.firestoreId);
          if (!ok) remaining.push(write);
          continue;
        }

        if (write.op !== 'upsert' || !write.entry) continue;

        const firestoreId = write.firestoreId || write.entry.firestoreId;
        if (firestoreId) {
          const ok = await fsUpdatePlanEntry(userId, firestoreId, { hours: write.entry.hours });
          if (ok) synced.push({ ...write.entry, firestoreId });
          else remaining.push(write);
          continue;
        }

        const saved = await fsAddPlanEntry(userId, write.entry);
        if (saved) synced.push(saved);
        else remaining.push(write);
      }

      writePendingPlanWrites(remaining);

      if (synced.length > 0) {
        setPlanEntries(prev => {
          const base = Array.isArray(prev) ? prev : [];
          return base.map(entry => {
            const saved = synced.find(item => planEntryWriteKey(item) === planEntryWriteKey(entry));
            return saved ? { ...entry, ...saved } : entry;
          });
        });
      }
    } finally {
      planSyncInFlight = false;
    }
  }

  useEffect(() => {
    if (!user || authLoading) return;

    function retryPlanSync() {
      if (readPendingPlanWrites().length > 0) {
        flushPendingPlanWrites(user.uid);
      }
    }

    window.addEventListener('online', retryPlanSync);
    const intervalId = window.setInterval(retryPlanSync, 30000);
    retryPlanSync();

    return () => {
      window.removeEventListener('online', retryPlanSync);
      window.clearInterval(intervalId);
    };
  }, [user, authLoading]);

  async function upsertPlanEntry(subjectId, { scope, day = null, date = null, hours }) {
    const safeScope = scope === 'once' ? 'once' : 'weekly';
    const key = {
      day: safeScope === 'weekly' ? day : null,
      date: safeScope === 'once' ? date : null,
    };
    const h = Math.max(0, Number(hours) || 0);
    const existing = safePlanEntries.find(entry =>
      planKeyMatch(entry, subjectId, safeScope, key.day, key.date)
    );
    const localEntry = existing
      ? { ...existing, subjectId: String(subjectId), scope: safeScope, ...key, hours: h }
      : {
          id: Date.now() + Math.floor(Math.random() * 1000),
          subjectId: String(subjectId),
          scope: safeScope,
          ...key,
          hours: h,
        };

    if (h <= 0) {
      setPlanEntries(prev => {
        const base = Array.isArray(prev) ? prev : [];
        return base.filter(entry =>
          !planKeyMatch(entry, subjectId, safeScope, key.day, key.date)
        );
      });

      if (user && existing?.firestoreId) {
        const ok = await fsDeletePlanEntry(user.uid, existing.firestoreId);
        if (!ok) {
          queuePendingPlanWrite({
            op: 'delete',
            key: planWriteKey(subjectId, safeScope, key.day, key.date),
            firestoreId: existing.firestoreId,
          });
        } else {
          removePendingPlanWrite(planWriteKey(subjectId, safeScope, key.day, key.date));
        }
      } else if (user) {
        removePendingPlanWrite(planWriteKey(subjectId, safeScope, key.day, key.date));
      }
      return;
    }

    setPlanEntries(prev => {
      const base = Array.isArray(prev) ? prev : [];
      const index = base.findIndex(entry =>
        planKeyMatch(entry, subjectId, safeScope, key.day, key.date)
      );
      if (index === -1) return [...base, localEntry];
      return base.map((entry, entryIndex) =>
        entryIndex === index ? { ...entry, ...localEntry } : entry
      );
    });

    if (!user) return;

    if (existing?.firestoreId) {
      const ok = await fsUpdatePlanEntry(user.uid, existing.firestoreId, { hours: h });
      if (!ok) {
        queuePendingPlanWrite({
          op: 'upsert',
          key: planWriteKey(subjectId, safeScope, key.day, key.date),
          entry: localEntry,
          firestoreId: existing.firestoreId,
        });
      } else {
        removePendingPlanWrite(planWriteKey(subjectId, safeScope, key.day, key.date));
      }
      return;
    }

    const saved = await fsAddPlanEntry(user.uid, localEntry);
    if (saved) {
      removePendingPlanWrite(planWriteKey(subjectId, safeScope, key.day, key.date));
      setPlanEntries(prev => {
        const base = Array.isArray(prev) ? prev : [];
        return base.map(entry =>
          planKeyMatch(entry, subjectId, safeScope, key.day, key.date)
            ? { ...entry, ...saved }
            : entry
        );
      });
    } else {
      queuePendingPlanWrite({
        op: 'upsert',
        key: planWriteKey(subjectId, safeScope, key.day, key.date),
        entry: localEntry,
      });
    }
  }

  return (
    <Context.Provider value={{
      subjects, sessions, planEntries: safePlanEntries, loading,
      addSubject, updateSubject, deleteSubject,
      addSession, updateSession, deleteSession,
      addBreak,
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
