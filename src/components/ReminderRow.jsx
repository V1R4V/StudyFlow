import { useState } from 'react';
import { Dropdown } from 'react-bootstrap';
import { isOverdue, dayLabel, formatTime, nextMonday } from '../utils/reminders';
import { localDateString, shiftDateStr } from '../utils/sessions';
import { IconCheck, IconNote, IconList, IconRepeat, IconCalendar } from './ReminderIcons';

const PRIORITY_MARK = { low: '!', medium: '!!', high: '!!!' };
const COMPLETE_DELAY_MS = 320;

// Returns [datePart, timePart]; either may be empty. Kept separate so a
// narrow row wraps between them, never inside "9:00 PM".
function whenParts(reminder, showDate, today) {
  if (reminder.done && reminder.completedAt) {
    return [`Done ${dayLabel(localDateString(reminder.completedAt), today)}`, ''];
  }
  if (!reminder.dueDate) return ['', ''];
  const time = formatTime(reminder.dueTime);
  return showDate ? [`${dayLabel(reminder.dueDate, today)}${time ? ',' : ''}`, time] : ['', time];
}

// Hover action: move a reminder without opening it.
function RescheduleMenu({ reminder, today, onReschedule }) {
  const options = [
    { label: 'Today', date: today },
    { label: 'Tomorrow', date: shiftDateStr(today, 1) },
    { label: 'Next week', date: nextMonday(today) },
    { label: 'No date', date: null },
  ];
  return (
    <Dropdown align="end" className="sf-rem-row-action">
      <Dropdown.Toggle as="button" type="button" className="sf-rem-icon-action" aria-label={`Reschedule "${reminder.title}"`} title="Reschedule">
        <IconCalendar size={15} />
      </Dropdown.Toggle>
      <Dropdown.Menu className="sf-rem-menu">
        {options.map(option => (
          <Dropdown.Item key={option.label} as="button" type="button" className="sf-rem-option"
            onClick={() => onReschedule(reminder.key, option.date)}>
            <span className="sf-rem-option-label">{option.label}</span>
            {option.date && <span className="sf-rem-option-hint">{new Date(`${option.date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short' })}</span>}
          </Dropdown.Item>
        ))}
      </Dropdown.Menu>
    </Dropdown>
  );
}

export default function ReminderRow({ reminder, subject, now, today, showDate = false, selected = false, compact = false, onToggle, onSelect, onReschedule }) {
  const [completing, setCompleting] = useState(false);
  const overdue = isOverdue(reminder, now);
  const checklistDone = reminder.checklist.filter(item => item.done).length;
  const [whenDate, whenTime] = whenParts(reminder, showDate, today);
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

      <span className="sf-rem-row-end">
        {onReschedule && !reminder.done && <RescheduleMenu reminder={reminder} today={today} onReschedule={onReschedule} />}
        {(whenDate || whenTime) && (
          <span className={`sf-rem-when${overdue ? ' is-overdue' : ''}`}>
            {whenDate && <span className="text-nowrap">{whenDate}</span>}
            {whenDate && whenTime && ' '}
            {whenTime && <span className="text-nowrap">{whenTime}</span>}
          </span>
        )}
      </span>
    </div>
  );
}
