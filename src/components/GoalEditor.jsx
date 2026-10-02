import { useId, useState } from 'react';
import { Form, Button, Alert } from 'react-bootstrap';

export default function GoalEditor({ subject, onSave, onCancel }) {
  const inputId = useId();
  const [value, setValue] = useState(String(subject.weeklyGoal || 0));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    const goal = Number(value);
    if (!value.trim() || !Number.isFinite(goal) || goal < 0 || goal > 168) {
      setError('Enter a weekly goal from 0 to 168 hours.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSave(subject.id, { weeklyGoal: goal });
      onCancel();
    } catch {
      setError('Your goal could not be saved. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Form className="sf-goal-editor" onSubmit={submit} noValidate>
      <Form.Label htmlFor={inputId} className="small mb-1">{subject.name} weekly goal (hours)</Form.Label>
      <div className="d-flex flex-wrap align-items-center gap-2">
        <Form.Control id={inputId} type="number" min={0} max={168} step="any" inputMode="decimal"
          value={value} onChange={event => setValue(event.target.value)} autoFocus disabled={saving} />
        <Button type="submit" size="sm" disabled={saving}>{saving ? 'Saving…' : 'Save goal'}</Button>
        <Button type="button" variant="outline-secondary" size="sm" disabled={saving} onClick={onCancel}>Cancel</Button>
        <span className="text-muted small">0 removes the goal. This target applies each week.</span>
      </div>
      {error && <Alert variant="danger" className="py-2 mt-2 mb-0" role="alert">{error}</Alert>}
    </Form>
  );
}
