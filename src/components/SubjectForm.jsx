import { useState, useRef } from 'react';
import { Card, Form, Button, Row, Col, Alert } from 'react-bootstrap';

const RAINBOW_GRADIENT =
  'conic-gradient(from 0deg, #ef4444, #f59e0b, #eab308, #84cc16, #10b981, #06b6d4, #3b82f6, #8b5cf6, #d946ef, #ec4899, #ef4444)';

const COLOR_OPTIONS = [
  { value: '#dc2626', name: 'red' },
  { value: '#ea580c', name: 'orange' },
  { value: '#d97706', name: 'amber' },
  { value: '#047857', name: 'green' },
  { value: '#0e7490', name: 'teal' },
  { value: '#0284c7', name: 'sky' },
  { value: '#2b4bee', name: 'blue' },
  { value: '#4f46e5', name: 'indigo' },
  { value: '#7c3aed', name: 'violet' },
  { value: '#7e22ce', name: 'purple' },
  { value: '#db2777', name: 'pink' },
  { value: '#e11d48', name: 'rose' },
  { value: '#475569', name: 'slate' },
  { value: '#71717a', name: 'zinc' },
];

const MAX_NAME = 60;
const MAX_DAILY_GOAL = 24;
const MAX_WEEKLY_GOAL = 168;

export default function SubjectForm(props) {
  const { initial, onAdd, onSave, onCancel } = props;
  const isEdit = Boolean(initial);

  const [name, setName] = useState(initial?.name ?? '');
  const [color, setColor] = useState(initial?.color ?? COLOR_OPTIONS[0].value);
  const [dailyGoal, setDailyGoal] = useState(initial?.dailyGoal ?? 2);
  const [weeklyGoal, setWeeklyGoal] = useState(initial?.weeklyGoal ?? 10);
  const [error, setError] = useState('');
  const colorInputRef = useRef(null);

  const isCustomColor = !COLOR_OPTIONS.some(c => c.value.toLowerCase() === color.toLowerCase());

  function handleSubmit(e) {
    e.preventDefault();
    const trimmedName = name.trim();
    if (trimmedName.length === 0) {
      setError('Please enter a subject name.');
      return;
    }
    if (trimmedName.length > MAX_NAME) {
      setError(`Subject name must be ${MAX_NAME} characters or less.`);
      return;
    }
    setError('');
    const safeDaily = Math.min(MAX_DAILY_GOAL, Math.max(0, Number(dailyGoal) || 0));
    const safeWeekly = Math.min(MAX_WEEKLY_GOAL, Math.max(0, Number(weeklyGoal) || 0));

    if (isEdit) {
      onSave({
        name: trimmedName,
        color,
        dailyGoal: safeDaily,
        weeklyGoal: safeWeekly,
      });
      return;
    }

    onAdd({
      id: Date.now(),
      name: trimmedName,
      color: color,
      dailyGoal: safeDaily,
      weeklyGoal: safeWeekly,
      totalTimeSpent: 0,
    });
    setName('');
    setColor(COLOR_OPTIONS[0].value);
    setDailyGoal(2);
    setWeeklyGoal(10);
  }

  return (
    <Card>
      <Card.Body>
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h2 className="h5 mb-0">{isEdit ? 'Edit subject' : 'New subject'}</h2>
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

          <Form.Group controlId="subject-name" className="mb-3">
            <Form.Label>Subject Name</Form.Label>
            <Form.Control
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Organic Chemistry"
              maxLength={MAX_NAME}
              required
              aria-required="true"
            />
          </Form.Group>

          <fieldset className="mb-3">
            <Form.Label as="legend" className="form-label">Assign Color</Form.Label>
            <div
              role="radiogroup"
              aria-label="Subject color"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(5, 1fr)',
                gap: '0.5rem',
                maxWidth: 220,
              }}
            >
              {COLOR_OPTIONS.map(c => (
                <button
                  key={c.value}
                  type="button"
                  role="radio"
                  aria-checked={color === c.value}
                  aria-label={c.name}
                  title={c.name}
                  onClick={() => setColor(c.value)}
                  className="sf-color-dot"
                  style={{
                    background: c.value,
                    boxShadow:
                      color === c.value ? `0 0 0 3px white, 0 0 0 5px ${c.value}` : 'none',
                  }}
                />
              ))}
              <button
                type="button"
                role="radio"
                aria-checked={isCustomColor}
                aria-label="Custom color"
                title="Custom color"
                onClick={() => colorInputRef.current?.click()}
                className="sf-color-dot"
                style={{
                  background: isCustomColor ? color : RAINBOW_GRADIENT,
                  boxShadow: isCustomColor
                    ? `0 0 0 3px white, 0 0 0 5px ${color}`
                    : 'none',
                  cursor: 'pointer',
                }}
              />
              <input
                ref={colorInputRef}
                type="color"
                value={color}
                onChange={e => setColor(e.target.value)}
                aria-hidden="true"
                tabIndex={-1}
                style={{
                  position: 'absolute',
                  width: 0,
                  height: 0,
                  opacity: 0,
                  pointerEvents: 'none',
                }}
              />
            </div>
          </fieldset>

          <Row className="mb-4">
            <Col>
              <Form.Group controlId="subject-daily-goal">
                <Form.Label>Daily Goal (Hrs)</Form.Label>
                <Form.Control
                  type="number"
                  min={0}
                  max={MAX_DAILY_GOAL}
                  step={0.5}
                  value={dailyGoal}
                  onChange={e => setDailyGoal(e.target.value)}
                />
              </Form.Group>
            </Col>
            <Col>
              <Form.Group controlId="subject-weekly-goal">
                <Form.Label>Weekly Goal (Hrs)</Form.Label>
                <Form.Control
                  type="number"
                  min={0}
                  max={MAX_WEEKLY_GOAL}
                  step={0.5}
                  value={weeklyGoal}
                  onChange={e => setWeeklyGoal(e.target.value)}
                />
              </Form.Group>
            </Col>
          </Row>

          <Button type="submit" variant="primary" className="w-100">
            {isEdit ? 'Save changes' : 'Save subject'}
          </Button>
        </Form>
      </Card.Body>
    </Card>
  );
}
