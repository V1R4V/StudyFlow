import { useState } from 'react';
import { Modal, Button, Form } from 'react-bootstrap';

const MAX_NOTES = 500;

function clampRating(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 4;
  return Math.min(5, Math.max(1, Math.round(num)));
}

export default function EndSessionModal(props) {
  const [rating, setRating] = useState(() => clampRating(props.initialRating ?? 4));
  const [notes, setNotes] = useState(props.initialNotes || '');

  function formatDurationText() {
    if (typeof props.seconds === 'number') {
      const total = Math.max(0, Math.floor(props.seconds));
      if (total < 60) {
        const label = total === 1 ? 'second' : 'seconds';
        return `${total} ${label}`;
      }
      const minutes = Math.floor(total / 60);
      const seconds = total % 60;
      const minLabel = minutes === 1 ? 'minute' : 'minutes';
      if (seconds === 0) return `${minutes} ${minLabel}`;
      const secLabel = seconds === 1 ? 'second' : 'seconds';
      return `${minutes} ${minLabel} ${seconds} ${secLabel}`;
    }

    if (typeof props.minutes === 'number') {
      const mins = Math.max(0, Math.floor(props.minutes));
      const label = mins === 1 ? 'minute' : 'minutes';
      return `${mins} ${label}`;
    }

    return null;
  }

  function handleSubmit(e) {
    e.preventDefault();
    props.onSave({ focusRating: rating, notes: notes.trim() });
  }

  return (
    <Modal show={props.show} onHide={props.onDiscard} centered>
      <Form onSubmit={handleSubmit}>
        <Modal.Header closeButton>
          <Modal.Title>{props.title || 'Session Complete'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {formatDurationText() && (
            <p className="text-muted mb-3">
              You studied for <strong>{formatDurationText()}</strong>. How was your focus?
            </p>
          )}

          <fieldset className="mb-4">
            <Form.Label as="legend" className="form-label">Focus Rating</Form.Label>
            <div role="radiogroup" aria-label="Focus rating from 1 to 5" className="d-flex gap-2">
              {[1, 2, 3, 4, 5].map(n => (
                <Button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={rating === n}
                  aria-label={`${n} of 5`}
                  variant={rating === n ? 'primary' : 'outline-secondary'}
                  onClick={() => setRating(n)}
                  style={{ flex: 1, fontWeight: 600 }}
                >
                  {n}
                </Button>
              ))}
            </div>
            <Form.Text className="text-muted">
              1 = distracted, 5 = deep focus
            </Form.Text>
          </fieldset>

          <Form.Group controlId="session-notes">
            <Form.Label>
              Notes <span className="text-muted small">(optional)</span>
            </Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="What did you work on? Any reflections?"
              maxLength={MAX_NOTES}
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button type="button" variant="outline-secondary" onClick={props.onDiscard}>
            {props.discardLabel || 'Discard'}
          </Button>
          <Button type="submit" variant="primary">
            {props.saveLabel || 'Save Session'}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
