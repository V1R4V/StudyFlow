import { useState } from 'react';
import { isOverdue, dayLabel, formatTime } from '../utils/reminders';
import { localDateString } from '../utils/sessions';
import { IconCheck, IconNote, IconList, IconRepeat } from './ReminderIcons';

const PRIORITY_MARK = { low: '!', medium: '!!', high: '!!!' };
const COMPLETE_DELAY_MS = 320;

function whenLabel(reminder, showDate, today) {
  if (reminder.done && reminder.completedAt) {
    return `Done ${dayLabel(localDateString(reminder.completedAt), today)}`;
  }
  if (!reminder.dueDate) return '';
  const time = formatTime(reminder.dueTime);
  if (!showDate) return time;
  return time ? `${dayLabel(reminder.dueDate, today)}, ${time}` : dayLabel(reminder.dueDate, today);
}

export default function ReminderRow({ reminder, subject, now, today, showDate = false, selected = false, compact = false, onToggle, onSelect }) {
  const [completing, setCompleting] = useState(false);
  const overdue = isOverdue(reminder, now);
  const checklistDone = reminder.checklist.filter(item => item.done).length;
  const when = whenLabel(reminder, showDate, today);
  const checked = reminder.done || completing;

  // Let the check animation play before the row leaves the list.
  function handleCheck() {
    if (reminder.done || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      onToggle(reminder.key);
      return;
    }
    setCompleting(true);
    window.setTimeout(() => {
      onToggle(reminder.key);
      setCompleting(false);
    }, COMPLETE_DELAY_MS);
  }

  return (
    <div className={`sf-rem-row${selected ? ' is-selected' : ''}${completing ? ' is-completing' : ''}${reminder.done ? ' is-done' : ''}${compact ? ' is-compact' : ''}`}>
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        aria-label={`Mark "${reminder.title}" as ${reminder.done ? 'not done' : 'done'}`}
        className={`sf-rem-check sf-rem-check-${reminder.priority}`}
        onClick={handleCheck}
        disabled={completing}
      >
        <IconCheck size={12} />
      </button>

      <button type="button" className="sf-rem-main" onClick={() => onSelect?.(reminder.key)} aria-current={selected || undefined}>
        <span className="sf-rem-title">
          {PRIORITY_MARK[reminder.priority] && (
            <span className={`sf-rem-prio sf-rem-prio-${reminder.priority}`} aria-label={`${reminder.priority} priority`}>
              {PRIORITY_MARK[reminder.priority]}
            </span>
          )}
          {reminder.title}
        </span>
        {(subject || reminder.note || reminder.checklist.length > 0 || reminder.repeat !== 'none') && (
          <span className="sf-rem-meta">
            {subject && (
              <span className="sf-rem-subject">
                <span className="sf-rem-dot" style={{ background: subject.color }} aria-hidden="true" />
                {subject.name}
              </span>
            )}
            {reminder.checklist.length > 0 && (
              <span className="sf-rem-meta-item" aria-label={`${checklistDone} of ${reminder.checklist.length} subtasks done`}>
                <IconList size={13} /> {checklistDone}/{reminder.checklist.length}
              </span>
            )}
            {reminder.note && <span className="sf-rem-meta-item" aria-label="Has a note"><IconNote size={13} /></span>}
            {reminder.repeat !== 'none' && (
              <span className="sf-rem-meta-item" aria-label={`Repeats ${reminder.repeat}`}><IconRepeat size={13} /></span>
            )}
          </span>
        )}
      </button>

      {when && <span className={`sf-rem-when${overdue ? ' is-overdue' : ''}`}>{when}</span>}
    </div>
  );
}
