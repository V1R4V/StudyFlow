import { useState } from 'react';
import { Dropdown } from 'react-bootstrap';
import { DateMenu, TimeMenu } from './ReminderPills';
import { isOverdue, dayLabel, formatTime } from '../utils/reminders';
import { localDateString } from '../utils/sessions';
import { IconCheck, IconList, IconRepeat, IconCalendar, IconClock, IconTrash } from './ReminderIcons';

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

// A hover action that opens one of the editor's own menus (date or time),
// so changing a reminder from the list works exactly like the editor.
function ActionMenu({ icon, label, children }) {
  const [show, setShow] = useState(false);
  return (
    <Dropdown show={show} onToggle={setShow} autoClose="outside" align="end" className={`sf-rem-row-action${show ? ' show' : ''}`}>
      <Dropdown.Toggle as="button" type="button" className="sf-rem-icon-action" aria-label={label} title={label}>
        {icon}
      </Dropdown.Toggle>
      <Dropdown.Menu className="sf-rem-menu">
        {show && children(() => setShow(false))}
      </Dropdown.Menu>
    </Dropdown>
  );
}

export default function ReminderRow({ reminder, subject, now, today, showDate = false, selected = false, compact = false, onToggle, onSelect, onSchedule, onDelete }) {
  const [completing, setCompleting] = useState(false);
  const overdue = isOverdue(reminder, now);
  const checklistDone = reminder.checklist.filter(item => item.done).length;
  const [whenDate, whenTime] = whenParts(reminder, showDate, today);
  const checked = reminder.done || completing;
  // First line of the note, shown under the title like a sub-note.
  const subnote = (reminder.note || '').split('\n').find(line => line.trim())?.trim();
  const editable = !reminder.done && !compact;

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
        {subnote && <span className="sf-rem-subnote">{subnote}</span>}
        {(subject || reminder.checklist.length > 0 || reminder.repeat !== 'none') && (
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
            {reminder.repeat !== 'none' && (
              <span className="sf-rem-meta-item" aria-label={`Repeats ${reminder.repeat}`}><IconRepeat size={13} /></span>
            )}
          </span>
        )}
      </button>

      <span className="sf-rem-row-end">
        {editable && onSchedule && (
          <>
            <ActionMenu icon={<IconCalendar size={15} />} label={`Change date of "${reminder.title}"`}>
              {close => <DateMenu value={reminder} close={close} onChange={changes => onSchedule(reminder.key, changes)} />}
            </ActionMenu>
            {reminder.dueDate && (
              <ActionMenu icon={<IconClock size={15} />} label={`Change time of "${reminder.title}"`}>
                {close => <TimeMenu value={reminder} close={close} onChange={changes => onSchedule(reminder.key, changes)} />}
              </ActionMenu>
            )}
          </>
        )}
        {editable && onDelete && (
          <span className="sf-rem-row-action">
            <button type="button" className="sf-rem-icon-action is-danger" onClick={() => onDelete(reminder.key)}
              aria-label={`Delete "${reminder.title}"`} title="Delete">
              <IconTrash size={15} />
            </button>
          </span>
        )}
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
