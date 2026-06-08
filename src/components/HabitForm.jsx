import { useState } from 'react';
import { Card, Form, Button, Alert } from 'react-bootstrap';
import { localDateString } from '../utils/sessions';
import { PRIORITY_LABELS } from '../utils/habits';

const MAX_NAME = 80;
const DOW = [
  { value: 0, label: 'S', full: 'Sunday' },
  { value: 1, label: 'M', full: 'Monday' },
  { value: 2, label: 'T', full: 'Tuesday' },
  { value: 3, label: 'W', full: 'Wednesday' },
  { value: 4, label: 'T', full: 'Thursday' },
  { value: 5, label: 'F', full: 'Friday' },
  { value: 6, label: 'S', full: 'Saturday' },
];
const PRIORITIES = ['low', 'normal', 'high', 'critical'];
const WEEKDAYS = [1, 2, 3, 4, 5];

export default function HabitForm({ initial, subjects, onAdd, onSave, onCancel }) {
  const isEdit = Boolean(initial);

  const [name, setName] = useState(initial?.name ?? '');
  const [subjectId, setSubjectId] = useState(
    initial?.subjectId ?? (subjects[0] ? String(subjects[0].id) : '')
  );
  const [priority, setPriority] = useState(initial?.priority ?? 'normal');
  const [days, setDays] = useState(initial?.days ?? WEEKDAYS);
  const [error, setError] = useState('');

  function toggleDay(d) {
    setDays(prev =>
      prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].sort((a, b) => a - b)
    );
  }

  function handleSubmit(e) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Please enter a habit name.');
      return;
    }
    if (!subjectId) {
      setError('Pick a subject for this habit.');
      return;
    }
    if (days.length === 0) {
      setError('Choose at least one day to schedule this habit.');
      return;
    }
    setError('');

    const subject = subjects.find(s => String(s.id) === String(subjectId));

    if (isEdit) {
      onSave({
        name: trimmed,
        priority,
        days,
        subjectId: String(subjectId),
        subjectName: subject?.name ?? initial.subjectName,
        subjectColor: subject?.color ?? initial.subjectColor,
      });
      return;
    }

    onAdd({
      id: Date.now(),
      name: trimmed,
      subjectId: String(subjectId),
      subjectName: subject?.name ?? '',
      subjectColor: subject?.color ?? '#2b4bee',
      priority,
      days,
      active: true,
      startDate: localDateString(),
    });
    setName('');
    setPriority('normal');
    setDays(WEEKDAYS);
  }

  return (
    <Card>
      <Card.Body>
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h2 className="h5 mb-0">{isEdit ? 'Edit habit' : 'New habit'}</h2>
          {onCancel && (
            <Button
              variant="link"
              className="p-0 text-muted"
              onClick={onCancel}
              style={{ textDecoration: 'none', fontSize: '0.85rem' }}
            >
              Cancel
            </Button>
          )}
        </div>

        <Form onSubmit={handleSubmit} noValidate>
          {error && (
            <Alert variant="danger" role="alert" className="py-2">
              {error}
            </Alert>
          )}

          <Form.Group controlId="habit-name" className="mb-3">
            <Form.Label>Habit</Form.Label>
            <Form.Control
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Review lecture notes"
              maxLength={MAX_NAME}
              required
            />
          </Form.Group>

          <Form.Group controlId="habit-subject" className="mb-3">
            <Form.Label>Subject</Form.Label>
            <Form.Select value={subjectId} onChange={e => setSubjectId(e.target.value)}>
              {subjects.length === 0 && <option value="">No subjects yet</option>}
              {subjects.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </Form.Select>
          </Form.Group>

          <Form.Group controlId="habit-priority" className="mb-3">
            <Form.Label>Priority</Form.Label>
            <Form.Select value={priority} onChange={e => setPriority(e.target.value)}>
              {PRIORITIES.map(p => (
                <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
              ))}
            </Form.Select>
            <Form.Text muted>Higher priority counts for more toward your grade.</Form.Text>
          </Form.Group>

          <fieldset className="mb-4">
            <Form.Label as="legend" className="form-label">Schedule</Form.Label>
            <div role="group" aria-label="Days of week" className="d-flex gap-1 flex-wrap">
              {DOW.map(d => {
                const on = days.includes(d.value);
                return (
                  <button
                    key={d.value}
                    type="button"
                    aria-pressed={on}
                    aria-label={d.full}
                    title={d.full}
                    onClick={() => toggleDay(d.value)}
                    className={`sf-dow-btn${on ? ' sf-dow-btn-on' : ''}`}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <Button type="submit" variant="primary" className="w-100" disabled={subjects.length === 0}>
            {isEdit ? 'Save changes' : 'Add habit'}
          </Button>
        </Form>
      </Card.Body>
    </Card>
  );
}
