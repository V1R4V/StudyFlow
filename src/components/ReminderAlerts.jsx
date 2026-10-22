import { useEffect, useState } from 'react';
import { Toast, ToastContainer, Button } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { useReminders } from '../context/RemindersContext';
import { nextAlertAt, formatTime, ALL_DAY_ALERT_TIME } from '../utils/reminders';
import { localDateString, shiftDateStr } from '../utils/sessions';
import { IconBell } from './ReminderIcons';

// Alerts only run while a StudyFlow tab is open. Each alert is identified by
// `key@time`, so a snooze (new time) produces a new alert. Both lists live in
// localStorage so a reload neither re-sends a system notification nor
// re-shows a toast that was already dismissed.
const FIRED_KEY = 'studyflow-reminder-fired';
const DISMISSED_KEY = 'studyflow-reminder-dismissed';
const STORED_IDS_MAX = 300;
// System notifications go out for alerts at most 15 min old (e.g. the app was
// just opened); the in-app toast stays available for 2 hours.
const NOTIFY_WINDOW_MS = 15 * 60 * 1000;
const TOAST_WINDOW_MS = 2 * 60 * 60 * 1000;
const MAX_TIMER_MS = 60 * 60 * 1000;

function readIds(storageKey) {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeIds(storageKey, ids) {
  const trimmed = ids.slice(-STORED_IDS_MAX);
  localStorage.setItem(storageKey, JSON.stringify(trimmed));
  return trimmed;
}

const alertId = reminder => `${reminder.key}@${nextAlertAt(reminder)}`;

function tomorrowMorning() {
  return new Date(`${shiftDateStr(localDateString(), 1)}T${ALL_DAY_ALERT_TIME}:00`).getTime();
}

export default function ReminderAlerts() {
  const { reminders, toggleDone, snooze, undo, clearUndo } = useReminders();
  const navigate = useNavigate();
  const [tick, setTick] = useState(Date.now);
  const [dismissed, setDismissed] = useState(() => readIds(DISMISSED_KEY));

  // Wake up exactly when the next alert is due (capped, so a sleeping laptop
  // re-checks soon after waking), and whenever the tab becomes visible.
  useEffect(() => {
    const t = Date.now();
    const upcoming = reminders.map(nextAlertAt).filter(at => at && at > t);
    if (upcoming.length === 0) return undefined;
    const delay = Math.min(Math.min(...upcoming) - t + 250, MAX_TIMER_MS);
    const id = window.setTimeout(() => setTick(Date.now()), delay);
    return () => window.clearTimeout(id);
  }, [reminders, tick]);

  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === 'visible') setTick(Date.now());
    }
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  // Toasts are derived: any reminder whose alert time has passed recently and
  // that hasn't been dismissed. Completing or snoozing removes it naturally.
  const alerts = reminders.filter(r => {
    const at = nextAlertAt(r);
    return at && at <= tick && tick - at < TOAST_WINDOW_MS && !dismissed.includes(alertId(r));
  });

  // System notifications: only when the tab is in the background, once per alert.
  useEffect(() => {
    const fired = readIds(FIRED_KEY);
    const due = reminders.filter(r => {
      const at = nextAlertAt(r);
      return at && at <= tick && tick - at < NOTIFY_WINDOW_MS && !fired.includes(alertId(r));
    });
    if (due.length === 0) return;

    writeIds(FIRED_KEY, [...fired, ...due.map(alertId)]);
    if (document.visibilityState === 'hidden' && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      due.forEach(r => {
        const notification = new Notification(r.title, {
          body: r.dueTime ? `Due ${formatTime(r.dueTime)}` : 'Due today',
          tag: r.key,
        });
        notification.onclick = () => {
          window.focus();
          navigate(`/app/reminders?r=${encodeURIComponent(r.key)}`);
          notification.close();
        };
      });
    }
  }, [reminders, tick, navigate]);

  function dismiss(reminder) {
    setDismissed(prev => writeIds(DISMISSED_KEY, [...prev, alertId(reminder)]));
  }

  function act(reminder, action) {
    dismiss(reminder);
    action();
  }

  return (
    <ToastContainer position="bottom-end" className="p-3 sf-rem-toasts" containerPosition="fixed">
      {alerts.map(r => (
        <Toast key={r.key} onClose={() => dismiss(r)} className="sf-rem-toast">
          <Toast.Header closeLabel="Dismiss">
            <span className="sf-rem-toast-icon"><IconBell size={14} /></span>
            <strong className="me-auto">Reminder</strong>
            <small>{r.dueTime ? formatTime(r.dueTime) : 'Today'}</small>
          </Toast.Header>
          <Toast.Body>
            <button type="button" className="sf-rem-toast-title"
              onClick={() => act(r, () => navigate(`/app/reminders?r=${encodeURIComponent(r.key)}`))}>
              {r.title}
            </button>
            <div className="sf-rem-toast-actions">
              <Button size="sm" variant="primary" onClick={() => act(r, () => toggleDone(r.key))}>Done</Button>
              <Button size="sm" variant="outline-secondary" onClick={() => act(r, () => snooze(r.key, Date.now() + 10 * 60 * 1000))}>10 min</Button>
              <Button size="sm" variant="outline-secondary" onClick={() => act(r, () => snooze(r.key, Date.now() + 60 * 60 * 1000))}>1 hour</Button>
              <Button size="sm" variant="outline-secondary" onClick={() => act(r, () => snooze(r.key, tomorrowMorning()))}>Tomorrow</Button>
            </div>
          </Toast.Body>
        </Toast>
      ))}

      {undo && (
        <Toast key={undo.id} onClose={clearUndo} autohide delay={5000} className="sf-rem-toast sf-rem-undo">
          <Toast.Body className="d-flex align-items-center gap-3">
            <span className="flex-grow-1 min-w-0">
              <strong className="d-block">{undo.message}</strong>
              <span className="small text-muted text-truncate d-block">{undo.title}</span>
            </span>
            <Button size="sm" variant="outline-primary" onClick={() => { undo.revert(); clearUndo(); }}>Undo</Button>
          </Toast.Body>
        </Toast>
      )}
    </ToastContainer>
  );
}
