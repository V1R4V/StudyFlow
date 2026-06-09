import { useMemo, useState } from 'react';
import {
  Container,
  Row,
  Col,
  Card,
  Form,
  Button,
  Alert,
  ButtonGroup,
  ToggleButtonGroup,
  ToggleButton,
} from 'react-bootstrap';
import { Link } from 'react-router-dom';
import StatsCard from '../components/StatsCard';
import HabitChecklist from '../components/HabitChecklist';
import HabitForm from '../components/HabitForm';
import HabitHeatmap from '../components/HabitHeatmap';
import { useStudyData } from '../context/StudyDataContext';
import { localDateString, shiftDateStr } from '../utils/sessions';
import {
  dayGrade,
  weekGrade,
  dayCounts,
  gradeTrend,
  dowAverages,
  gradeColor,
  PRIORITY_LABELS,
} from '../utils/habits';
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

const IconGrade = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 2.5l2.2 4.5 5 .7-3.6 3.5.85 5L10 13.9 5.55 16.2l.85-5L2.8 7.7l5-.7z" />
  </svg>
);

const IconCalendar = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="14" height="13" rx="2" />
    <path d="M3 8h14M7 2.5v3M13 2.5v3" />
  </svg>
);

const IconCheck = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="10" cy="10" r="7.5" />
    <path d="M7 10.5l2.5 2.5L13 8" />
  </svg>
);

const IconList = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M7 5h10M7 10h10M7 15h10M3.5 5h.01M3.5 10h.01M3.5 15h.01" />
  </svg>
);

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

function gradeText(grade) {
  return grade === null || grade === undefined ? '-' : String(grade);
}

function scheduleSummary(days) {
  if (!Array.isArray(days) || days.length === 0) return 'Unscheduled';
  if (days.length === 7) return 'Every day';
  const weekdays = [1, 2, 3, 4, 5];
  if (days.length === 5 && weekdays.every(day => days.includes(day))) return 'Weekdays';
  return days.map(day => DAY_ABBR[day]).join(' ');
}

const fmtDay = dateStr =>
  new Date(`${dateStr}T00:00:00`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });

const round1 = value => Math.round(value * 10) / 10;

function weeklyHoursFor(planEntries, key, dow) {
  const entry = planEntries.find(
    item => item.scope === 'weekly' && String(item.subjectId) === key && item.day === dow
  );
  return entry ? entry.hours || 0 : 0;
}

function PlanCell({ value, override, onCommit, ariaLabel }) {
  const [text, setText] = useState(value ? String(value) : '');

  function commit() {
    const next = Math.max(0, Math.min(24, parseFloat(text) || 0));
    onCommit(next);
    setText(next ? String(next) : '');
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
      placeholder="-"
      onChange={event => setText(event.target.value)}
      onBlur={commit}
      onKeyDown={event => {
        if (event.key === 'Enter') event.currentTarget.blur();
      }}
      aria-label={ariaLabel}
    />
  );
}

