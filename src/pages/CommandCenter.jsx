import { Fragment, useMemo, useState } from 'react';
import { Container, Card, Button, Alert } from 'react-bootstrap';
import { Link, useSearchParams } from 'react-router-dom';
import { useStudyData } from '../context/StudyDataContext';
import GoalEditor from '../components/GoalEditor';
import Icon from '../components/Icon';
import { localDateString, shiftDateStr } from '../utils/sessions';
import { subjectKey, weekStartStr, plannedHoursFor, hasOnceOverride, subjectWeekPlanned, loggedHoursFor, dayLoad } from '../utils/plan';
import { formatStudyTime, formatWeekRange, weekProgress } from '../utils/progress';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function PlanCell({ value, onDraft, onCommit, ariaLabel }) {
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const text = draft ?? (value > 0 ? String(value) : '');
  const parseHours = raw => {
    const number = Number(raw);
    return Number.isFinite(number) ? Math.max(0, Math.min(24, number)) : 0;
  };
  async function commit() {
    if (draft === null) return;
    const next = parseHours(text);
    setSaving(true);
    try {
      await onCommit(next);
      setDraft(null);
    } finally {
      setSaving(false);
    }
  }
  return (
    <input type="number" min={0} max={24} step="any" inputMode="decimal"
      className={`sf-plan-cell${value > 0 ? ' sf-plan-cell-filled' : ''}`}
      value={text} disabled={saving} placeholder="–"
      onChange={event => { setDraft(event.target.value); onDraft(parseHours(event.target.value)); }}
      onBlur={commit} onKeyDown={event => {
        if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); }
      }} aria-label={ariaLabel} />
  );
}

