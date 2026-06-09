import { useMemo, useState } from 'react';
import {
  Container, Row, Col, Card, Form, Button, Alert,
  ToggleButtonGroup, ToggleButton,
} from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { useStudyData } from '../context/StudyDataContext';
import { localDateString, shiftDateStr } from '../utils/sessions';
import {
  subjectKey,
  weekStartStr,
  plannedHoursFor,
  hasOnceOverride,
  subjectWeekPlanned,
  loggedHoursForWeek,
  feasibility,
  dayLoad,
  OVERLOAD_HOURS,
} from '../utils/plan';

const DAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const IconChevronLeft = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 3L5 8l5 5" /></svg>
);
const IconChevronRight = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 3l5 5-5 5" /></svg>
);

const fmtDay = d => new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const round1 = n => Math.round(n * 10) / 10;

// Raw recurring value for a weekday (ignores once-overrides) — used in weekly
// edit mode so the cell shows the template it's editing.
function weeklyHoursFor(planEntries, key, dow) {
  const e = planEntries.find(x => x.scope === 'weekly' && String(x.subjectId) === key && x.day === dow);
  return e ? e.hours || 0 : 0;
}

// A single editable hours cell. Holds its own text so we only write to the
// store on blur/Enter (one write per edit, not per keystroke). The parent gives
// it a `key` tied to the resolved value, so it re-inits when the plan changes.
function PlanCell({ value, override, onCommit, ariaLabel }) {
  const [text, setText] = useState(value ? String(value) : '');

  function commit() {
    const n = Math.max(0, Math.min(24, parseFloat(text) || 0));
    onCommit(n);
    setText(n ? String(n) : '');
  }

  return (
    <input
      type="number"
      min={0}
      max={24}
      step={0.5}
      inputMode="decimal"
      className={`sf-plan-cell${override ? ' sf-plan-cell-override' : ''}${value ? ' sf-plan-cell-filled' : ''}`}
      value={text}
      placeholder="–"
      onChange={e => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
      aria-label={ariaLabel}
    />
  );
}

export default function CommandCenter() {
  const { subjects, sessions, planEntries, upsertPlanEntry } = useStudyData();
  const todayStr = localDateString();

  const [anchor, setAnchor] = useState(todayStr);
  const [scope, setScope] = useState('weekly'); // 'weekly' = recurring, 'once' = this week only

  const weekStart = weekStartStr(anchor);
  const thisWeekStart = weekStartStr(todayStr);
  const isThisWeek = weekStart === thisWeekStart;
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => shiftDateStr(weekStart, i)),
    [weekStart]
  );

  const loads = useMemo(() => dayLoad(planEntries, subjects, weekStart), [planEntries, subjects, weekStart]);

  // Feasibility per subject for the displayed week.
  const rows = useMemo(
    () =>
      subjects.map(s => {
        const planned = subjectWeekPlanned(planEntries, s, weekStart);
        const logged = loggedHoursForWeek(sessions, s, weekStart);
        return { subject: s, planned, logged, feas: feasibility(s, planned) };
      }),
    [subjects, planEntries, sessions, weekStart]
  );

  // Overall banner: overloaded days first (hard problem), then shortfalls.
  const overloadedDays = loads.filter(d => d.overloaded);
  const shortSubjects = rows.filter(r => r.feas.status === 'short');
  const goalSubjects = rows.filter(r => r.feas.status !== 'nogoal');

  function handleCommit(subject, dateStr, hours) {
    const key = subjectKey(subject);
    if (scope === 'weekly') {
      upsertPlanEntry(key, { scope: 'weekly', day: new Date(`${dateStr}T00:00:00`).getDay(), hours });
    } else {
      upsertPlanEntry(key, { scope: 'once', date: dateStr, hours });
    }
  }

  if (subjects.length === 0) {
    return (
      <Container fluid className="sf-page">
        <div className="sf-empty-hero">
          <h1 className="sf-empty-title">Plan your week around your subjects.</h1>
          <p className="sf-empty-sub">Create a subject with a weekly goal first, then distribute it across the week here.</p>
          <Button as={Link} to="/subjects" variant="primary" size="lg">Create a subject</Button>
        </div>
      </Container>
    );
  }

  return (
    <Container fluid className="sf-page">
      {/* Header + week navigator */}
      <div className="d-flex justify-content-between align-items-start flex-wrap gap-3 mb-4">
        <div>
          <div className="sf-section-label" style={{ color: 'var(--muted-strong)', letterSpacing: '0.1em' }}>COMMAND CENTER</div>
          <h1 className="mb-1 mt-1">Plan your week</h1>
          <p className="mb-0" style={{ color: 'var(--muted-strong)' }}>Distribute each subject's weekly goal across the days. Sessions you log fill it in automatically.</p>
        </div>
        <div className="d-flex align-items-center gap-2 flex-wrap">
          <Button variant="outline-secondary" size="sm" onClick={() => setAnchor(shiftDateStr(weekStart, -7))} aria-label="Previous week">
            <IconChevronLeft /> <span className="ms-1">Prev</span>
          </Button>
          <Button variant={isThisWeek ? 'primary' : 'outline-secondary'} size="sm" onClick={() => setAnchor(todayStr)} disabled={isThisWeek}>This week</Button>
          <span className="small fw-semibold" style={{ minWidth: 150, textAlign: 'center' }}>
            {fmtDay(days[0])} – {fmtDay(days[6])}
          </span>
          <Button variant="outline-secondary" size="sm" onClick={() => setAnchor(shiftDateStr(weekStart, 7))} aria-label="Next week">
            <span className="me-1">Next</span> <IconChevronRight />
          </Button>
        </div>
      </div>

      {/* Recurrence toggle */}
      <div className="d-flex align-items-center gap-3 mb-3 flex-wrap">
        <ToggleButtonGroup type="radio" name="plan-scope" value={scope} onChange={setScope}>
          <ToggleButton id="scope-weekly" value="weekly" variant={scope === 'weekly' ? 'primary' : 'outline-primary'} size="sm">
            Repeat weekly
          </ToggleButton>
          <ToggleButton id="scope-once" value="once" variant={scope === 'once' ? 'primary' : 'outline-primary'} size="sm">
            This week only
          </ToggleButton>
        </ToggleButtonGroup>
        <span className="small" style={{ color: 'var(--muted-strong)' }}>
          {scope === 'weekly'
            ? 'Edits set your recurring plan — it repeats every week.'
            : 'Edits apply to this week only and override the recurring plan.'}
        </span>
      </div>

      {/* Overall feasibility banner */}
      {overloadedDays.length > 0 ? (
        <Alert variant="danger" className="py-2">
          {DAY_ABBR[new Date(`${overloadedDays[0].date}T00:00:00`).getDay()]} {fmtDay(overloadedDays[0].date)} is overloaded
          ({overloadedDays[0].hours}h planned). That's more than {OVERLOAD_HOURS}h — spread it across more days.
        </Alert>
      ) : shortSubjects.length > 0 ? (
        <Alert variant="warning" className="py-2">
          {shortSubjects.length} subject{shortSubjects.length > 1 ? 's are' : ' is'} short of the weekly goal this week. Add hours below or your plan won't hit the target.
        </Alert>
      ) : goalSubjects.length > 0 ? (
        <Alert variant="success" className="py-2">Your plan covers every weekly goal this week. ✓</Alert>
      ) : null}

      {/* Planner grid */}
      <Card className="sf-card-panel mb-4">
        <Card.Body>
          <div className="sf-plan-grid-wrap">
            <table className="sf-plan-grid">
              <thead>
                <tr>
                  <th className="sf-plan-subject-head">Subject</th>
                  {days.map((d, i) => (
                    <th key={d} className={`sf-plan-day-head${d === todayStr ? ' sf-plan-today' : ''}`}>
                      <div>{DAY_ABBR[i]}</div>
                      <div className="sf-plan-day-date">{new Date(`${d}T00:00:00`).getDate()}</div>
                    </th>
                  ))}
                  <th className="sf-plan-total-head">Planned / Goal</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ subject, planned, feas }) => (
                  <tr key={subject.firestoreId || subject.id}>
                    <td className="sf-plan-subject-cell">
                      <span className="sf-habit-dot" style={{ background: subject.color }} aria-hidden="true" />
                      <span className="fw-semibold">{subject.name}</span>
                    </td>
                    {days.map((d) => {
                      const dow = new Date(`${d}T00:00:00`).getDay();
                      const key = subjectKey(subject);
                      const display = scope === 'weekly'
                        ? weeklyHoursFor(planEntries, key, dow)
                        : plannedHoursFor(planEntries, key, d);
                      const override = scope === 'once' && hasOnceOverride(planEntries, key, d);
                      return (
                        <td key={d} className={d === todayStr ? 'sf-plan-today' : ''}>
                          <PlanCell
                            key={`${scope}-${d}-${display}`}
                            value={display}
                            override={override}
                            onCommit={h => handleCommit(subject, d, h)}
                            ariaLabel={`${subject.name} hours on ${DAY_ABBR[dow]}`}
                          />
                        </td>
                      );
                    })}
                    <td className="sf-plan-total-cell">
                      <div className={`small fw-semibold sf-feas-${feas.status}`}>
                        {round1(planned)}h{subject.weeklyGoal ? ` / ${subject.weeklyGoal}h` : ''}
                      </div>
                      {subject.weeklyGoal > 0 && (
                        <div className="sf-plan-bar" aria-hidden="true">
                          <div className={`sf-plan-bar-fill sf-feas-bg-${feas.status}`} style={{ width: `${feas.pct}%` }} />
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                <tr className="sf-plan-load-row">
                  <td className="sf-plan-subject-cell text-muted small">Day total</td>
                  {loads.map(l => (
                    <td key={l.date} className={`text-center small${l.overloaded ? ' sf-feas-over' : ''}${l.date === todayStr ? ' sf-plan-today' : ''}`}>
                      {l.hours ? `${l.hours}h` : '–'}
                    </td>
                  ))}
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        </Card.Body>
      </Card>

      {/* Per-subject feasibility detail */}
      <Row className="g-3">
        {rows.map(({ subject, planned, logged, feas }) => (
          <Col md={6} lg={4} key={subject.firestoreId || subject.id}>
            <Card className="h-100 sf-card-panel">
              <Card.Body>
                <div className="d-flex align-items-center gap-2 mb-2">
                  <span className="sf-habit-dot" style={{ background: subject.color }} aria-hidden="true" />
                  <span className="fw-semibold">{subject.name}</span>
                </div>
                <div className="sf-plan-bar mb-2" aria-hidden="true">
                  <div className={`sf-plan-bar-fill sf-feas-bg-${feas.status}`} style={{ width: `${feas.pct}%` }} />
                </div>
                <div className={`small fw-semibold sf-feas-${feas.status}`}>{feas.message}</div>
                <div className="small text-muted mt-1">
                  Planned {round1(planned)}h · logged {round1(logged)}h this week
                </div>
              </Card.Body>
            </Card>
          </Col>
        ))}
      </Row>
    </Container>
  );
}
