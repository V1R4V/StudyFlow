import { useState } from 'react';
import { Modal, Button, Form } from 'react-bootstrap';
import { localDateString } from '../utils/sessions';

const MAX_NOTES = 500;
const MAX_HOURS = 24;

function clampRating(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 4;
  return Math.min(5, Math.max(1, Math.round(num)));
}

function clampInt(value, min, max) {
  const num = Math.floor(Number(value));
  if (!Number.isFinite(num)) return min;
  return Math.min(max, Math.max(min, num));
}

function todayISO() {
  return localDateString();
}

function trackedSecondsFromProps(props) {
  if (typeof props.seconds === 'number') return Math.max(0, Math.floor(props.seconds));
  if (typeof props.minutes === 'number') return Math.max(0, Math.floor(props.minutes)) * 60;
  return 0;
}

function splitHM(totalSeconds) {
  const safe = Math.max(0, Math.floor(totalSeconds));
  return {
    hours: Math.floor(safe / 3600),
    minutes: Math.floor((safe % 3600) / 60),
  };
}

function formatTrackedHint(totalSeconds) {
  const total = Math.max(0, Math.floor(totalSeconds));
  if (total < 60) return `${total}s`;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return s > 0 ? `${h}h ${m}m ${s}s` : `${h}h ${m}m`;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

export default function EndSessionModal(props) {
  const trackedSeconds = trackedSecondsFromProps(props);
  const trackedHM = splitHM(trackedSeconds);

  const [rating, setRating] = useState(() => clampRating(props.initialRating ?? 4));
  const [notes, setNotes] = useState(props.initialNotes || '');
  const [date, setDate] = useState(props.initialDate || todayISO());
  const [hours, setHours] = useState(trackedHM.hours);
  const [minutes, setMinutes] = useState(trackedHM.minutes);
  const [distractions, setDistractions] = useState(
    Math.max(0, Math.floor(Number(props.initialDistractions) || 0))
  );

  const isOverridden =
    hours !== trackedHM.hours || minutes !== trackedHM.minutes;

  function resetToTracked() {
    setHours(trackedHM.hours);
    setMinutes(trackedHM.minutes);
  }

  function handleSubmit(e) {
    e.preventDefault();
    const payload = {
      focusRating: rating,
      notes: notes.trim(),
      distractions,
    };
    if (props.showDateField) payload.date = date;
    if (isOverridden) {
      const overrideSeconds = Math.max(1, hours * 3600 + minutes * 60);
      payload.durationSeconds = overrideSeconds;
      payload.duration = Math.max(1, Math.ceil(overrideSeconds / 60));
    }
    props.onSave(payload);
  }

  const trackedHint = formatTrackedHint(trackedSeconds);
  const bothZero = hours === 0 && minutes === 0;

  return (
    <Modal show={props.show} onHide={props.onDiscard} centered>
      <Form onSubmit={handleSubmit}>
        <Modal.Header closeButton>
          <Modal.Title>{props.title || 'Session Complete'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group className="mb-4">
            <div className="d-flex justify-content-between align-items-end mb-1">
              <Form.Label className="mb-0">Real time spent</Form.Label>
              {isOverridden && (
                <button
                  type="button"
                  className="btn btn-link btn-sm p-0 small"
                  onClick={resetToTracked}
                >
                  Reset to tracked
                </button>
              )}
            </div>
            <div className="d-flex align-items-center gap-2">
              <Form.Control
                type="number"
                min="0"
                max={MAX_HOURS}
                value={hours}
                onChange={e => setHours(clampInt(e.target.value, 0, MAX_HOURS))}
                style={{ width: 90 }}
                aria-label="Hours"
              />
              <span className="text-muted">h</span>
              <Form.Control
                type="number"
                min="0"
                max="59"
                value={minutes}
                onChange={e => setMinutes(clampInt(e.target.value, 0, 59))}
                style={{ width: 90 }}
                aria-label="Minutes"
              />
              <span className="text-muted">m</span>
            </div>
            <Form.Text className="text-muted">
              Tracked: <strong>{trackedHint || '—'}</strong>. Adjust down if you took
              breaks or got distracted.
            </Form.Text>
          </Form.Group>

          {props.showDateField && (
            <Form.Group controlId="session-date" className="mb-4">
              <Form.Label>Date</Form.Label>
              <Form.Control
                type="date"
                value={date}
                max={todayISO()}
                onChange={e => setDate(e.target.value)}
              />
              <Form.Text className="text-muted">
                When did this session happen?
              </Form.Text>
            </Form.Group>
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

          <Form.Group controlId="session-distractions" className="mb-4">
            <Form.Label>
              Distractions <span className="text-muted small">(times you got pulled away)</span>
            </Form.Label>
            <div className="d-flex align-items-center gap-2">
              <Button
                type="button"
                variant="outline-secondary"
                size="sm"
                onClick={() => setDistractions(d => Math.max(0, d - 1))}
                disabled={distractions === 0}
                aria-label="Decrease distractions"
              >−</Button>
              <Form.Control
                type="number"
                min="0"
                max="99"
                value={distractions}
                onChange={e => setDistractions(clampInt(e.target.value, 0, 99))}
                style={{ width: 80, textAlign: 'center' }}
                aria-label="Distraction count"
              />
              <Button
                type="button"
                variant="outline-secondary"
                size="sm"
                onClick={() => setDistractions(d => Math.min(99, d + 1))}
                aria-label="Increase distractions"
              >+</Button>
            </div>
          </Form.Group>

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
          <Button type="submit" variant="primary" disabled={bothZero}>
            {props.saveLabel || 'Save Session'}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
