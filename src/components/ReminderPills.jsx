import { useRef, useState } from 'react';
import { Dropdown } from 'react-bootstrap';
import { dayLabel, formatTime, subjectRefId, subjectForReminder, nextMonday, PRIORITY_OPTIONS } from '../utils/reminders';
import { parseDatePhrase } from '../utils/reminderParse';
import { localDateString, shiftDateStr } from '../utils/sessions';
import { IconCalendar, IconClock, IconRepeat, IconClose, IconCheck } from './ReminderIcons';

const REPEAT_OPTIONS = [
  { value: 'daily', label: 'Every day' },
  { value: 'weekdays', label: 'Every weekday' },
  { value: 'weekly', label: 'Every week' },
  { value: 'monthly', label: 'Every month' },
  { value: 'none', label: "Doesn't repeat" },
];
const TIME_PRESETS = ['09:00', '12:00', '15:00', '18:00', '21:00'];

const weekdayShort = date => new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short' });

function openPicker(input) {
  if (!input) return;
  if (typeof input.showPicker === 'function') input.showPicker();
  else input.focus();
}

// A property pill: ghost when unset, filled with an × to clear when set.
// The menu stays open while typing in it and closes once an option is picked.
function Pill({ icon, label, isSet, ariaLabel, onClear, children, menuClassName = '' }) {
  const [show, setShow] = useState(false);
  const close = () => setShow(false);
  return (
    <Dropdown show={show} onToggle={setShow} autoClose="outside" className={`sf-rem-pill-wrap${isSet ? ' is-set' : ''}`}>
      <Dropdown.Toggle as="button" type="button" className="sf-rem-pill" aria-label={`${ariaLabel}: ${label}`}>
        {icon}<span className="sf-rem-pill-label">{label}</span>
      </Dropdown.Toggle>
      {isSet && onClear && (
        <button type="button" className="sf-rem-pill-clear" onClick={onClear} aria-label={`Clear ${ariaLabel.toLowerCase()}`}>
          <IconClose size={11} />
        </button>
      )}
      <Dropdown.Menu className={`sf-rem-menu ${menuClassName}`} renderOnMount={false}>
        {show && children(close)}
      </Dropdown.Menu>
    </Dropdown>
  );
}

function Option({ selected, onPick, children, hint }) {
  return (
    <button type="button" role="menuitemradio" aria-checked={selected} className={`sf-rem-option${selected ? ' is-selected' : ''}`} onClick={onPick}>
      <span className="sf-rem-option-label">{children}</span>
      {hint && <span className="sf-rem-option-hint">{hint}</span>}
      <span className="sf-rem-option-check" aria-hidden="true">{selected && <IconCheck size={12} />}</span>
    </button>
  );
}

function DateMenu({ value, onChange, close }) {
  const [text, setText] = useState('');
  const inputRef = useRef(null);
  const today = localDateString();
  const suggestion = parseDatePhrase(text);
  const pick = changes => { onChange(changes); close(); };
  const quick = [
    { label: 'Today', date: today },
    { label: 'Tomorrow', date: shiftDateStr(today, 1) },
    { label: 'Next week', date: nextMonday(today) },
  ];

  return (
    <>
      <form className="sf-rem-menu-search" onSubmit={event => { event.preventDefault(); if (suggestion) pick(suggestion); }}>
        <input autoFocus value={text} onChange={event => setText(event.target.value)}
          placeholder="Type a date: fri 3pm, nov 2…" aria-label="Type a date" />
      </form>
      {text && (suggestion ? (
        <Option selected={false} onPick={() => pick(suggestion)} hint={suggestion.dueTime ? formatTime(suggestion.dueTime) : 'All day'}>
          <IconCalendar size={13} /> {dayLabel(suggestion.dueDate, today)}
        </Option>
      ) : <div className="sf-rem-menu-empty">Try “tomorrow 9am” or “oct 30”</div>)}
      {!text && (
        <>
          {quick.map(q => (
            <Option key={q.label} selected={value.dueDate === q.date} hint={weekdayShort(q.date)} onPick={() => pick({ dueDate: q.date })}>
              {q.label}
            </Option>
          ))}
          <Option selected={!value.dueDate} onPick={() => pick({ dueDate: null, dueTime: null, repeat: 'none' })}>No date</Option>
          <div className="sf-rem-menu-divider" />
          <Option selected={false} onPick={() => openPicker(inputRef.current)}>Pick from calendar…</Option>
          <input ref={inputRef} type="date" className="sf-rem-hidden-input" tabIndex={-1} aria-hidden="true"
            value={value.dueDate || ''} onChange={event => event.target.value && pick({ dueDate: event.target.value })} />
        </>
      )}
    </>
  );
}

function TimeMenu({ value, onChange, close }) {
  const inputRef = useRef(null);
  const pick = changes => { onChange(changes); close(); };
  return (
    <>
      <Option selected={!value.dueTime} onPick={() => pick({ dueTime: null })}>All day</Option>
      {TIME_PRESETS.map(time => (
        <Option key={time} selected={value.dueTime === time} onPick={() => pick({ dueTime: time })}>{formatTime(time)}</Option>
      ))}
      <div className="sf-rem-menu-divider" />
      <Option selected={false} onPick={() => openPicker(inputRef.current)}>Other time…</Option>
      <input ref={inputRef} type="time" className="sf-rem-hidden-input" tabIndex={-1} aria-hidden="true"
        value={value.dueTime || ''} onChange={event => event.target.value && pick({ dueTime: event.target.value })} />
    </>
  );
}

