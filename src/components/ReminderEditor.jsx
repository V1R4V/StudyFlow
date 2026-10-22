import { useEffect, useState } from 'react';
import { Form, Button } from 'react-bootstrap';
import { PRIORITIES, REPEATS, subjectRefId } from '../utils/reminders';
import { localDateString, shiftDateStr } from '../utils/sessions';
import { IconCheck, IconClose, IconTrash, IconCalendar, IconClock, IconRepeat, IconList, IconNote } from './ReminderIcons';

const REPEAT_LABELS = { none: 'Never', daily: 'Every day', weekdays: 'Weekdays', weekly: 'Every week', monthly: 'Every month' };
const PRIORITY_LABELS = { none: 'None', low: 'Low', medium: 'Medium', high: 'High' };
const NOTE_SAVE_DELAY_MS = 700;

function nextMonday(today) {
  const day = new Date(`${today}T00:00:00`).getDay();
  return shiftDateStr(today, ((8 - day) % 7) || 7);
}

function newItemId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

// Mount with key={reminder.key} so local text state resets per reminder.
export default function ReminderEditor({ reminder, subjects, onUpdate, onToggle, onDelete, onClose }) {
  const today = localDateString();
  const [title, setTitle] = useState(reminder.title);
  const [note, setNote] = useState(reminder.note);
  const [newItem, setNewItem] = useState('');

  // Notes save shortly after typing pauses; blur saves immediately.
  useEffect(() => {
    if (note === reminder.note) return undefined;
    const id = window.setTimeout(() => onUpdate({ note }), NOTE_SAVE_DELAY_MS);
    return () => window.clearTimeout(id);
  }, [note, reminder.note, onUpdate]);

  function commitTitle() {
    const trimmed = title.trim();
    if (!trimmed) setTitle(reminder.title);
    else if (trimmed !== reminder.title) onUpdate({ title: trimmed });
  }

  function setDate(dueDate) {
    onUpdate(dueDate
      ? { dueDate, snoozedUntil: null }
      : { dueDate: null, dueTime: null, repeat: 'none', snoozedUntil: null });
  }

  function updateItem(id, changes) {
    onUpdate({ checklist: reminder.checklist.map(item => (item.id === id ? { ...item, ...changes } : item)) });
  }

  function addItem(event) {
    event.preventDefault();
    const text = newItem.trim();
    if (!text || reminder.checklist.length >= 50) return;
    onUpdate({ checklist: [...reminder.checklist, { id: newItemId(), text, done: false }] });
    setNewItem('');
  }

  const quickDates = [
    { label: 'Today', value: today },
    { label: 'Tomorrow', value: shiftDateStr(today, 1) },
    { label: 'Next week', value: nextMonday(today) },
  ];
  const doneCount = reminder.checklist.filter(item => item.done).length;

  return (
    <div className="sf-rem-editor">
      <div className="sf-rem-editor-head">
        <button
          type="button"
          role="checkbox"
          aria-checked={reminder.done}
          aria-label={reminder.done ? 'Mark as not done' : 'Mark as done'}
          className={`sf-rem-check sf-rem-check-${reminder.priority}`}
          onClick={() => onToggle(reminder.key)}
        >
          <IconCheck size={12} />
        </button>
        <textarea
          className="sf-rem-editor-title"
          value={title}
          rows={1}
          maxLength={200}
          aria-label="Reminder title"
          onChange={event => setTitle(event.target.value.replace(/\n/g, ' '))}
          onBlur={commitTitle}
          onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); } }}
        />
        <button type="button" className="sf-icon-btn sf-rem-editor-close" onClick={onClose} aria-label="Close details">
          <IconClose size={16} />
        </button>
      </div>

      <section className="sf-rem-field" aria-labelledby="rem-when-label">
        <div className="sf-rem-field-label" id="rem-when-label"><IconCalendar size={14} /> When</div>
        <div className="sf-rem-chips">
          {quickDates.map(option => (
            <button key={option.label} type="button"
              className={`sf-rem-chip${reminder.dueDate === option.value ? ' is-active' : ''}`}
              aria-pressed={reminder.dueDate === option.value}
              onClick={() => setDate(option.value)}>
              {option.label}
            </button>
          ))}
          <button type="button" className={`sf-rem-chip${!reminder.dueDate ? ' is-active' : ''}`}
            aria-pressed={!reminder.dueDate} onClick={() => setDate(null)}>
            No date
          </button>
        </div>
        <div className="sf-rem-inline">
          <Form.Control type="date" size="sm" value={reminder.dueDate || ''} aria-label="Due date"
            onChange={event => setDate(event.target.value || null)} />
          <div className="sf-rem-time">
            <IconClock size={14} />
            <Form.Control type="time" size="sm" value={reminder.dueTime || ''} aria-label="Due time"
              disabled={!reminder.dueDate}
              onChange={event => onUpdate({ dueTime: event.target.value || null, snoozedUntil: null })} />
          </div>
        </div>
      </section>

      <div className="sf-rem-grid">
        <section className="sf-rem-field">
          <label className="sf-rem-field-label" htmlFor="rem-repeat"><IconRepeat size={14} /> Repeat</label>
          <Form.Select id="rem-repeat" size="sm" value={reminder.repeat} disabled={!reminder.dueDate}
            onChange={event => onUpdate({ repeat: event.target.value })}>
            {REPEATS.map(value => <option key={value} value={value}>{REPEAT_LABELS[value]}</option>)}
          </Form.Select>
        </section>
        <section className="sf-rem-field">
          <label className="sf-rem-field-label" htmlFor="rem-subject">Subject</label>
          <Form.Select id="rem-subject" size="sm" value={reminder.subjectId || ''}
            onChange={event => onUpdate({ subjectId: event.target.value || null })}>
            <option value="">No subject</option>
            {subjects.map(subject => (
              <option key={subjectRefId(subject)} value={subjectRefId(subject)}>{subject.name}</option>
            ))}
          </Form.Select>
        </section>
      </div>

      <section className="sf-rem-field" aria-labelledby="rem-priority-label">
        <div className="sf-rem-field-label" id="rem-priority-label">Priority</div>
        <div className="btn-group w-100" role="radiogroup" aria-labelledby="rem-priority-label">
          {PRIORITIES.map(value => (
            <button key={value} type="button" role="radio" aria-checked={reminder.priority === value}
              className={`btn btn-sm ${reminder.priority === value ? 'btn-primary' : 'btn-outline-primary'}`}
              onClick={() => onUpdate({ priority: value })}>
              {PRIORITY_LABELS[value]}
            </button>
          ))}
        </div>
      </section>

      <section className="sf-rem-field" aria-labelledby="rem-checklist-label">
        <div className="sf-rem-field-label" id="rem-checklist-label">
          <IconList size={14} /> Checklist
          {reminder.checklist.length > 0 && <span className="sf-rem-field-count">{doneCount}/{reminder.checklist.length}</span>}
        </div>
        <ul className="sf-rem-checklist">
          {reminder.checklist.map(item => (
            <li key={item.id} className={item.done ? 'is-done' : ''}>
              <button type="button" role="checkbox" aria-checked={item.done} aria-label={`Mark "${item.text}" as ${item.done ? 'not done' : 'done'}`}
                className="sf-rem-check sf-rem-check-sm" onClick={() => updateItem(item.id, { done: !item.done })}>
                <IconCheck size={10} />
              </button>
              <input type="text" defaultValue={item.text} maxLength={200} aria-label="Checklist item"
                onBlur={event => {
                  const text = event.target.value.trim();
                  if (!text) event.target.value = item.text;
                  else if (text !== item.text) updateItem(item.id, { text });
                }}
                onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }} />
              <button type="button" className="sf-rem-item-remove" aria-label={`Remove "${item.text}"`}
                onClick={() => onUpdate({ checklist: reminder.checklist.filter(other => other.id !== item.id) })}>
                <IconClose size={13} />
              </button>
            </li>
          ))}
        </ul>
        <form onSubmit={addItem} className="sf-rem-checklist-add">
          <input type="text" value={newItem} onChange={event => setNewItem(event.target.value)}
            placeholder="Add a step" maxLength={200} aria-label="Add a checklist step" />
        </form>
      </section>

      <section className="sf-rem-field sf-rem-field-grow">
        <label className="sf-rem-field-label" htmlFor="rem-note"><IconNote size={14} /> Notes</label>
        <textarea id="rem-note" className="sf-rem-note" value={note} maxLength={5000}
          placeholder="Links, details, what you need to remember…"
          onChange={event => setNote(event.target.value)}
          onBlur={() => { if (note !== reminder.note) onUpdate({ note }); }} />
      </section>

      <div className="sf-rem-editor-foot">
        <span className="small text-muted">
          Created {new Date(reminder.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
        </span>
        <Button variant="outline-danger" size="sm" className="sf-action-button" onClick={() => onDelete(reminder.key)}>
          <IconTrash size={14} /> Delete
        </Button>
      </div>
    </div>
  );
}
