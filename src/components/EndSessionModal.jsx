import { useState } from 'react';
import { Modal, Button, Form, Alert } from 'react-bootstrap';
import { localDateString } from '../utils/sessions';
import { timingValidationError } from '../utils/sessionTiming';
import { useTimeZone } from '../hooks/useTimeZone';
import { zonedDateTimeInput, parseZonedDateTime } from '../utils/timeZone';

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
  if (total < 60) return 'Less than 1 minute';
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

const minuteInput = (value, zone) => zonedDateTimeInput(value, zone).slice(0, 16);

export default function EndSessionModal(props) {
  const { timeZone: selectedZone } = useTimeZone();
  const [timeZone] = useState(selectedZone);
  const trackedSeconds = trackedSecondsFromProps(props);
  const trackedHM = splitHM(trackedSeconds);

  const [rating, setRating] = useState(() => clampRating(props.initialRating ?? 4));
  const [notes, setNotes] = useState(props.initialNotes || '');
  const [startInput, setStartInput] = useState(() => minuteInput(props.initialStartedAt, timeZone));
  const [endInput, setEndInput] = useState(() => minuteInput(props.initialEndedAt, timeZone));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
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

  const hasTiming = Boolean(startInput || endInput || props.requireTiming || props.initialStartedAt || props.initialEndedAt);
  // Preserve exact instants (including repeated DST hours) until edited.
  const startedAt = startInput === minuteInput(props.initialStartedAt, timeZone)
    ? props.initialStartedAt : parseZonedDateTime(startInput, timeZone, props.initialStartedAt);
  const endedAt = endInput === minuteInput(props.initialEndedAt, timeZone)
    ? props.initialEndedAt : parseZonedDateTime(endInput, timeZone, props.initialEndedAt);
  const effectiveSeconds = isOverridden ? hours * 3600 + minutes * 60 : trackedSeconds;
  const timingError = hasTiming ? timingValidationError(startedAt, endedAt, effectiveSeconds) : '';
  const durationError = effectiveSeconds <= 0 || effectiveSeconds > 86400
    ? 'Real time spent must be between 1 second and 24 hours.' : '';

  async function handleSubmit(e) {
    e.preventDefault();
    if (saving || timingError || durationError) return;
    const payload = {
      focusRating: rating,
      notes: notes.trim(),
      distractions,
    };
    if (hasTiming) {
      payload.startedAt = startedAt;
      payload.endedAt = endedAt;
      payload.date = localDateString(startedAt);
    } else if (props.showDateField) payload.date = date;
    if (isOverridden) {
      const overrideSeconds = Math.max(1, hours * 3600 + minutes * 60);
      payload.durationSeconds = overrideSeconds;
      payload.duration = Math.max(1, Math.ceil(overrideSeconds / 60));
    }
    setSaving(true);
    setSaveError('');
    try {
      await props.onSave(payload);
    } catch {
      setSaveError('Could not save your session. Your changes are still here. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  const trackedHint = formatTrackedHint(trackedSeconds);

  return (
    <Modal show={props.show} onHide={saving ? undefined : props.onDiscard} centered scrollable backdrop={saving ? 'static' : true} keyboard={!saving}>
      <Form onSubmit={handleSubmit} className="d-flex flex-column" style={{ minHeight: 0 }}>
        <Modal.Header closeButton={!saving}>
          <Modal.Title>{props.title || 'Session Complete'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {saveError && <Alert variant="danger" role="alert">{saveError}</Alert>}
          <fieldset className="mb-4" disabled={saving}>
            <legend className="form-label">Session start &amp; end</legend>
            <p className="small text-muted mb-2">
              Review or correct when you studied. Times shown in {timeZone}.
            </p>
            <Form.Group controlId="session-started-at" className="mb-2">
              <Form.Label>Started</Form.Label>
              <Form.Control type="datetime-local" step="60" value={startInput}
                required={hasTiming} onChange={e => setStartInput(e.target.value)} />
            </Form.Group>
            <Form.Group controlId="session-ended-at">
              <Form.Label>Ended</Form.Label>
              <Form.Control type="datetime-local" step="60" value={endInput}
                required={hasTiming} onChange={e => setEndInput(e.target.value)} />
            </Form.Group>
            {!props.initialStartedAt && <Form.Text className="text-muted">
              Start and end were not recorded for this session. Enter them if you know them.
            </Form.Text>}
            {timingError && <div className="small text-danger mt-2" role="alert">{timingError}</div>}
            {hasTiming && !timingError && <Form.Text className="text-muted">
              Session window: {formatTrackedHint((endedAt - startedAt) / 1000)} including pauses.
              Credited to the start date. Focused time below is tracked separately.
            </Form.Text>}
          </fieldset>
          <Form.Group className="mb-4">
            <div className="d-flex justify-content-between align-items-end mb-1">
              <Form.Label className="mb-0">Focused time</Form.Label>
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
              Tracked: <strong>{trackedHint || '–'}</strong>. Adjust down if you took
              breaks or got distracted.
            </Form.Text>
          </Form.Group>

          {props.showDateField && !hasTiming && (
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

          {durationError && <div className="small text-danger mb-3" role="alert">{durationError}</div>}
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
          <Button type="button" variant="outline-secondary" onClick={props.onDiscard} disabled={saving}>
            {props.discardLabel || 'Discard'}
          </Button>
          <Button type="submit" variant="primary" disabled={saving || Boolean(timingError || durationError)}>
            {saving ? 'Saving…' : props.saveLabel || 'Save Session'}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
