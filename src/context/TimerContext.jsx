import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useStudyData } from './StudyDataContext';
import { localDateString } from '../utils/sessions';

const TimerContext = createContext(null);

const POMODORO_SECONDS = 25 * 60;
const ORIGINAL_TITLE = 'StudyFlow';
const TIMER_STORAGE_KEY = 'studyflow-timer';
const SESSION_LIMITS = {
  NOTES_MAX: 500,
  MAX_SESSION_SECONDS: 24 * 60 * 60,
  SUBJECT_NAME_MAX: 60,
};

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

export function formatClock(totalSeconds, options = {}) {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  const pad = n => String(n).padStart(2, '0');
  const showHours = options.showHours || h > 0;
  if (showHours) return `${h}:${pad(m)}:${pad(s)}`;
  return `${pad(m)}:${pad(s)}`;
}

function readTimerFromStorage() {
  try {
    const raw = localStorage.getItem(TIMER_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function TimerProvider({ children }) {
  const { subjects, addSession, addBreak } = useStudyData();

  const storedTimer = readTimerFromStorage();
  const [mode, setMode] = useState(storedTimer?.mode ?? 'pomodoro');
  const [customH, setCustomH] = useState(storedTimer?.customH ?? 0);
  const [customM, setCustomM] = useState(storedTimer?.customM ?? 45);
  const [customS, setCustomS] = useState(storedTimer?.customS ?? 0);
  // Break mode keeps its own duration so switching between Custom and Break
  // doesn't clobber the user's custom study length. Breaks default to 5 min.
  const [breakH, setBreakH] = useState(storedTimer?.breakH ?? 0);
  const [breakM, setBreakM] = useState(storedTimer?.breakM ?? 5);
  const [breakS, setBreakS] = useState(storedTimer?.breakS ?? 0);
  const [targetSeconds, setTargetSeconds] = useState(
    storedTimer?.targetSeconds ?? POMODORO_SECONDS
  );
  const [secondsElapsed, setSecondsElapsed] = useState(storedTimer?.secondsElapsed ?? 0);
  const [isRunning, setIsRunning] = useState(storedTimer?.isRunning ?? false);
  const [subjectId, setSubjectId] = useState(storedTimer?.subjectId ?? '');
  const [startEpochMs, setStartEpochMs] = useState(storedTimer?.startEpochMs ?? null);
  const [error, setError] = useState('');
  const [pendingSession, setPendingSession] = useState(null);
  const [liveMessage, setLiveMessage] = useState('');
  // Distraction count for the in-flight session, increments via the "I got
  // distracted" button on the timer, resets after save/discard/reset.
  const [distractions, setDistractions] = useState(0);
  const autoEndedRef = useRef(false);
  const elapsedAtAutoEndRef = useRef(0);

  // Tick every second while running (wall-clock based to survive tab throttling).
  useEffect(() => {
    if (!isRunning || !startEpochMs) return;
    const tick = () => {
      const elapsed = Math.max(0, Math.floor((Date.now() - startEpochMs) / 1000));
      if (targetSeconds > 0 && elapsed >= targetSeconds) {
        autoEndedRef.current = true;
        elapsedAtAutoEndRef.current = targetSeconds;
        setIsRunning(false);
        setSecondsElapsed(targetSeconds);
        return;
      }
      setSecondsElapsed(elapsed);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [isRunning, startEpochMs, targetSeconds]);

  // Tab title reflects timer state.
  useEffect(() => {
    const display = targetSeconds > 0 ? targetSeconds - secondsElapsed : secondsElapsed;
    if (isRunning) {
      document.title = `${formatClock(display)} · StudyFlow`;
    } else if (pendingSession) {
      document.title = `✓ Save session · StudyFlow`;
    } else if (secondsElapsed > 0) {
      document.title = `${formatClock(display)} (paused) · StudyFlow`;
    } else {
      document.title = ORIGINAL_TITLE;
    }
    return () => { document.title = ORIGINAL_TITLE; };
  }, [isRunning, secondsElapsed, targetSeconds, pendingSession]);

  useEffect(() => {
    if (isRunning && !startEpochMs) {
      setStartEpochMs(Date.now() - secondsElapsed * 1000);
    }
  }, [isRunning, startEpochMs, secondsElapsed]);

  // Persist timer state across reloads.
  useEffect(() => {
    const payload = {
      mode, customH, customM, customS,
      breakH, breakM, breakS,
      targetSeconds, secondsElapsed, isRunning,
      subjectId, startEpochMs,
    };
    try {
      localStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify(payload));
    } catch { /* noop */ }
  }, [mode, customH, customM, customS, breakH, breakM, breakS, targetSeconds, secondsElapsed, isRunning, subjectId, startEpochMs]);

  useEffect(() => {
    if (autoEndedRef.current && !isRunning && secondsElapsed === elapsedAtAutoEndRef.current) {
      autoEndedRef.current = false;
      if (mode === 'break') {
        setLiveMessage('Break complete.');
        saveBreak(elapsedAtAutoEndRef.current);
      } else {
        setLiveMessage('Session complete.');
        promptSave(elapsedAtAutoEndRef.current);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning, secondsElapsed]);

  function customTotalSeconds(h, m, s) {
    return Math.max(1, (h | 0) * 3600 + (m | 0) * 60 + (s | 0));
  }

  function setCustomTime(h, m, s) {
    setCustomH(h);
    setCustomM(m);
    setCustomS(s);
    if (mode === 'custom' && !isRunning && secondsElapsed === 0) {
      setTargetSeconds(customTotalSeconds(h, m, s));
    }
  }

  function setBreakTime(h, m, s) {
    setBreakH(h);
    setBreakM(m);
    setBreakS(s);
    if (mode === 'break' && !isRunning && secondsElapsed === 0) {
      setTargetSeconds(customTotalSeconds(h, m, s));
    }
  }

  function applyMode(nextMode) {
    if (isRunning || secondsElapsed > 0) {
      if (!window.confirm('Switching modes will reset the current timer. Continue?')) return;
    }
    setMode(nextMode);
    setIsRunning(false);
    setSecondsElapsed(0);
    setStartEpochMs(null);
    setError('');
    autoEndedRef.current = false;
    if (nextMode === 'pomodoro') setTargetSeconds(POMODORO_SECONDS);
    else if (nextMode === 'stopwatch') setTargetSeconds(0);
    else if (nextMode === 'break') setTargetSeconds(customTotalSeconds(breakH, breakM, breakS));
    else setTargetSeconds(customTotalSeconds(customH, customM, customS));
  }

  function start() {
    // Breaks aren't attached to a subject; only study modes require one.
    if (mode !== 'break' && !subjectId) {
      if (subjects.length > 0) {
        setSubjectId(String(subjects[0].id));
      } else {
        setError('Add a subject first.');
        return;
      }
    }
    setError('');
    setStartEpochMs(Date.now() - secondsElapsed * 1000);
    setIsRunning(true);
  }

  function pause() {
    if (isRunning && startEpochMs) {
      const elapsed = Math.max(0, Math.floor((Date.now() - startEpochMs) / 1000));
      setSecondsElapsed(elapsed);
    }
    setIsRunning(false);
  }

  function reset() {
    setIsRunning(false);
    setSecondsElapsed(0);
    setStartEpochMs(null);
    setLiveMessage('');
    setDistractions(0);
    autoEndedRef.current = false;
  }

  function logDistraction() {
    setDistractions(d => d + 1);
    setLiveMessage('Distraction logged.');
  }

  function promptSave(elapsedSeconds) {
    const minutes = Math.ceil(elapsedSeconds / 60);
    if (minutes <= 0) {
      setError('Start the timer first.');
      return;
    }
    const subject = subjects.find(s => String(s.id) === String(subjectId));
    if (!subject) {
      setError('Pick a subject first.');
      return;
    }
    setPendingSession({
      minutes,
      seconds: elapsedSeconds,
      subjectId: subject.id,
      subjectName: subject.name,
      subjectColor: subject.color,
      distractions,
    });
    setIsRunning(false);
  }

  function endSession() {
    if (mode === 'break') {
      const elapsed =
        isRunning && startEpochMs
          ? Math.max(0, Math.floor((Date.now() - startEpochMs) / 1000))
          : secondsElapsed;
      saveBreak(elapsed);
      return;
    }
    promptSave(secondsElapsed);
  }

  // Breaks are logged to their own store and never roll into focus/session
  // minutes. No subject, no focus rating, no save modal — just record and reset.
  function saveBreak(elapsedSeconds) {
    const seconds = Math.max(0, Math.floor(elapsedSeconds));
    setIsRunning(false);
    setSecondsElapsed(0);
    setStartEpochMs(null);
    autoEndedRef.current = false;
    if (seconds < 5) {
      setLiveMessage('Break too short to log.');
      return;
    }
    addBreak({
      durationSeconds: seconds,
      duration: Math.max(1, Math.ceil(seconds / 60)),
      type: 'custom',
      date: localDateString(),
    });
    setLiveMessage('Break logged.');
  }

  function saveSession(details) {
    if (!pendingSession) return;
    const trackedSeconds = clampNumber(
      pendingSession.seconds,
      1,
      SESSION_LIMITS.MAX_SESSION_SECONDS,
      60
    );
    // EndSessionModal passes durationSeconds only when the user edited the
    // "real time spent" inputs. Otherwise we keep the timer's tracked value
    // (which has second-level precision).
    const safeSeconds =
      typeof details.durationSeconds === 'number'
        ? clampNumber(
            details.durationSeconds,
            1,
            SESSION_LIMITS.MAX_SESSION_SECONDS,
            trackedSeconds
          )
        : trackedSeconds;
    const safeRating = clampNumber(details.focusRating, 1, 5, 4);
    const safeNotes = trimString(details.notes, SESSION_LIMITS.NOTES_MAX);
    const safeSubjectName =
      trimString(pendingSession.subjectName, SESSION_LIMITS.SUBJECT_NAME_MAX) ||
      pendingSession.subjectName;
    const safeDistractions = Math.max(0, Math.floor(
      typeof details.distractions === 'number'
        ? details.distractions
        : pendingSession.distractions || 0
    ));
    const newSession = {
      id: Date.now(),
      subjectId: pendingSession.subjectId,
      subjectName: safeSubjectName,
      subjectColor: pendingSession.subjectColor,
      duration: Math.max(1, Math.ceil(safeSeconds / 60)),
      durationSeconds: safeSeconds,
      focusRating: safeRating,
      notes: safeNotes,
      distractions: safeDistractions,
      date: localDateString(),
    };

    // Single write path. The StudyDataContext routes this to Firestore (when
    // signed in) or localStorage (when guest) and refreshes state for all pages.
    addSession(pendingSession.subjectId, newSession);

    setPendingSession(null);
    setSecondsElapsed(0);
    setDistractions(0);
  }

  function discardSession() {
    setPendingSession(null);
    setSecondsElapsed(0);
    setStartEpochMs(null);
    setDistractions(0);
  }

  const value = {
    mode, applyMode,
    customH, customM, customS, setCustomTime,
    breakH, breakM, breakS, setBreakTime,
    targetSeconds, secondsElapsed, isRunning,
    subjectId, setSubjectId,
    error,
    pendingSession,
    liveMessage,
    distractions, logDistraction,
    start, pause, reset, endSession,
    saveSession, discardSession,
  };

  return <TimerContext.Provider value={value}>{children}</TimerContext.Provider>;
}

export function useTimer() {
  const ctx = useContext(TimerContext);
  if (!ctx) throw new Error('useTimer must be used inside <TimerProvider>');
  return ctx;
}
