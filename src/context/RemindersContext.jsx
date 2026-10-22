import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuthContext } from './AuthContext';
import {
  createReminderId,
  subscribeActiveReminders,
  getCompletedReminders,
  saveReminder,
  deleteReminder as fsDeleteReminder,
  normalizeReminder,
  readGuestReminders,
  writeGuestReminders,
} from '../services/firebaseService';
import { advanceRepeat, dayLabel } from '../utils/reminders';
import { localDateString } from '../utils/sessions';

// Signed-in: active reminders come from a live Firestore listener, completed
// ones are fetched a page at a time on demand. Guest: everything lives in one
// localStorage array. Either way, consumers see `reminders` (active) and
// `completed`, each item carrying a stable `key`.

const Context = createContext(null);
const NOW_TICK_MS = 30 * 1000;

const withKey = reminder => ({ ...reminder, key: reminder.firestoreId || String(reminder.id) });
const emptyCompleted = uid => ({ uid, items: [], cursor: null, loaded: false, loading: false, hasMore: false });

export function RemindersProvider({ children }) {
  const { user, loading: authLoading } = useAuthContext();
  // Signed-in lists are tagged with the uid they were loaded for, so a
  // sign-out/sign-in never shows the previous account's reminders and no
  // reset effect is needed.
  const [activeStore, setActiveStore] = useState({ uid: null, items: [] });
  const [completedStore, setCompletedStore] = useState(() => emptyCompleted(null));
  const [guestAll, setGuestAll] = useState(readGuestReminders);
  const [prevUser, setPrevUser] = useState(user);
  // One toast at a time: { id, message, title, actionLabel, action }.
  const [notice, setNotice] = useState(null);
  const [now, setNow] = useState(Date.now);

  // Overdue/today boundaries move with the clock, so consumers re-derive
  // from `now` instead of each running their own interval.
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), NOW_TICK_MS);
    return () => window.clearInterval(id);
  }, []);

  // Back in guest mode after signing out: re-read whatever guest data is
  // left (sign-out clears it). Adjusting state during render is React's
  // recommended alternative to a reset effect.
  if (prevUser !== user) {
    setPrevUser(user);
    if (!user) setGuestAll(readGuestReminders());
  }

  useEffect(() => {
    if (authLoading || !user) return undefined;
    const uid = user.uid;
    return subscribeActiveReminders(
      uid,
      items => setActiveStore({ uid, items: items.map(withKey) }),
      () => setActiveStore({ uid, items: [] }),
    );
  }, [user, authLoading]);

  const uid = user?.uid ?? null;
  const loading = authLoading || (uid !== null && activeStore.uid !== uid);
  const completedState = completedStore.uid === uid ? completedStore : emptyCompleted(uid);

  const reminders = useMemo(
    () => (uid ? (activeStore.uid === uid ? activeStore.items : []) : guestAll.filter(r => !r.done).map(withKey)),
    [uid, activeStore, guestAll],
  );
  const completedList = useMemo(
    () => (uid ? completedState.items : guestAll.filter(r => r.done).map(withKey)),
    [uid, completedState.items, guestAll],
  );

  function patchCompleted(updater) {
    setCompletedStore(prev => {
      const base = prev.uid === uid ? prev : emptyCompleted(uid);
      return { ...base, ...updater(base) };
    });
  }

  const findByKey = useCallback(
    key => reminders.find(r => r.key === key) || completedList.find(r => r.key === key) || null,
    [reminders, completedList],
  );

  function writeGuest(updater) {
    setGuestAll(prev => {
      const next = updater(prev);
      writeGuestReminders(next);
      return next;
    });
  }

  // Single write path. The Firestore listener reflects local writes
  // immediately (latency compensation), so the active list needs no manual
  // optimistic update. Completed reminders aren't in that listener, so the
  // paged list is patched by hand.
  async function persist(key, next) {
    const safe = normalizeReminder(next);
    if (!safe) return false;

    if (!user) {
      writeGuest(prev => {
        const exists = prev.some(r => String(r.id) === String(safe.id));
        return exists ? prev.map(r => (String(r.id) === String(safe.id) ? safe : r)) : [...prev, safe];
      });
      return true;
    }

    const stored = withKey({ ...safe, firestoreId: key });
    patchCompleted(prev => {
      const rest = prev.items.filter(r => r.key !== key);
      return { items: stored.done ? [stored, ...rest] : rest };
    });
    return saveReminder(user.uid, key, safe);
  }

  async function addReminder(fields) {
    const id = Date.now();
    const key = user ? createReminderId(user.uid) : String(id);
    const draft = {
      id, title: '', note: '', dueDate: null, dueTime: null, subjectId: null,
      priority: 'none', repeat: 'none', checklist: [], done: false, createdAt: id, ...fields,
    };
    const ok = await persist(key, draft);
    return ok ? key : null;
  }

  async function updateReminder(key, updates) {
    const current = findByKey(key);
    if (!current) return false;
    const { key: _key, firestoreId: _fsId, ...rest } = current;
    return persist(key, { ...rest, ...updates });
  }

  async function toggleDone(key) {
    const current = findByKey(key);
    if (!current) return;
    const { key: _key, firestoreId: _fsId, ...previous } = current;
    let updates;
    let message;

    if (current.done) {
      updates = { done: false, completedAt: null };
      message = 'Marked as not done';
    } else if (current.repeat !== 'none' && current.dueDate) {
      const nextDate = advanceRepeat(current.dueDate, current.repeat, localDateString());
      updates = {
        dueDate: nextDate,
        snoozedUntil: null,
        checklist: current.checklist.map(item => ({ ...item, done: false })),
      };
      message = `Next: ${dayLabel(nextDate)}`;
    } else {
      updates = { done: true, completedAt: Date.now(), snoozedUntil: null };
      message = 'Completed';
    }

    await persist(key, { ...previous, ...updates });
    setNotice({ id: Date.now(), message, title: current.title, actionLabel: 'Undo', action: () => persist(key, previous) });
  }

  async function removeReminder(key) {
    const current = findByKey(key);
    if (!current) return;
    const { key: _key, firestoreId: _fsId, ...previous } = current;

    if (!user) {
      writeGuest(prev => prev.filter(r => String(r.id) !== String(current.id)));
    } else {
      patchCompleted(prev => ({ items: prev.items.filter(r => r.key !== key) }));
      await fsDeleteReminder(user.uid, key);
    }
    setNotice({ id: Date.now(), message: 'Deleted', title: current.title, actionLabel: 'Undo', action: () => persist(key, previous) });
  }

  function snooze(key, untilMs) {
    return updateReminder(key, { snoozedUntil: untilMs });
  }

  // Guest mode already holds completed reminders in memory, so it has
  // nothing to page through.
  async function loadCompleted({ reset = false } = {}) {
    if (!uid || completedState.loading) return;
    patchCompleted(() => ({ loading: true }));
    const page = await getCompletedReminders(uid, reset ? null : completedState.cursor);
    patchCompleted(prev => {
      const base = reset ? [] : prev.items;
      const seen = new Set(base.map(r => r.key));
      return {
        items: [...base, ...page.items.map(withKey).filter(r => !seen.has(r.key))],
        cursor: page.cursor, loaded: true, loading: false, hasMore: page.hasMore,
      };
    });
  }

  return (
    <Context.Provider value={{
      reminders, completed: completedList, loading, now,
      completedLoaded: !uid || completedState.loaded,
      completedLoading: completedState.loading,
      hasMoreCompleted: completedState.hasMore,
      addReminder, updateReminder, toggleDone, removeReminder, snooze, loadCompleted,
      notice, notify: next => setNotice({ id: Date.now(), ...next }), clearNotice: () => setNotice(null),
    }}>
      {children}
    </Context.Provider>
  );
}

export function useReminders() {
  const ctx = useContext(Context);
  if (!ctx) throw new Error('useReminders must be used inside <RemindersProvider>');
  return ctx;
}
