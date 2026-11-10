import { SegmentedControl, Select } from '@mantine/core';
import { Card, Button, Form, Row, Col } from 'react-bootstrap';
import Icon from './Icon';
import { useTimer, formatClock } from '../context/TimerContext';

const MODES = [
  { value: 'pomodoro', label: 'Pomodoro', sub: '25 min countdown' },
  { value: 'custom', label: 'Custom', sub: 'Pick your own H:M:S' },
  { value: 'stopwatch', label: 'Stopwatch', sub: 'Count up freely' },
  { value: 'break', label: 'Break', sub: 'Custom break, tracked separately' },
];

export default function StudyTimer(props) {
  const t = useTimer();
  const isBreak = t.mode === 'break';
  const isCountdown = t.targetSeconds > 0;
  const displaySeconds = isCountdown ? t.targetSeconds - t.secondsElapsed : t.secondsElapsed;
  const isPaused = !t.isRunning && t.secondsElapsed > 0;

  let subtitle = 'Ready to dive into deep work?';
  if (isBreak) {
    subtitle = t.isRunning
      ? 'On a break. Recharge.'
      : isPaused
      ? 'Break paused. Resume when ready.'
      : 'Step away and reset.';
  } else if (t.isRunning) subtitle = 'Deep focus in progress…';
  else if (isPaused) subtitle = 'Paused. Press resume to continue';

  const activeMode = MODES.find(m => m.value === t.mode);
  const customDisabled = t.isRunning || t.secondsElapsed > 0;

  // Custom and Break both expose H:M:S inputs, bound to their own state so they
  // don't clobber each other.
  const showDurationInputs = t.mode === 'custom' || isBreak;
  const durH = isBreak ? t.breakH : t.customH;
  const durM = isBreak ? t.breakM : t.customM;
  const durS = isBreak ? t.breakS : t.customS;
  const setDur = isBreak ? t.setBreakTime : t.setCustomTime;

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
          <SegmentedControl
            name="timer-mode" value={t.mode} onChange={t.applyMode}
            disabled={t.isRunning} fullWidth withItemsBorders={false}
            data={MODES.map(({ value, label }) => ({ value, label }))}
            className="sf-segmented" aria-label="Timer mode"
          />
          <div className="small mt-1" style={{ color: 'var(--muted-strong)' }}>
            {activeMode?.sub}
          </div>
        </div>

        <div className={`sf-timer-display${isBreak ? ' sf-break-display' : ''}`}>
          {formatClock(displaySeconds, { showHours: showDurationInputs })}
        </div>

        <div className={`sf-pill mb-3 mt-2${isBreak ? ' sf-pill-break' : ''}`} aria-hidden="true">
          {t.mode === 'pomodoro' && 'POMODORO MODE'}
          {t.mode === 'custom' && 'CUSTOM TIMER'}
          {t.mode === 'stopwatch' && 'STOPWATCH MODE'}
          {isBreak && 'BREAK MODE'}
        </div>

        {showDurationInputs && (
          <fieldset className="mb-3 text-start">
            <Form.Label as="legend" className="form-label small mb-1" style={{ color: 'var(--muted-strong)' }}>
              {isBreak ? 'Break duration' : 'Custom duration'}
            </Form.Label>
            <Row className="g-2">
              <Col>
                <Form.Group controlId="timer-dur-h">
                  <Form.Label className="visually-hidden">Hours</Form.Label>
                  <Form.Control
                    type="number"
                    min={0}
                    max={23}
                    step={1}
                    value={durH}
                    onChange={e => setDur(clamp(e.target.value, 23), durM, durS)}
                    disabled={customDisabled}
                    aria-label="Hours"
                  />
                  <div className="text-center small" style={{ color: 'var(--muted-strong)' }}>HR</div>
                </Form.Group>
              </Col>
              <Col>
                <Form.Group controlId="timer-dur-m">
                  <Form.Label className="visually-hidden">Minutes</Form.Label>
                  <Form.Control
                    type="number"
                    min={0}
                    max={59}
                    step={1}
                    value={durM}
                    onChange={e => setDur(durH, clamp(e.target.value, 59), durS)}
                    disabled={customDisabled}
                    aria-label="Minutes"
                  />
                  <div className="text-center small" style={{ color: 'var(--muted-strong)' }}>MIN</div>
                </Form.Group>
              </Col>
              <Col>
                <Form.Group controlId="timer-dur-s">
                  <Form.Label className="visually-hidden">Seconds</Form.Label>
                  <Form.Control
                    type="number"
                    min={0}
                    max={59}
                    step={1}
                    value={durS}
                    onChange={e => setDur(durH, durM, clamp(e.target.value, 59))}
                    disabled={customDisabled}
                    aria-label="Seconds"
                  />
                  <div className="text-center small" style={{ color: 'var(--muted-strong)' }}>SEC</div>
                </Form.Group>
              </Col>
            </Row>
          </fieldset>
        )}

        {isBreak ? (
          <div className="small mb-3" style={{ color: 'var(--muted-strong)' }}>
            Breaks are tracked separately and never count toward your study hours.
          </div>
        ) : (
          <Select
            id="timer-subject" label="Subject" className="sf-library-field mb-3 text-start"
            placeholder="Choose a subject" searchable allowDeselect={false}
            nothingFoundMessage="No matching subjects"
            value={t.subjectId ? String(t.subjectId) : (props.subjects?.[0] ? String(props.subjects[0].id) : null)}
            onChange={value => t.setSubjectId(value || '')}
            disabled={t.isRunning || !props.subjects?.length}
            data={(props.subjects || []).map(s => ({ value: String(s.id), label: s.name }))}
            comboboxProps={{ withinPortal: true, transitionProps: { transition: 'fade', duration: 120 } }}
          />
        )}

        {t.error && (
          <div role="alert" className="small mb-2" style={{ color: 'var(--danger-text)' }}>
            {t.error}
          </div>
        )}

        <div className="d-grid gap-2 mt-auto">
          {!t.isRunning ? (
            <Button variant={isBreak ? 'success' : 'primary'} size="lg" onClick={t.start}>
              <Icon name="play" className="me-2" />
              {isBreak
                ? (isPaused ? 'Resume Break' : 'Start Break')
                : (isPaused ? 'Resume Session' : 'Start Session')}
            </Button>
          ) : (
            <Button variant="warning" size="lg" onClick={t.pause}>
              <Icon name="pause" className="me-2" />Pause
            </Button>
          )}

          {!isBreak && (t.isRunning || isPaused) && (
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
              {isBreak ? 'End Break' : 'End Session'}
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