function SubjectMenu({ value, subjects, onChange, close }) {
  const [text, setText] = useState('');
  const q = text.trim().toLowerCase();
  const list = subjects.filter(s => s.name.toLowerCase().includes(q));
  const pick = changes => { onChange(changes); close(); };
  return (
    <>
      {subjects.length > 6 && (
        <div className="sf-rem-menu-search">
          <input autoFocus value={text} onChange={event => setText(event.target.value)} placeholder="Find a subject" aria-label="Find a subject"
            onKeyDown={event => { if (event.key === 'Enter' && list[0]) { event.preventDefault(); pick({ subjectId: subjectRefId(list[0]) }); } }} />
        </div>
      )}
      <div className="sf-rem-menu-scroll">
        {!q && <Option selected={!value.subjectId} onPick={() => pick({ subjectId: null })}>No subject</Option>}
        {list.map(s => (
          <Option key={subjectRefId(s)} selected={value.subjectId === subjectRefId(s)} onPick={() => pick({ subjectId: subjectRefId(s) })}>
            <span className="sf-rem-dot" style={{ background: s.color }} aria-hidden="true" /> {s.name}
          </Option>
        ))}
        {q && list.length === 0 && <div className="sf-rem-menu-empty">No subject matches</div>}
      </div>
    </>
  );
}

// The full property row shared by the composer and the editor.
// `value` holds dueDate/dueTime/subjectId/priority/repeat; `onChange` gets a
// partial update. `parsedKinds` marks values that came from typed text.
export default function ReminderPills({ value, onChange, subjects, parsedKinds = [] }) {
  const today = localDateString();
  const subject = subjectForReminder(subjects, value);
  const priority = PRIORITY_OPTIONS.find(o => o.value === value.priority) || PRIORITY_OPTIONS[3];
  const repeat = REPEAT_OPTIONS.find(o => o.value === value.repeat) || REPEAT_OPTIONS[4];
  const auto = kind => (parsedKinds.includes(kind) ? ' is-auto' : '');

  return (
    <div className="sf-rem-pills">
      <span className={`sf-rem-pill-slot${auto('date')}`}>
        <Pill icon={<IconCalendar size={14} />} ariaLabel="Date" isSet={Boolean(value.dueDate)}
          label={value.dueDate ? dayLabel(value.dueDate, today) : 'Date'}
          onClear={() => onChange({ dueDate: null, dueTime: null, repeat: 'none' })}>
          {close => <DateMenu value={value} onChange={onChange} close={close} />}
        </Pill>
      </span>

      {value.dueDate && (
        <span className={`sf-rem-pill-slot${auto('time')}`}>
          <Pill icon={<IconClock size={14} />} ariaLabel="Time" isSet={Boolean(value.dueTime)}
            label={value.dueTime ? formatTime(value.dueTime) : 'Time'} onClear={() => onChange({ dueTime: null })}>
            {close => <TimeMenu value={value} onChange={onChange} close={close} />}
          </Pill>
        </span>
      )}

      {subjects.length > 0 && (
        <span className={`sf-rem-pill-slot${auto('subject')}`}>
          <Pill ariaLabel="Subject" isSet={Boolean(subject)} label={subject ? subject.name : 'Subject'}
            icon={<span className="sf-rem-dot" style={{ background: subject?.color || 'transparent', boxShadow: subject ? 'none' : 'inset 0 0 0 1.5px currentColor' }} aria-hidden="true" />}
            onClear={() => onChange({ subjectId: null })}>
            {close => <SubjectMenu value={value} subjects={subjects} onChange={onChange} close={close} />}
          </Pill>
        </span>
      )}

      <span className={`sf-rem-pill-slot${auto('priority')}`}>
        <Pill ariaLabel="Priority" isSet={value.priority !== 'none'} label={value.priority !== 'none' ? priority.label : 'Priority'}
          icon={<span className={`sf-rem-prio sf-rem-prio-${value.priority}`} aria-hidden="true">{priority.mark || '!'}</span>}
          onClear={() => onChange({ priority: 'none' })}>
          {close => PRIORITY_OPTIONS.map(option => (
            <Option key={option.value} selected={value.priority === option.value} onPick={() => { onChange({ priority: option.value }); close(); }}>
              <span className={`sf-rem-prio sf-rem-prio-${option.value} sf-rem-option-mark`}>{option.mark}</span>{option.label}
            </Option>
          ))}
        </Pill>
      </span>

      {value.dueDate && (
        <span className={`sf-rem-pill-slot${auto('repeat')}`}>
          <Pill icon={<IconRepeat size={14} />} ariaLabel="Repeat" isSet={value.repeat !== 'none'}
            label={value.repeat !== 'none' ? repeat.label : 'Repeat'} onClear={() => onChange({ repeat: 'none' })}>
            {close => REPEAT_OPTIONS.map(option => (
              <Option key={option.value} selected={value.repeat === option.value} onPick={() => { onChange({ repeat: option.value }); close(); }}>
                {option.label}
              </Option>
            ))}
          </Pill>
        </span>
      )}
    </div>
  );
}
