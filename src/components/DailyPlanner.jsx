import { useState } from 'react';
import { Card, Form, Button, Dropdown } from 'react-bootstrap';
import { useStudyData } from '../context/StudyDataContext';
import { localDateString } from '../utils/sessions';

const MAX_TODO_LEN = 200;

function todayDateString() {
  return localDateString();
}

function shiftDate(dateStr, deltaDays) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + deltaDays);
  return localDateString(d);
}

function prettyLabel(dateStr) {
  const today = todayDateString();
  const yesterday = shiftDate(today, -1);
  const tomorrow = shiftDate(today, 1);
  if (dateStr === today) return 'Today';
  if (dateStr === yesterday) return 'Yesterday';
  if (dateStr === tomorrow) return 'Tomorrow';
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

const IconCheck = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 8.5l3 3 7-7" />
  </svg>
);

const IconChevronLeft = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M10 3L5 8l5 5" />
  </svg>
);

const IconChevronRight = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M6 3l5 5-5 5" />
  </svg>
);

const IconTrash = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 4h10M6 4V2.5a1 1 0 011-1h2a1 1 0 011 1V4M5 4l1 9.5a1 1 0 001 .9h2a1 1 0 001-.9L11 4" />
  </svg>
);

function TodoItem({ todo, onToggle, onDelete }) {
  return (
    <div className="sf-todo-item d-flex align-items-center gap-2 py-2">
      <button
        type="button"
        onClick={() => onToggle(todo)}
        aria-pressed={todo.done}
        aria-label={todo.done ? 'Mark as not done' : 'Mark as done'}
        className="sf-todo-check"
        style={{
          width: 20,
          height: 20,
          borderRadius: 4,
          border: `1.5px solid ${todo.done ? 'var(--primary)' : 'var(--border-strong, #4b5563)'}`,
          background: todo.done ? 'var(--primary)' : 'transparent',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          padding: 0,
          flexShrink: 0,
        }}
      >
        {todo.done && <IconCheck />}
      </button>
      <div className="flex-grow-1 min-w-0">
        <div
          className="small"
          style={{
            textDecoration: todo.done ? 'line-through' : 'none',
            color: todo.done ? 'var(--text-light)' : 'var(--text-dark)',
            wordBreak: 'break-word',
          }}
        >
          {todo.text}
        </div>
        {todo.subjectName && (
          <div className="d-flex align-items-center gap-1 mt-1">
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: todo.subjectColor || '#6b7280',
                display: 'inline-block',
              }}
            />
            <span className="text-muted" style={{ fontSize: '0.7rem' }}>
              {todo.subjectName}
            </span>
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={() => onDelete(todo)}
        className="btn btn-link btn-sm p-0 text-muted sf-todo-delete"
        aria-label={`Delete: ${todo.text}`}
        style={{ opacity: 0.5 }}
      >
        <IconTrash />
      </button>
    </div>
  );
}

export default function DailyPlanner() {
  const { todos, subjects, addTodo, updateTodo, deleteTodo } = useStudyData();
  const [selectedDate, setSelectedDate] = useState(todayDateString());
  const [draft, setDraft] = useState('');
  const [draftSubjectId, setDraftSubjectId] = useState('');

  const visibleTodos = todos.filter(t => t.date === selectedDate);
  const remaining = visibleTodos.filter(t => !t.done).length;

  function handleAdd(e) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;

    let subjectFields = { subjectId: null, subjectName: null, subjectColor: null };
    if (draftSubjectId) {
      const subj = subjects.find(s => String(s.id) === String(draftSubjectId));
      if (subj) {
        subjectFields = {
          subjectId: String(subj.firestoreId ?? subj.id),
          subjectName: subj.name,
          subjectColor: subj.color,
        };
      }
    }

    addTodo({
      text,
      date: selectedDate,
      done: false,
      ...subjectFields,
    });
    setDraft('');
  }

  function handleToggle(todo) {
    updateTodo(todo.id, { done: !todo.done });
  }

  function handleDelete(todo) {
    deleteTodo(todo.id);
  }

  return (
    <Card className="h-100 sf-card-panel">
      <Card.Body className="sf-panel-body">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <div>
            <h2 className="h5 mb-0">Daily Planner</h2>
            <small className="text-muted">
              {visibleTodos.length === 0
                ? 'Nothing yet — add your first todo.'
                : `${remaining} of ${visibleTodos.length} left`}
            </small>
          </div>
        </div>

        <div className="d-flex justify-content-between align-items-center mb-3">
          <Button
            variant="link"
            className="p-0 text-muted"
            aria-label="Previous day"
            onClick={() => setSelectedDate(shiftDate(selectedDate, -1))}
          >
            <IconChevronLeft />
          </Button>
          <button
            type="button"
            onClick={() => setSelectedDate(todayDateString())}
            className="btn btn-link p-0 fw-semibold"
            style={{ textDecoration: 'none', color: 'var(--text-dark)' }}
            title="Jump to today"
          >
            {prettyLabel(selectedDate)}
            <div className="text-muted" style={{ fontSize: '0.7rem', fontWeight: 400 }}>
              {selectedDate}
            </div>
          </button>
          <Button
            variant="link"
            className="p-0 text-muted"
            aria-label="Next day"
            onClick={() => setSelectedDate(shiftDate(selectedDate, 1))}
          >
            <IconChevronRight />
          </Button>
        </div>

        <div className="flex-grow-1 overflow-auto" style={{ maxHeight: 280 }}>
          {visibleTodos.length === 0 ? (
            <div className="text-center text-muted small py-4">
              No todos for this day.
            </div>
          ) : (
            visibleTodos.map(todo => (
              <TodoItem
                key={todo.id}
                todo={todo}
                onToggle={handleToggle}
                onDelete={handleDelete}
              />
            ))
          )}
        </div>

        <Form onSubmit={handleAdd} className="mt-3 pt-3" style={{ borderTop: '1px solid var(--border, #2a2a2a)' }}>
          <div className="d-flex gap-2 mb-2">
            <Form.Control
              type="text"
              size="sm"
              placeholder="Add a todo…"
              value={draft}
              onChange={e => setDraft(e.target.value)}
              maxLength={MAX_TODO_LEN}
              aria-label="New todo text"
            />
            <Button type="submit" size="sm" variant="primary" disabled={!draft.trim()}>
              Add
            </Button>
          </div>
          {subjects.length > 0 && (
            <Form.Select
              size="sm"
              value={draftSubjectId}
              onChange={e => setDraftSubjectId(e.target.value)}
              aria-label="Tag a subject (optional)"
            >
              <option value="">No subject</option>
              {subjects.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </Form.Select>
          )}
        </Form>
      </Card.Body>
    </Card>
  );
}
