import { useEffect, useState } from 'react';
import { Button } from 'react-bootstrap';
import ReminderPills from './ReminderPills';
import { IconCheck, IconClose, IconTrash, IconList, IconNote } from './ReminderIcons';

const NOTE_SAVE_DELAY_MS = 700;

function newItemId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

// Mount with key={reminder.key} so local text state resets per reminder.
export default function ReminderEditor({ reminder, subjects, onUpdate, onToggle, onDelete, onClose }) {
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

      <section className="sf-rem-field" aria-label="Details">
        <ReminderPills value={reminder} subjects={subjects}
          onChange={changes => onUpdate(changes.dueDate !== undefined || changes.dueTime !== undefined ? { ...changes, snoozedUntil: null } : changes)} />
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