function PlannerView({ subjects, sessions, planEntries, upsertPlanEntry, updateSubject, initialAnchor }) {
  const today = localDateString();
  const [anchor, setAnchor] = useState(initialAnchor || today);
  const [drafts, setDrafts] = useState({});
  const [importing, setImporting] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [editingKey, setEditingKey] = useState(null);
  const start = weekStartStr(anchor);
  const isThisWeek = start === weekStartStr(today);
  const keyFor = (subject, date) => `${subjectKey(subject)}:${date}`;
  const effectiveEntries = useMemo(() => [
    ...planEntries.filter(entry => !Object.values(drafts).some(draft => entry.scope === 'once' && String(entry.subjectId) === draft.subjectId && entry.date === draft.date)),
    ...Object.values(drafts),
  ], [planEntries, drafts]);
  const weekly = useMemo(() => weekProgress({ subjects, sessions, planEntries: effectiveEntries, anchorDate: start, today }),
    [subjects, sessions, effectiveEntries, start, today]);
  const loads = dayLoad(effectiveEntries, subjects, start);
  const overloaded = loads.filter(day => day.overloaded);
  const previousStart = shiftDateStr(start, -7);
  const previousHasPlan = subjects.some(subject => subjectWeekPlanned(planEntries, subject, previousStart) > 0);
  const openSlots = weekly.days.some(day => subjects.some(subject => !hasOnceOverride(effectiveEntries, subjectKey(subject), day.date)
    && plannedHoursFor(effectiveEntries, subjectKey(subject), day.date) === 0));

  function navigate(next) {
    setAnchor(next);
    setFeedback(null);
    setEditingKey(null);
  }
  function draft(subject, date, hours) {
    setDrafts(current => ({ ...current, [keyFor(subject, date)]: { subjectId: subjectKey(subject), scope: 'once', date, hours } }));
  }
  async function commit(subject, date, hours) {
    try {
      // Explicit clears also protect this cell from a later import.
      await upsertPlanEntry(subjectKey(subject), { scope: 'once', date, hours, keepZero: hours <= 0 });
      setDrafts(current => {
        const key = keyFor(subject, date);
        if (current[key]?.hours !== hours) return current;
        const next = { ...current };
        delete next[key];
        return next;
      });
    } catch {
      setFeedback({ week: start, error: true, text: 'This scheduled time could not be saved. Try editing the cell again.' });
    }
  }
  async function importLastWeek() {
    setImporting(true);
    setFeedback(null);
    let slots = 0;
    let hours = 0;
    try {
      for (const subject of subjects) {
        const key = subjectKey(subject);
        for (let index = 0; index < 7; index++) {
          const from = plannedHoursFor(planEntries, key, shiftDateStr(previousStart, index));
          const to = shiftDateStr(start, index);
          if (from > 0 && !hasOnceOverride(effectiveEntries, key, to) && plannedHoursFor(effectiveEntries, key, to) === 0) {
            await upsertPlanEntry(key, { scope: 'once', date: to, hours: from });
            slots += 1;
            hours += from;
          }
        }
      }
      setFeedback({ week: start, text: slots > 0 ? `Imported ${formatStudyTime(hours * 60)} into ${slots} empty slot${slots === 1 ? '' : 's'}.` : 'No empty slots to import. Filled and cleared cells were preserved.' });
    } catch {
      setFeedback({ week: start, error: true, text: 'Import stopped before finishing. Saved cells are preserved; try again to fill the remaining slots.' });
    } finally {
      setImporting(false);
    }
  }

  return (
    <>
      <div className="sf-command-week d-flex align-items-center justify-content-between flex-wrap gap-3 mb-4">
        <div><strong>{formatWeekRange(start)}</strong><span className="d-block small text-muted">Sunday–Saturday · {isThisWeek ? 'This week' : start < weekStartStr(today) ? 'Past week' : 'Planning ahead'}</span></div>
        <div className="d-flex align-items-center flex-wrap gap-2">
          <Button size="sm" variant="outline-secondary" aria-label="Previous week" disabled={importing} onClick={() => navigate(shiftDateStr(start, -7))}>‹ Prev</Button>
          <Button size="sm" variant={isThisWeek ? 'primary' : 'outline-secondary'} disabled={isThisWeek || importing} onClick={() => navigate(today)}>This week</Button>
          <Button size="sm" variant="outline-secondary" aria-label="Next week" disabled={importing} onClick={() => navigate(shiftDateStr(start, 7))}>Next ›</Button>
        </div>
      </div>
      <section id="weekly-planner" aria-labelledby="planner-title">
        <div className="d-flex justify-content-between align-items-start flex-wrap gap-3 mb-3">
          <h2 className="h4 mb-0" id="planner-title">Weekly Planner</h2>
          <Button variant="outline-primary" size="sm" onClick={importLastWeek}
            disabled={importing || !previousHasPlan || !openSlots || Object.keys(drafts).length > 0}>
            {importing ? 'Importing…' : 'Import last week'}
          </Button>
        </div>
        {feedback?.week === start && <Alert variant={feedback.error ? 'danger' : 'info'} className="py-2" role="status">{feedback.text}</Alert>}
        {overloaded.length > 0 && <Alert variant="warning" className="py-2 sf-plan-insight">
          {DAYS[new Date(`${overloaded[0].date}T00:00:00`).getDay()]} has {formatStudyTime(overloaded[0].hours * 60)} scheduled. Consider spreading the workload across the week.
        </Alert>}
        <Card className="sf-card-panel">
          <Card.Body>
            <div className="sf-plan-grid-wrap" tabIndex={0} role="region" aria-label="Weekly schedule; scroll horizontally on small screens">
              <table className="sf-plan-grid">
                <caption className="visually-hidden">Scheduled hours and logged study for {formatWeekRange(start)}. Edit hours in each day. Logged time counts toward weekly goals independently.</caption>
                <thead><tr>
                  <th scope="col" className="sf-plan-subject-head">Subject</th>
                  {weekly.days.map((day, index) => <th scope="col" key={day.date} className={`sf-plan-day-head${day.date === today ? ' sf-plan-today' : ''}`}>
                    <div>{DAYS[index]}</div><div className="sf-plan-day-date">{new Date(`${day.date}T00:00:00`).getDate()}</div>
                  </th>)}
                  <th scope="col" className="sf-plan-total-head">Weekly progress</th>
                </tr></thead>
                <tbody>
                  {weekly.rows.map(({ subject, loggedMinutes, plannedMinutes, goalMinutes, goalPct, goalMet, remainingMinutes }) => <Fragment key={subjectKey(subject)}>
                    <tr>
                      <th scope="row" className="sf-plan-subject-cell"><div className="d-flex align-items-center gap-2">
                        <span className="sf-habit-dot" style={{ background: subject.color }} aria-hidden="true" /><span className="fw-semibold">{subject.name}</span>
                      </div></th>
                      {weekly.days.map((day, index) => {
                        const planned = plannedHoursFor(effectiveEntries, subjectKey(subject), day.date);
                        const logged = day.isFuture ? 0 : loggedHoursFor(sessions, subject, day.date) * 60;
                        const done = planned > 0 && logged >= planned * 60;
                        return <td key={day.date} className={day.date === today ? 'sf-plan-today' : ''}>
                          <PlanCell value={planned} onDraft={hours => draft(subject, day.date, hours)} onCommit={hours => commit(subject, day.date, hours)} ariaLabel={`${subject.name} planned hours on ${DAYS[index]}, ${day.date}`} />
                          <div className={`sf-plan-logged${done ? ' is-complete' : ''}`}>
                            {done && <Icon name="check" size={12} />}{logged > 0 ? `${formatStudyTime(logged)} studied` : day.isFuture ? 'Upcoming' : '0m studied'}
                          </div>
                        </td>;
                      })}
                      <td className="sf-plan-total-cell">
                        <div className="sf-planner-progress">
                          <strong className="small">{formatStudyTime(loggedMinutes)} studied{goalMinutes > 0 ? ` / ${formatStudyTime(goalMinutes)} goal` : ''}</strong>
                          {goalMinutes > 0 ? <>
                            <div className="sf-plan-bar" role="progressbar" aria-label={`${subject.name} weekly goal progress`}
                              aria-valuenow={goalPct} aria-valuemin={0} aria-valuemax={100}
                              aria-valuetext={`${formatStudyTime(loggedMinutes)} studied of ${formatStudyTime(goalMinutes)} goal`}>
                              <div className="sf-plan-bar-fill" style={{ width: `${goalPct}%`, background: subject.color }} />
                            </div>
                            {goalMet
                              ? <span className="sf-goal-complete" role="status" aria-label={`${subject.name} weekly goal reached`}><Icon name="check" size={14} /> Goal reached</span>
                              : <span className="sf-planner-progress-detail text-muted">{goalPct}% · {formatStudyTime(remainingMinutes)} to go</span>}
                          </> : <span className="sf-planner-progress-detail text-muted">No weekly goal set</span>}
                          <div className="d-flex justify-content-between align-items-center gap-2">
                            <span className="sf-planner-progress-detail text-muted">{formatStudyTime(plannedMinutes)} planned</span>
                            <Button variant="link" size="sm" className="p-0 text-nowrap"
                              aria-label={`${goalMinutes > 0 ? 'Edit' : 'Set'} ${subject.name} weekly goal`}
                              aria-expanded={editingKey === subjectKey(subject)}
                              onClick={() => setEditingKey(current => current === subjectKey(subject) ? null : subjectKey(subject))}>
                              {goalMinutes > 0 ? 'Edit goal' : 'Set goal'}
                            </Button>
                          </div>
                        </div>
                      </td>
                    </tr>
                    {editingKey === subjectKey(subject) && <tr className="sf-plan-goal-row"><td colSpan={9}>
                      <GoalEditor subject={subject} onSave={updateSubject} onCancel={() => setEditingKey(null)} />
                    </td></tr>}
                  </Fragment>)}
                  <tr className="sf-plan-load-row">
                    <th scope="row" className="sf-plan-subject-cell text-muted small">Scheduled total</th>
                    {loads.map(load => <td key={load.date} className={`small${load.overloaded ? ' sf-feas-heavy' : ''}`}>{formatStudyTime(load.hours * 60)}</td>)}
                    <td className="sf-plan-total-cell small fw-semibold">{formatStudyTime(weekly.plannedMinutes)}</td>
                  </tr>
                  <tr>
                    <th scope="row" className="sf-plan-subject-cell text-muted small">Studied total</th>
                    {weekly.days.map(day => <td key={day.date} className="small">{formatStudyTime(day.minutes)}</td>)}
                    <td className="sf-plan-total-cell small fw-semibold">{formatStudyTime(weekly.totalMinutes)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card.Body>
        </Card>
      </section>
    </>
  );
}

export default function CommandCenter() {
  const { subjects, sessions, planEntries, upsertPlanEntry, updateSubject } = useStudyData();
  const [searchParams] = useSearchParams();
  const requestedWeek = searchParams.get('week');
  const initialAnchor = /^\d{4}-\d{2}-\d{2}$/.test(requestedWeek || '') ? requestedWeek : null;
  if (subjects.length === 0) {
    return <Container fluid className="sf-page"><div className="sf-empty-hero">
      <h1 className="sf-empty-title">Command Center starts with subjects.</h1>
      <p className="sf-empty-sub">Create a subject, then set goals and plan your week here.</p>
      <Button as={Link} to="/app/subjects" size="lg">Create a subject</Button>
    </div></Container>;
  }
  return (
    <Container fluid className="sf-page sf-command-page">
      <div className="sf-page-header d-flex justify-content-between align-items-start flex-wrap gap-3 mb-4">
        <div><div className="sf-section-label">COMMAND CENTER</div><h1 className="mb-1 mt-1">Goals & Planning</h1><p className="mb-0 text-muted">Set your targets, plan your time, and follow your progress.</p></div>
        <Button as={Link} to="/app/subjects" variant="outline-secondary" size="sm">Manage subjects</Button>
      </div>
      <PlannerView subjects={subjects} sessions={sessions} planEntries={planEntries} upsertPlanEntry={upsertPlanEntry} updateSubject={updateSubject} initialAnchor={initialAnchor} />
    </Container>
  );
}
