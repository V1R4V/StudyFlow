import { useState } from 'react';
import { Card, Form, Button, Row, Col, Alert } from 'react-bootstrap';

const COLOR_OPTIONS = [
  { value: '#dc2626', name: 'red' },
  { value: '#047857', name: 'green' },
  { value: '#2b4bee', name: 'blue' },
  { value: '#7e22ce', name: 'purple' },
  { value: '#b45309', name: 'orange' },
  { value: '#0e7490', name: 'teal' },
];

const MAX_NAME = 60;
const MAX_DAILY_GOAL = 24;
const MAX_WEEKLY_GOAL = 168;

export default function SubjectForm(props) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLOR_OPTIONS[0].value);
  const [dailyGoal, setDailyGoal] = useState(2);
  const [weeklyGoal, setWeeklyGoal] = useState(10);
  const [error, setError] = useState('');

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
    props.onAdd({
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
          <h2 className="h5 mb-0">New subject</h2>
          {props.onCancel && (
            <Button
              variant="link"
              className="p-0 text-muted"
              onClick={props.onCancel}
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
            <div role="radiogroup" aria-label="Subject color" className="d-flex gap-2">
              {COLOR_OPTIONS.map(c => (
                <button
                  key={c.value}
                  type="button"
                  role="radio"
                  aria-checked={color === c.value}
                  aria-label={c.name}
                  onClick={() => setColor(c.value)}
                  className="sf-color-dot"
                  style={{
                    background: c.value,
                    boxShadow:
                      color === c.value ? `0 0 0 3px white, 0 0 0 5px ${c.value}` : 'none',
                  }}
                />
              ))}
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
            Save subject
          </Button>
        </Form>
      </Card.Body>
    </Card>
  );
}
