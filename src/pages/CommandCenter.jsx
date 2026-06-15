import { useEffect, useMemo, useState } from 'react';
import {
  Container,
  Row,
  Col,
  Card,
  Button,
  Alert,
} from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { useStudyData } from '../context/StudyDataContext';
import { localDateString, shiftDateStr } from '../utils/sessions';
import {
  subjectKey,
  weekStartStr,
  plannedHoursFor,
  hasOnceOverride,
  legacyWeeklyHoursFor,
  subjectWeekPlanned,
  loggedHoursForWeek,
  feasibility,
  dayLoad,
} from '../utils/plan';

const DAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const IconChevronLeft = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M10 3L5 8l5 5" />
  </svg>
);

const IconChevronRight = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M6 3l5 5-5 5" />
  </svg>
);

const fmtDay = dateStr =>
  new Date(`${dateStr}T00:00:00`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });

const round1 = value => Math.round(value * 10) / 10;

function planEntryMatchesDraft(entry, draft) {
  return (
    String(entry.subjectId) === String(draft.subjectId) &&
    entry.scope === 'once' &&
    entry.date === draft.date
  );
}

function PlanCell({ value, onDraft, onCommit, ariaLabel }) {
  const [text, setText] = useState(value ? String(value) : '');
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!editing) setText(value ? String(value) : '');
  }, [value, editing]);

  function parseHours(raw) {
    return Math.max(0, Math.min(24, parseFloat(raw) || 0));
  }

  function commit() {
    const next = parseHours(text);
    onCommit(next);
    setText(next ? String(next) : '');
    setEditing(false);
  }

  function handleChange(event) {
    const nextText = event.target.value;
    setText(nextText);
    onDraft(parseHours(nextText));
  }

  return (
    <input
      type="number"
      min={0}
      max={24}
      step={0.5}
      inputMode="decimal"
      className={`sf-plan-cell${value ? ' sf-plan-cell-filled' : ''}`}
      value={text}
      placeholder="-"
      onFocus={() => setEditing(true)}
      onChange={handleChange}
      onBlur={commit}
      onKeyDown={event => {
        if (event.key === 'Enter') {
          event.preventDefault();
          event.currentTarget.blur();
        }
      }}
      aria-label={ariaLabel}
    />
  );
}

