import { useMemo, useState } from 'react';
import { Container, Row, Col, Button, Form, Card } from 'react-bootstrap';
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
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 3L5 8l5 5" /></svg>
);
const IconChevronRight = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 3l5 5-5 5" /></svg>
);

function gradeText(g) {
  return g === null || g === undefined ? '—' : String(g);
}

function scheduleSummary(days) {
  if (!Array.isArray(days) || days.length === 0) return 'Unscheduled';
  if (days.length === 7) return 'Every day';
  const weekdays = [1, 2, 3, 4, 5];
  if (days.length === 5 && weekdays.every(d => days.includes(d))) return 'Weekdays';
  const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return days.map(d => labels[d]).join(' ');
}

// ---- Day-of-week average grade bar chart ----
function DowChart({ data }) {
  const width = 300;
  const height = 110;
  const gap = 10;
  const barW = (width - gap * 7) / 7;
  return (
    <Card className="h-100 sf-card-panel">
      <Card.Body>
        <h2 className="h5 mb-3">Day-of-week average</h2>
        <svg viewBox={`0 0 ${width} ${height + 22}`} width="100%" style={{ maxHeight: 150 }} role="img"
          aria-label={`Average completion grade per weekday. ${data.map(d => `${d.label}: ${d.avg === null ? 'no data' : d.avg + '%'}`).join(', ')}.`}>
          {data.map((d, i) => {
            const h = d.avg === null ? 0 : (d.avg / 100) * height;
            const x = i * (barW + gap);
            return (
              <g key={d.label}>
                <rect x={x} y={height - h} width={barW} height={h} rx={3}
                  fill={d.avg === null ? 'var(--grade-none)' : gradeColor(d.avg)}
                  opacity={d.avg === null ? 0.5 : 1} />
                <text x={x + barW / 2} y={height + 14} textAnchor="middle" fontSize="9" fill="var(--muted-strong)" fontWeight="600">{d.label}</text>
              </g>
            );
          })}
        </svg>
      </Card.Body>
    </Card>
  );
}

// ---- Grade trend line chart (last 14 days) ----
function GradeTrendChart({ data }) {
  const width = 320;
  const height = 120;
  const padX = 6;
  const stepX = (width - padX * 2) / Math.max(1, data.length - 1);
  const yFor = g => height - (g / 100) * height;
  const points = data
    .map((d, i) => (d.grade === null ? null : { x: padX + i * stepX, y: yFor(d.grade), grade: d.grade }))
    .filter(Boolean);
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const gridY = [0, 50, 100];

  return (
    <Card className="h-100 sf-card-panel">
      <Card.Body>
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h2 className="h5 mb-0">Grade trend</h2>
          <span className="text-muted small">Last {data.length} days</span>
        </div>
        <svg viewBox={`0 0 ${width} ${height + 18}`} width="100%" style={{ maxHeight: 160 }} role="img"
          aria-label={`Daily completion grade for the last ${data.length} days. ${data.map(d => `${d.date}: ${d.grade === null ? 'no plan' : d.grade + '%'}`).join(', ')}.`}>
          {gridY.map(g => (
            <line key={g} x1={0} x2={width} y1={yFor(g)} y2={yFor(g)} stroke="var(--border-color)" strokeWidth="1" strokeDasharray="3 3" />
          ))}
          {points.length > 1 && <path d={path} fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />}
          {points.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={2.5} fill="var(--primary)" />
          ))}
        </svg>
      </Card.Body>
    </Card>
  );
}