function PlannerView({ subjects, sessions, planEntries, upsertPlanEntry }) {
  const todayStr = localDateString();
  const [anchor, setAnchor] = useState(todayStr);
  const [scope, setScope] = useState('weekly');

  const weekStart = weekStartStr(anchor);
  const thisWeekStart = weekStartStr(todayStr);
  const isThisWeek = weekStart === thisWeekStart;
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, index) => shiftDateStr(weekStart, index)),
    [weekStart]
  );

  const loads = useMemo(
    () => dayLoad(planEntries, subjects, weekStart),
    [planEntries, subjects, weekStart]
  );

  const rows = useMemo(
    () =>
      subjects.map(subject => {
        const planned = subjectWeekPlanned(planEntries, subject, weekStart);
        const logged = loggedHoursForWeek(sessions, subject, weekStart);
        return { subject, planned, logged, feas: feasibility(subject, planned) };
      }),
    [subjects, planEntries, sessions, weekStart]
  );

  const overloadedDays = loads.filter(day => day.overloaded);
  const shortSubjects = rows.filter(row => row.feas.status === 'short');
  const goalSubjects = rows.filter(row => row.feas.status !== 'nogoal');

  function handleCommit(subject, dateStr, hours) {
    const key = subjectKey(subject);
    if (scope === 'weekly') {
      upsertPlanEntry(key, {
        scope: 'weekly',
        day: new Date(`${dateStr}T00:00:00`).getDay(),
        hours,
      });
    } else {
      upsertPlanEntry(key, { scope: 'once', date: dateStr, hours });
    }
  }

  return (
    <>
      <div className="d-flex justify-content-between align-items-start flex-wrap gap-3 mb-3">
        <div>
          <h2 className="h4 mb-1">Weekly Planner</h2>
          <p className="mb-0" style={{ color: 'var(--muted-strong)' }}>
            Distribute weekly goals, then compare planned time against logged sessions.
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
            ? 'Edits set your recurring plan.'
            : 'Edits apply only to this displayed week.'}
        </span>
      </div>

      {overloadedDays.length > 0 ? (
        <Alert variant="danger" className="py-2">
          {DAY_ABBR[new Date(`${overloadedDays[0].date}T00:00:00`).getDay()]} {fmtDay(overloadedDays[0].date)} is overloaded
          ({overloadedDays[0].hours}h planned). Keep days under {OVERLOAD_HOURS}h.
        </Alert>
      ) : shortSubjects.length > 0 ? (
        <Alert variant="warning" className="py-2">
          {shortSubjects.length} subject{shortSubjects.length > 1 ? 's are' : ' is'} short of the weekly goal.
        </Alert>
      ) : goalSubjects.length > 0 ? (
        <Alert variant="success" className="py-2">Your plan covers every weekly goal this week.</Alert>
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
                    {days.map(dateStr => {
                      const dow = new Date(`${dateStr}T00:00:00`).getDay();
                      const key = subjectKey(subject);
                      const display = scope === 'weekly'
                        ? weeklyHoursFor(planEntries, key, dow)
                        : plannedHoursFor(planEntries, key, dateStr);
                      const override = scope === 'once' && hasOnceOverride(planEntries, key, dateStr);
                      return (
                        <td key={dateStr} className={dateStr === todayStr ? 'sf-plan-today' : ''}>
                          <PlanCell
                            key={`${scope}-${dateStr}-${display}`}
                            value={display}
                            override={override}
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
                      className={`text-center small${load.overloaded ? ' sf-feas-over' : ''}${load.date === todayStr ? ' sf-plan-today' : ''}`}
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
                  Planned {round1(planned)}h / logged {round1(logged)}h this week
                </div>
              </Card.Body>
            </Card>
          </Col>
        ))}
      </Row>
    </>
  );
}

function DowChart({ data }) {
  const width = 300;
  const height = 110;
  const gap = 10;
  const barW = (width - gap * 7) / 7;

  return (
    <Card className="h-100 sf-card-panel">
      <Card.Body>
        <h2 className="h5 mb-3">Day-of-week average</h2>
        <svg
          viewBox={`0 0 ${width} ${height + 22}`}
          width="100%"
          style={{ maxHeight: 150 }}
          role="img"
          aria-label={`Average completion grade per weekday. ${data.map(item => `${item.label}: ${item.avg === null ? 'no data' : item.avg + '%'}`).join(', ')}.`}
        >
          {data.map((item, index) => {
            const barHeight = item.avg === null ? 0 : (item.avg / 100) * height;
            const x = index * (barW + gap);
            return (
              <g key={item.label}>
                <rect
                  x={x}
                  y={height - barHeight}
                  width={barW}
                  height={barHeight}
                  rx={3}
                  fill={item.avg === null ? 'var(--grade-none)' : gradeColor(item.avg)}
                  opacity={item.avg === null ? 0.5 : 1}
                />
                <text x={x + barW / 2} y={height + 14} textAnchor="middle" fontSize="9" fill="var(--muted-strong)" fontWeight="600">
                  {item.label}
                </text>
              </g>
            );
          })}
        </svg>
      </Card.Body>
    </Card>
  );
}

function GradeTrendChart({ data }) {
  const width = 320;
  const height = 120;
  const padX = 6;
  const stepX = (width - padX * 2) / Math.max(1, data.length - 1);
  const yFor = grade => height - (grade / 100) * height;
  const points = data
    .map((item, index) => (item.grade === null ? null : {
      x: padX + index * stepX,
      y: yFor(item.grade),
      grade: item.grade,
    }))
    .filter(Boolean);
  const path = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
    .join(' ');
  const gridY = [0, 50, 100];

  return (
    <Card className="h-100 sf-card-panel">
      <Card.Body>
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h2 className="h5 mb-0">Grade trend</h2>
          <span className="text-muted small">Last {data.length} days</span>
        </div>
        <svg
          viewBox={`0 0 ${width} ${height + 18}`}
          width="100%"
          style={{ maxHeight: 160 }}
          role="img"
          aria-label={`Daily completion grade for the last ${data.length} days. ${data.map(item => `${item.date}: ${item.grade === null ? 'no plan' : item.grade + '%'}`).join(', ')}.`}
        >
          {gridY.map(grade => (
            <line key={grade} x1={0} x2={width} y1={yFor(grade)} y2={yFor(grade)} stroke="var(--border-color)" strokeWidth="1" strokeDasharray="3 3" />
          ))}
          {points.length > 1 && (
            <path d={path} fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
          )}
          {points.map((point, index) => (
            <circle key={index} cx={point.x} cy={point.y} r={2.5} fill="var(--primary)" />
          ))}
        </svg>
      </Card.Body>
    </Card>
  );
}

function HabitsView({
  subjects,
  habits,
  habitLogs,
  addHabit,
  updateHabit,
  deleteHabit,
  toggleHabitDone,
}) {
  const todayStr = localDateString();
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [editing, setEditing] = useState(null);

  const isToday = selectedDate === todayStr;
  const canGoNext = shiftDateStr(selectedDate, 1) <= todayStr;

  const activeHabits = useMemo(() => habits.filter(habit => habit.active !== false), [habits]);
  const dGrade = useMemo(() => dayGrade(habits, habitLogs, selectedDate), [habits, habitLogs, selectedDate]);
  const wGrade = useMemo(() => weekGrade(habits, habitLogs, selectedDate), [habits, habitLogs, selectedDate]);
  const counts = useMemo(() => dayCounts(habits, habitLogs, selectedDate), [habits, habitLogs, selectedDate]);
  const trend = useMemo(() => gradeTrend(habits, habitLogs, selectedDate, 14), [habits, habitLogs, selectedDate]);
  const dow = useMemo(() => dowAverages(habits, habitLogs, todayStr, 28), [habits, habitLogs, todayStr]);

  function handleSave(updates) {
    updateHabit(editing.id, updates);
    setEditing(null);
  }

  return (
    <>
      <div className="d-flex justify-content-between align-items-start flex-wrap gap-3 mb-4">
        <div>
          <h2 className="h4 mb-1">Habit Tracker</h2>
          <p className="mb-0" style={{ color: 'var(--muted-strong)' }}>
            Schedule habits, check them off, and watch the grade.
          </p>
        </div>
        <div className="d-flex align-items-center gap-2 flex-wrap">
          <Button
            variant="outline-secondary"
            size="sm"
            onClick={() => setSelectedDate(shiftDateStr(selectedDate, -1))}
            aria-label="Previous day"
          >
            <IconChevronLeft /> <span className="ms-1">Prev</span>
          </Button>
          <Button
            variant={isToday ? 'primary' : 'outline-secondary'}
            size="sm"
            onClick={() => setSelectedDate(todayStr)}
            disabled={isToday}
          >
            Today
          </Button>
          <Form.Control
            type="date"
            size="sm"
            value={selectedDate}
            max={todayStr}
            onChange={event => {
              const value = event.target.value;
              if (value && value <= todayStr) setSelectedDate(value);
            }}
            style={{ width: 160 }}
            aria-label="Pick a day"
          />
          <Button
            variant="outline-secondary"
            size="sm"
            onClick={() => canGoNext && setSelectedDate(shiftDateStr(selectedDate, 1))}
            disabled={!canGoNext}
            aria-label="Next day"
          >
            <span className="me-1">Next</span> <IconChevronRight />
          </Button>
        </div>
      </div>

      <Row className="g-3 mb-4">
        <Col xs={6} lg={3}>
          <StatsCard
            title={isToday ? 'Day Grade' : 'Grade'}
            value={gradeText(dGrade)}
            unit={dGrade === null ? '' : '%'}
            icon={<IconGrade />}
            tone="blue"
            subtitle={dGrade === null ? 'No habits scheduled' : `${counts.done}/${counts.total} done`}
          />
        </Col>
        <Col xs={6} lg={3}>
          <StatsCard
            title="Week Grade"
            value={gradeText(wGrade)}
            unit={wGrade === null ? '' : '%'}
            icon={<IconCalendar />}
            tone="violet"
            subtitle="Sun-selected day, weighted"
          />
        </Col>
        <Col xs={6} lg={3}>
          <StatsCard
            title="Scheduled"
            value={`${counts.done}/${counts.total}`}
            icon={<IconCheck />}
            tone="green"
            subtitle={isToday ? 'done today' : 'done that day'}
          />
        </Col>
        <Col xs={6} lg={3}>
          <StatsCard
            title="Active Habits"
            value={activeHabits.length}
            icon={<IconList />}
            tone="amber"
            subtitle={`${habits.length} total`}
          />
        </Col>
      </Row>

      <Row className="g-3 mb-4">
        <Col lg={7}>
          <HabitChecklist
            habits={habits}
            habitLogs={habitLogs}
            dateStr={selectedDate}
            todayStr={todayStr}
            onToggle={toggleHabitDone}
          />
        </Col>
        <Col lg={5}>
          <GradeTrendChart data={trend} />
        </Col>
      </Row>

      <Row className="g-3 mb-4">
        <Col lg={5}>
          <DowChart data={dow} />
        </Col>
        <Col lg={7}>
          <HabitHeatmap
            habits={habits}
            habitLogs={habitLogs}
            todayStr={todayStr}
            onPickDay={setSelectedDate}
          />
        </Col>
      </Row>

      <Row className="g-3">
        <Col lg={5}>
          <HabitForm
            key={editing ? editing.id : 'new'}
            initial={editing}
            subjects={subjects}
            onAdd={addHabit}
            onSave={handleSave}
            onCancel={editing ? () => setEditing(null) : null}
          />
        </Col>
        <Col lg={7}>
          <Card className="h-100 sf-card-panel">
            <Card.Body>
              <h2 className="h5 mb-3">Your habits</h2>
              {habits.length === 0 ? (
                <div className="text-center py-4" style={{ color: 'var(--muted-strong)' }}>
                  No habits yet. Add one on the left to start tracking.
                </div>
              ) : (
                <ul className="list-unstyled mb-0">
                  {habits.map(habit => (
                    <li
                      key={habit.firestoreId || habit.id}
                      className={`sf-habit-row d-flex align-items-center gap-3 py-2${habit.active === false ? ' sf-habit-inactive' : ''}`}
                    >
                      <span className="sf-habit-dot" style={{ background: habit.subjectColor }} aria-hidden="true" />
                      <div className="flex-grow-1 min-w-0">
                        <div className="fw-semibold">{habit.name}</div>
                        <div className="small text-muted">{habit.subjectName} - {scheduleSummary(habit.days)}</div>
                      </div>
                      <span className={`sf-priority-badge sf-priority-${habit.priority}`}>
                        {PRIORITY_LABELS[habit.priority]}
                      </span>
                      <div className="d-flex gap-1">
                        <Button variant="link" size="sm" className="p-1 text-muted" onClick={() => setEditing(habit)} aria-label={`Edit ${habit.name}`}>
                          Edit
                        </Button>
                        <Button
                          variant="link"
                          size="sm"
                          className="p-1 text-muted"
                          onClick={() => updateHabit(habit.id, { active: habit.active === false })}
                          aria-label={habit.active === false ? `Activate ${habit.name}` : `Deactivate ${habit.name}`}
                        >
                          {habit.active === false ? 'Activate' : 'Pause'}
                        </Button>
                        <Button variant="link" size="sm" className="p-1 text-danger" onClick={() => deleteHabit(habit.id)} aria-label={`Delete ${habit.name}`}>
                          Delete
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </>
  );
}

export default function CommandCenter() {
  const studyData = useStudyData();
  const {
    subjects,
    sessions,
    habits,
    habitLogs,
    planEntries,
    addHabit,
    updateHabit,
    deleteHabit,
    toggleHabitDone,
    upsertPlanEntry,
  } = studyData;
  const [view, setView] = useState('planner');

  if (subjects.length === 0) {
    return (
      <Container fluid className="sf-page">
        <div className="sf-empty-hero">
          <h1 className="sf-empty-title">Command Center starts with subjects.</h1>
          <p className="sf-empty-sub">Create a subject first, then plan weekly hours and track habits here.</p>
          <Button as={Link} to="/app/subjects" variant="primary" size="lg">
            Create a subject
          </Button>
        </div>
      </Container>
    );
  }

  return (
    <Container fluid className="sf-page">
      <div className="d-flex justify-content-between align-items-start flex-wrap gap-3 mb-4">
        <div>
          <div className="sf-section-label" style={{ color: 'var(--muted-strong)', letterSpacing: '0.1em' }}>
            COMMAND CENTER
          </div>
          <h1 className="mb-1 mt-1">Plan and Habits</h1>
        </div>
        <ButtonGroup aria-label="Command Center view">
          <Button
            variant={view === 'planner' ? 'primary' : 'outline-secondary'}
            size="sm"
            onClick={() => setView('planner')}
          >
            Planner
          </Button>
          <Button
            variant={view === 'habits' ? 'primary' : 'outline-secondary'}
            size="sm"
            onClick={() => setView('habits')}
          >
            Habits
          </Button>
        </ButtonGroup>
      </div>

      {view === 'planner' ? (
        <PlannerView
          subjects={subjects}
          sessions={sessions}
          planEntries={planEntries}
          upsertPlanEntry={upsertPlanEntry}
        />
      ) : (
        <HabitsView
          subjects={subjects}
          habits={habits}
          habitLogs={habitLogs}
          addHabit={addHabit}
          updateHabit={updateHabit}
          deleteHabit={deleteHabit}
          toggleHabitDone={toggleHabitDone}
        />
      )}
    </Container>
  );
}