function PlannerView({ subjects, sessions, planEntries, upsertPlanEntry }) {
  const todayStr = localDateString();
  const [anchor, setAnchor] = useState(todayStr);
  const [draftEntries, setDraftEntries] = useState({});
  const [importing, setImporting] = useState(false);
  const [importNote, setImportNote] = useState('');

  const weekStart = weekStartStr(anchor);
  const thisWeekStart = weekStartStr(todayStr);
  const isThisWeek = weekStart === thisWeekStart;
  const isPastWeek = weekStart < thisWeekStart;
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, index) => shiftDateStr(weekStart, index)),
    [weekStart]
  );

  // Import feedback belongs to the week it ran on; clear it when navigating.
  useEffect(() => {
    setImportNote('');
  }, [weekStart]);

  function draftKey(subject, dateStr) {
    return `once:${subjectKey(subject)}:${dateStr}`;
  }

  function makeDraft(subject, dateStr, hours) {
    return { subjectId: subjectKey(subject), scope: 'once', date: dateStr, hours };
  }

  const effectivePlanEntries = useMemo(() => {
    const drafts = Object.values(draftEntries);
    return [
      ...planEntries.filter(entry => !drafts.some(draft => planEntryMatchesDraft(entry, draft))),
      ...drafts
        .filter(draft => draft.hours > 0)
        .map((draft, index) => ({ ...draft, id: `draft-${index}` })),
    ];
  }, [planEntries, draftEntries]);

  const loads = useMemo(
    () => dayLoad(effectivePlanEntries, subjects, weekStart),
    [effectivePlanEntries, subjects, weekStart]
  );

  const rows = useMemo(
    () =>
      subjects.map(subject => {
        const planned = subjectWeekPlanned(effectivePlanEntries, subject, weekStart);
        const logged = loggedHoursForWeek(sessions, subject, weekStart);
        return { subject, planned, logged, feas: feasibility(subject, planned) };
      }),
    [subjects, effectivePlanEntries, sessions, weekStart]
  );

  const overloadedDays = loads.filter(day => day.overloaded);
  const shortSubjects = rows.filter(row => row.feas.status === 'short');
  const goalSubjects = rows.filter(row => row.feas.status !== 'nogoal');
  const stretchSubjects = rows.filter(row => row.feas.status === 'stretch');

  const weekScheduled = round1(rows.reduce((acc, row) => acc + row.planned, 0));
  const weekLogged = round1(rows.reduce((acc, row) => acc + row.logged, 0));

  // The subhead doubles as a per-week recap so past weeks read as a review.
  let subhead = 'Plan the week, then watch logged time stack up against it.';
  if (isPastWeek) {
    subhead = weekScheduled > 0
      ? `Review: you logged ${weekLogged}h against ${weekScheduled}h planned this week.`
      : `Review: you logged ${weekLogged}h this week.`;
  } else if (!isThisWeek) {
    subhead = 'Planning ahead. Import last week to start fast.';
  }

  function handleDraft(subject, dateStr, hours) {
    const key = draftKey(subject, dateStr);
    const draft = makeDraft(subject, dateStr, hours);
    setDraftEntries(prev => ({ ...prev, [key]: draft }));
  }

  async function handleCommit(subject, dateStr, hours) {
    const key = subjectKey(subject);
    // Clearing a cell that a legacy recurring entry still fills needs an
    // explicit 0 stored, otherwise the legacy value would resurface.
    const legacyHours = legacyWeeklyHoursFor(planEntries, key, dateStr);
    await upsertPlanEntry(key, {
      scope: 'once',
      date: dateStr,
      hours,
      keepZero: hours <= 0 && legacyHours > 0,
    });
    const id = draftKey(subject, dateStr);
    setDraftEntries(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  // Copies last week's plan into this week's empty cells. Cells the user
  // already filled (or explicitly cleared) are never overwritten, so the
  // action is always safe to click.
  const prevWeekStart = shiftDateStr(weekStart, -7);
  const prevWeekHasPlan = useMemo(
    () => subjects.some(s => subjectWeekPlanned(planEntries, s, prevWeekStart) > 0),
    [subjects, planEntries, prevWeekStart]
  );

  async function importLastWeek() {
    setImporting(true);
    let slots = 0;
    let importedHours = 0;
    for (const subject of subjects) {
      const key = subjectKey(subject);
      for (let i = 0; i < 7; i++) {
        const fromHours = plannedHoursFor(planEntries, key, shiftDateStr(prevWeekStart, i));
        const toDate = shiftDateStr(weekStart, i);
        const alreadySet =
          hasOnceOverride(planEntries, key, toDate) ||
          plannedHoursFor(planEntries, key, toDate) > 0;
        if (fromHours > 0 && !alreadySet) {
          await upsertPlanEntry(key, { scope: 'once', date: toDate, hours: fromHours });
          slots += 1;
          importedHours += fromHours;
        }
      }
    }
    setImporting(false);
    setImportNote(
      slots > 0
        ? `Imported ${round1(importedHours)}h into ${slots} open slot${slots === 1 ? '' : 's'} from last week.`
        : 'Nothing new to import. Your filled cells were left untouched.'
    );
  }

  return (
    <>
      <div className="d-flex justify-content-between align-items-start flex-wrap gap-3 mb-3">
        <div>
          <h2 className="h4 mb-1">Weekly Planner</h2>
          <p className="mb-0" style={{ color: 'var(--muted-strong)' }}>
            {subhead}
          </p>
        </div>
        <div className="d-flex align-items-center gap-2 flex-wrap">
          <Button
            variant="outline-secondary"
            size="sm"
            onClick={() => setAnchor(shiftDateStr(weekStart, -7))}
            aria-label="Previous week"
          >
            <IconChevronLeft /> <span className="ms-1">Prev</span>
          </Button>
          <Button
            variant={isThisWeek ? 'primary' : 'outline-secondary'}
            size="sm"
            onClick={() => setAnchor(todayStr)}
            disabled={isThisWeek}
          >
            This week
          </Button>
          <span className="small fw-semibold" style={{ minWidth: 150, textAlign: 'center' }}>
            {fmtDay(days[0])} - {fmtDay(days[6])}
          </span>
          <Button
            variant="outline-secondary"
            size="sm"
            onClick={() => setAnchor(shiftDateStr(weekStart, 7))}
            aria-label="Next week"
          >
            <span className="me-1">Next</span> <IconChevronRight />
          </Button>
        </div>
      </div>

      <div className="d-flex align-items-center gap-3 mb-3 flex-wrap">
        <Button
          variant="outline-primary"
          size="sm"
          onClick={importLastWeek}
          disabled={importing || !prevWeekHasPlan}
        >
          {importing ? 'Importing…' : 'Import last week'}
        </Button>
        <span className="small" style={{ color: 'var(--muted-strong)' }} role="status">
          {importNote ||
            (prevWeekHasPlan
              ? "Edits apply to the week shown. Import copies last week's plan into empty cells."
              : 'Edits apply to the week shown.')}
        </span>
      </div>

      {overloadedDays.length > 0 ? (
        <Alert variant="warning" className="py-2 sf-plan-insight">
          {DAY_ABBR[new Date(`${overloadedDays[0].date}T00:00:00`).getDay()]} {fmtDay(overloadedDays[0].date)} is a big day
          ({overloadedDays[0].hours}h scheduled). Great if that is exam prep, otherwise spread a few hours out to stay fresh.
        </Alert>
      ) : shortSubjects.length > 0 ? (
        <Alert variant="info" className="py-2 sf-plan-insight">
          Your plan covers {goalSubjects.length - shortSubjects.length} of {goalSubjects.length} weekly goals so far.{' '}
          {shortSubjects.length === 1 ? '1 subject has' : `${shortSubjects.length} subjects have`} room to grow. Add hours where the week is open.
        </Alert>
      ) : stretchSubjects.length > 0 ? (
        <Alert variant="info" className="py-2 sf-plan-insight">
          {stretchSubjects.length} subject{stretchSubjects.length > 1 ? 's have' : ' has'} extra time scheduled above goal. That can be useful for tests or projects; keep the week realistic.
        </Alert>
      ) : goalSubjects.length > 0 ? (
        <Alert variant="success" className="py-2 sf-plan-insight">Your plan covers every weekly goal this week.</Alert>
      ) : null}

      <Card className="sf-card-panel mb-4">
        <Card.Body>
          <div className="sf-plan-grid-wrap">
            <table className="sf-plan-grid">
              <thead>
                <tr>
                  <th className="sf-plan-subject-head">Subject</th>
                  {days.map((dateStr, index) => (
                    <th key={dateStr} className={`sf-plan-day-head${dateStr === todayStr ? ' sf-plan-today' : ''}`}>
                      <div>{DAY_ABBR[index]}</div>
                      <div className="sf-plan-day-date">{new Date(`${dateStr}T00:00:00`).getDate()}</div>
                    </th>
                  ))}
                  <th className="sf-plan-total-head">Scheduled / Goal</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ subject, planned, feas }) => (
                  <tr key={subject.firestoreId || subject.id}>
                    <td className="sf-plan-subject-cell">
                      <span className="sf-habit-dot" style={{ background: subject.color }} aria-hidden="true" />
                      <span className="fw-semibold">{subject.name}</span>
                    </td>
                    {days.map(dateStr => {
                      const dow = new Date(`${dateStr}T00:00:00`).getDay();
                      const key = subjectKey(subject);
                      const display = plannedHoursFor(effectivePlanEntries, key, dateStr);
                      return (
                        <td key={dateStr} className={dateStr === todayStr ? 'sf-plan-today' : ''}>
                          <PlanCell
                            key={dateStr}
                            value={display}
                            onDraft={hours => handleDraft(subject, dateStr, hours)}
                            onCommit={hours => handleCommit(subject, dateStr, hours)}
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
                  {loads.map(load => (
                    <td
                      key={load.date}
                      className={`text-center small${load.overloaded ? ' sf-feas-heavy' : ''}${load.date === todayStr ? ' sf-plan-today' : ''}`}
                    >
                      {load.hours ? `${load.hours}h` : '-'}
                    </td>
                  ))}
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        </Card.Body>
      </Card>

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
                  Scheduled {round1(planned)}h / logged {round1(logged)}h this week
                </div>
              </Card.Body>
            </Card>
          </Col>
        ))}
      </Row>
    </>
  );
}

export default function CommandCenter() {
  // Habit Tracker is archived until v3; Command Center only exposes weekly
  // planning in the active app.
  const studyData = useStudyData();
  const {
    subjects,
    sessions,
    planEntries,
    upsertPlanEntry,
  } = studyData;

  if (subjects.length === 0) {
    return (
      <Container fluid className="sf-page">
        <div className="sf-empty-hero">
          <h1 className="sf-empty-title">Command Center starts with subjects.</h1>
          <p className="sf-empty-sub">Create a subject first, then plan weekly hours here.</p>
          <Button as={Link} to="/app/subjects" variant="primary" size="lg">
            Create a subject
          </Button>
        </div>
      </Container>
    );
  }

  return (
    <Container fluid className="sf-page sf-command-page">
      <div className="sf-page-header d-flex justify-content-between align-items-start flex-wrap gap-3 mb-4">
        <div>
          <div className="sf-section-label" style={{ color: 'var(--muted-strong)' }}>
            COMMAND CENTER
          </div>
          <h1 className="mb-1 mt-1">Plan</h1>
        </div>
      </div>

      <PlannerView
        subjects={subjects}
        sessions={sessions}
        planEntries={planEntries}
        upsertPlanEntry={upsertPlanEntry}
      />
    </Container>
  );
}