export default function CommandCenter() {
  const {
    subjects, habits, habitLogs,
    addHabit, updateHabit, deleteHabit, toggleHabitDone,
  } = useStudyData();

  const todayStr = localDateString();
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [editing, setEditing] = useState(null);

  const isToday = selectedDate === todayStr;
  const canGoNext = shiftDateStr(selectedDate, 1) <= todayStr;

  const activeHabits = useMemo(() => habits.filter(h => h.active !== false), [habits]);
  const dGrade = useMemo(() => dayGrade(habits, habitLogs, selectedDate), [habits, habitLogs, selectedDate]);
  const wGrade = useMemo(() => weekGrade(habits, habitLogs, selectedDate), [habits, habitLogs, selectedDate]);
  const counts = useMemo(() => dayCounts(habits, habitLogs, selectedDate), [habits, habitLogs, selectedDate]);
  const trend = useMemo(() => gradeTrend(habits, habitLogs, selectedDate, 14), [habits, habitLogs, selectedDate]);
  const dow = useMemo(() => dowAverages(habits, habitLogs, todayStr, 28), [habits, habitLogs, todayStr]);

  // No subjects yet → habits are tied to subjects, so push the user there first.
  if (subjects.length === 0) {
    return (
      <Container fluid className="sf-page">
        <div className="sf-empty-hero">
          <h1 className="sf-empty-title">Habits build on your subjects.</h1>
          <p className="sf-empty-sub">Create a subject first, then schedule habits against it here.</p>
          <Button as={Link} to="/app/subjects" variant="primary" size="lg">Create a subject</Button>
        </div>
      </Container>
    );
  }

  function handleSave(updates) {
    updateHabit(editing.id, updates);
    setEditing(null);
  }

  return (
    <Container fluid className="sf-page">
      {/* Header + day navigator */}
      <div className="d-flex justify-content-between align-items-start flex-wrap gap-3 mb-4">
        <div>
          <div className="sf-section-label" style={{ color: 'var(--muted-strong)', letterSpacing: '0.1em' }}>COMMAND CENTER</div>
          <h1 className="mb-1 mt-1">Habit Tracker</h1>
          <p className="mb-0" style={{ color: 'var(--muted-strong)' }}>Schedule habits, check them off, and watch the grade.</p>
        </div>
        <div className="d-flex align-items-center gap-2 flex-wrap">
          <Button variant="outline-secondary" size="sm" onClick={() => setSelectedDate(shiftDateStr(selectedDate, -1))} aria-label="Previous day">
            <IconChevronLeft /> <span className="ms-1">Prev</span>
          </Button>
          <Button variant={isToday ? 'primary' : 'outline-secondary'} size="sm" onClick={() => setSelectedDate(todayStr)} disabled={isToday}>Today</Button>
          <Form.Control type="date" size="sm" value={selectedDate} max={todayStr}
            onChange={e => { const v = e.target.value; if (v && v <= todayStr) setSelectedDate(v); }}
            style={{ width: 160 }} aria-label="Pick a day" />
          <Button variant="outline-secondary" size="sm" onClick={() => canGoNext && setSelectedDate(shiftDateStr(selectedDate, 1))} disabled={!canGoNext} aria-label="Next day">
            <span className="me-1">Next</span> <IconChevronRight />
          </Button>
        </div>
      </div>

      {/* KPI row */}
      <Row className="g-3 mb-4">
        <Col xs={6} lg={3}>
          <StatsCard title={isToday ? 'Day Grade' : 'Grade'} value={gradeText(dGrade)} unit={dGrade === null ? '' : '%'}
            icon={<IconGrade />} iconBg="rgba(43, 74, 238, 0.1)" iconColor="var(--primary)"
            subtitle={dGrade === null ? 'No habits scheduled' : `${counts.done}/${counts.total} done`} />
        </Col>
        <Col xs={6} lg={3}>
          <StatsCard title="Week Grade" value={gradeText(wGrade)} unit={wGrade === null ? '' : '%'}
            icon={<IconCalendar />} iconBg="rgba(124, 58, 237, 0.12)" iconColor="#7c3aed"
            subtitle="Sun–selected day, weighted" />
        </Col>
        <Col xs={6} lg={3}>
          <StatsCard title="Scheduled" value={`${counts.done}/${counts.total}`}
            icon={<IconCheck />} iconBg="rgba(16, 185, 129, 0.15)" iconColor="var(--success-text)"
            subtitle={isToday ? 'done today' : 'done that day'} />
        </Col>
        <Col xs={6} lg={3}>
          <StatsCard title="Active Habits" value={activeHabits.length}
            icon={<IconList />} iconBg="rgba(245, 158, 11, 0.15)" iconColor="var(--warning-text)"
            subtitle={`${habits.length} total`} />
        </Col>
      </Row>

      {/* Today's habits + grade trend */}
      <Row className="g-3 mb-4">
        <Col lg={7}>
          <HabitChecklist habits={habits} habitLogs={habitLogs} dateStr={selectedDate} todayStr={todayStr} onToggle={toggleHabitDone} />
        </Col>
        <Col lg={5}>
          <GradeTrendChart data={trend} />
        </Col>
      </Row>

      {/* Day-of-week + calendar heatmap */}
      <Row className="g-3 mb-4">
        <Col lg={5}>
          <DowChart data={dow} />
        </Col>
        <Col lg={7}>
          <HabitHeatmap habits={habits} habitLogs={habitLogs} todayStr={todayStr} onPickDay={setSelectedDate} />
        </Col>
      </Row>

      {/* Manage habits */}
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
                  {habits.map(h => (
                    <li key={h.firestoreId || h.id} className={`sf-habit-row d-flex align-items-center gap-3 py-2${h.active === false ? ' sf-habit-inactive' : ''}`}>
                      <span className="sf-habit-dot" style={{ background: h.subjectColor }} aria-hidden="true" />
                      <div className="flex-grow-1 min-w-0">
                        <div className="fw-semibold">{h.name}</div>
                        <div className="small text-muted">{h.subjectName} · {scheduleSummary(h.days)}</div>
                      </div>
                      <span className={`sf-priority-badge sf-priority-${h.priority}`}>{PRIORITY_LABELS[h.priority]}</span>
                      <div className="d-flex gap-1">
                        <Button variant="link" size="sm" className="p-1 text-muted" onClick={() => setEditing(h)} aria-label={`Edit ${h.name}`}>Edit</Button>
                        <Button variant="link" size="sm" className="p-1 text-muted" onClick={() => updateHabit(h.id, { active: h.active === false })} aria-label={h.active === false ? `Activate ${h.name}` : `Deactivate ${h.name}`}>
                          {h.active === false ? 'Activate' : 'Pause'}
                        </Button>
                        <Button variant="link" size="sm" className="p-1 text-danger" onClick={() => deleteHabit(h.id)} aria-label={`Delete ${h.name}`}>✕</Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}
