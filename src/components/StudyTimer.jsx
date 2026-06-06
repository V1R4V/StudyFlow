import { Card, Button, Form, Row, Col, ToggleButton, ToggleButtonGroup } from 'react-bootstrap';
import { useTimer, formatClock } from '../context/TimerContext';

const MODES = [
  { value: 'pomodoro', label: 'Pomodoro', sub: '25 min countdown' },
  { value: 'custom', label: 'Custom', sub: 'Pick your own H:M:S' },
  { value: 'stopwatch', label: 'Stopwatch', sub: 'Count up freely' },
];

export default function StudyTimer(props) {
  const t = useTimer();
  const isCountdown = t.targetSeconds > 0;
  const displaySeconds = isCountdown ? t.targetSeconds - t.secondsElapsed : t.secondsElapsed;
  const isPaused = !t.isRunning && t.secondsElapsed > 0;

  let subtitle = 'Ready to dive into deep work?';
  if (t.isRunning) subtitle = 'Deep focus in progress…';
  else if (isPaused) subtitle = 'Paused. Press resume to continue';

  const activeMode = MODES.find(m => m.value === t.mode);
  const customDisabled = t.isRunning || t.secondsElapsed > 0;

  function clamp(v, max) {
    const n = Math.max(0, Math.min(max, Number(v) || 0));
    return n;
  }

  return (
    <Card className="h-100 text-center sf-card-panel sf-card-timer">
      <Card.Body className="sf-panel-body text-center">
        <h2 className="h4 mb-1">Smart Timer</h2>
        <p style={{ color: 'var(--muted-strong)' }} className="mb-3">{subtitle}</p>

        <div role="group" aria-label="Timer mode" className="mb-3">
          <ToggleButtonGroup
            type="radio"
            name="timer-mode"
            value={t.mode}
            onChange={t.applyMode}
            className="w-100"
          >
            {MODES.map(m => (
              <ToggleButton
                key={m.value}
                id={`timer-mode-${m.value}`}
                value={m.value}
                variant={t.mode === m.value ? 'primary' : 'outline-primary'}
                disabled={t.isRunning}
              >
                {m.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
          <div className="small mt-1" style={{ color: 'var(--muted-strong)' }}>
            {activeMode?.sub}
          </div>
        </div>

        <div className="sf-timer-display">
          {formatClock(displaySeconds, { showHours: t.mode === 'custom' })}
        </div>

        <div className="sf-pill mb-3 mt-2" aria-hidden="true">
          {t.mode === 'pomodoro' && 'POMODORO MODE'}
          {t.mode === 'custom' && 'CUSTOM TIMER'}
          {t.mode === 'stopwatch' && 'STOPWATCH MODE'}
        </div>

        {t.mode === 'custom' && (
          <fieldset className="mb-3 text-start">
            <Form.Label as="legend" className="form-label small mb-1" style={{ color: 'var(--muted-strong)' }}>
              Custom duration
            </Form.Label>
            <Row className="g-2">
              <Col>
                <Form.Group controlId="timer-custom-h">
                  <Form.Label className="visually-hidden">Hours</Form.Label>
                  <Form.Control
                    type="number"
                    min={0}
                    max={23}
                    step={1}
                    value={t.customH}
                    onChange={e => t.setCustomTime(clamp(e.target.value, 23), t.customM, t.customS)}
                    disabled={customDisabled}
                    aria-label="Hours"
                  />
                  <div className="text-center small" style={{ color: 'var(--muted-strong)' }}>HR</div>
                </Form.Group>
              </Col>
              <Col>
                <Form.Group controlId="timer-custom-m">
                  <Form.Label className="visually-hidden">Minutes</Form.Label>
                  <Form.Control
                    type="number"
                    min={0}
                    max={59}
                    step={1}
                    value={t.customM}
                    onChange={e => t.setCustomTime(t.customH, clamp(e.target.value, 59), t.customS)}
                    disabled={customDisabled}
                    aria-label="Minutes"
                  />
                  <div className="text-center small" style={{ color: 'var(--muted-strong)' }}>MIN</div>
                </Form.Group>
              </Col>
              <Col>
                <Form.Group controlId="timer-custom-s">
                  <Form.Label className="visually-hidden">Seconds</Form.Label>
                  <Form.Control
                    type="number"
                    min={0}
                    max={59}
                    step={1}
                    value={t.customS}
                    onChange={e => t.setCustomTime(t.customH, t.customM, clamp(e.target.value, 59))}
                    disabled={customDisabled}
                    aria-label="Seconds"
                  />
                  <div className="text-center small" style={{ color: 'var(--muted-strong)' }}>SEC</div>
                </Form.Group>
              </Col>
            </Row>
          </fieldset>
        )}

        <Form.Group controlId="timer-subject" className="mb-3 text-start">
          <Form.Label className="small mb-1" style={{ color: 'var(--muted-strong)' }}>
            Subject
          </Form.Label>
          <Form.Select
            value={t.subjectId}
            onChange={e => t.setSubjectId(e.target.value)}
            disabled={t.isRunning}
          >
            {(!props.subjects || props.subjects.length === 0) && (
              <option value="">No subjects yet, add one first</option>
            )}
            {props.subjects && props.subjects.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </Form.Select>
        </Form.Group>

        {t.error && (
          <div role="alert" className="small mb-2" style={{ color: 'var(--danger-text)' }}>
            {t.error}
          </div>
        )}

        <div className="d-grid gap-2">
          {!t.isRunning ? (
            <Button variant="primary" size="lg" onClick={t.start}>
              <span aria-hidden="true">▶ </span>
              {isPaused ? 'Resume Session' : 'Start Session'}
            </Button>
          ) : (
            <Button variant="warning" size="lg" onClick={t.pause}>
              <span aria-hidden="true">⏸ </span>Pause
            </Button>
          )}

          {(t.isRunning || isPaused) && (
            /* Single-tap distraction logger, increments a counter that's
               saved with the session and shows up in stats. */
            <Button
              variant="outline-warning"
              size="sm"
              onClick={t.logDistraction}
              aria-label="Log a distraction"
            >
              Got distracted
              {t.distractions > 0 && (
                <span className="ms-2 badge bg-warning text-dark">{t.distractions}</span>
              )}
            </Button>
          )}

          <div className="d-flex gap-2 justify-content-center">
            <Button variant="outline-secondary" size="sm" onClick={t.reset}>
              Reset
            </Button>
            <Button variant="outline-success" size="sm" onClick={t.endSession}>
              End Session
            </Button>
          </div>
        </div>

        <div className="visually-hidden" role="status" aria-live="polite">
          {t.liveMessage}
        </div>
      </Card.Body>
    </Card>
  );
}
