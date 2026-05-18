import { useMemo, useState } from 'react';
import { Container, Row, Col, Button, Form } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import StreakBanner from '../components/StreakBanner';
import StatsCard from '../components/StatsCard';
import StudyTimer from '../components/StudyTimer';
import WeeklyTrendCard from '../components/WeeklyTrendCard';
import RecentSessionsList from '../components/RecentSessionsList';
import DailyPlanner from '../components/DailyPlanner';
import { useStudyData } from '../context/StudyDataContext';
import { localDateString, shiftDateStr, getSessionMinutes } from '../utils/sessions';

const IconClock = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="10" cy="10" r="7.5" />
    <path d="M10 6v4l2.5 2.5" />
  </svg>
);

const IconFlame = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2C12 2 13.5 5 12 7.5C14.5 6 16 8 14.5 10.5C16 9.5 17 11 16 13C16 16 13.5 18 10 18C6.5 18 4 16 4 13C4 10.5 5.5 9 7 8.5C7 10.5 8 11.5 9 12C8.5 10 9 7 12 2Z" />
  </svg>
);

const IconCheck = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="10" cy="10" r="7.5" />
    <path d="M7 10.5l2.5 2.5L13 8" />
  </svg>
);

const IconTarget = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="10" cy="10" r="7.5" />
    <circle cx="10" cy="10" r="4" />
    <circle cx="10" cy="10" r="1.25" fill="currentColor" />
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

const DAY_LABELS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

// Streak ending at anchorDate. Used so "Daily Streak" reflects the day the
// user is currently viewing, not just real-time today.
function streakAsOf(sessions, anchorDate, isAnchorToday) {
  if (sessions.length === 0) return 0;
  const datesSet = new Set(sessions.map(s => s.date));
  let cursor = anchorDate;
  // If viewing today and today has no session yet, allow the streak to
  // continue from yesterday — they haven't "broken" it until midnight.
  if (!datesSet.has(cursor) && isAnchorToday) {
    cursor = shiftDateStr(cursor, -1);
  } else if (!datesSet.has(cursor)) {
    return 0;
  }
  let streak = 0;
  while (datesSet.has(cursor)) {
    streak += 1;
    cursor = shiftDateStr(cursor, -1);
  }
  return streak;
}

function formatPrettyDate(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function relativeLabel(dateStr, todayStr) {
  if (dateStr === todayStr) return 'Today';
  if (dateStr === shiftDateStr(todayStr, -1)) return 'Yesterday';
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString(undefined, { weekday: 'long' });
}

export default function Dashboard() {
  const { subjects, sessions } = useStudyData();
  const todayStr = localDateString();
  const [selectedDate, setSelectedDate] = useState(todayStr);

  const isToday = selectedDate === todayStr;
  const prevDate = shiftDateStr(selectedDate, -1);
  const nextDate = shiftDateStr(selectedDate, 1);
  const canGoNext = nextDate <= todayStr;

  // Focus on the selected day, vs the day before it.
  const todaysSessions = useMemo(
    () => sessions.filter(s => s.date === selectedDate),
    [sessions, selectedDate]
  );
  const todaysMinutes = todaysSessions.reduce((acc, s) => acc + getSessionMinutes(s), 0);
  const todaysHours = (todaysMinutes / 60).toFixed(1);

  const yesterdaysMinutes = useMemo(
    () =>
      sessions
        .filter(s => s.date === prevDate)
        .reduce((acc, s) => acc + getSessionMinutes(s), 0),
    [sessions, prevDate]
  );

  let focusChangeText = isToday ? 'No data yesterday' : 'No data prior day';
  let focusChangeColor = 'var(--muted-strong)';
  if (yesterdaysMinutes > 0) {
    const diff = Math.round(((todaysMinutes - yesterdaysMinutes) / yesterdaysMinutes) * 100);
    focusChangeText = `${diff >= 0 ? '+' : ''}${diff}% vs prior day`;
    focusChangeColor = diff >= 0 ? 'var(--success-text)' : 'var(--danger-text)';
  } else if (todaysMinutes === 0) {
    focusChangeText = 'No sessions yet';
  }

  const streak = useMemo(
    () => streakAsOf(sessions, selectedDate, isToday),
    [sessions, selectedDate, isToday]
  );

  // Rolling 7 days ending on the selected day — chart and weekly volume use
  // the same window so they read consistently.
  const weeklyData = useMemo(() => {
    const result = [];
    const anchor = new Date(`${selectedDate}T00:00:00`).getTime();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(anchor - i * 86400000);
      const dateStr = localDateString(d);
      const mins = sessions
        .filter(s => s.date === dateStr)
        .reduce((acc, s) => acc + getSessionMinutes(s), 0);
      result.push({ date: dateStr, label: DAY_LABELS[d.getDay()], minutes: mins });
    }
    return result;
  }, [sessions, selectedDate]);

  const weekStartStr = shiftDateStr(selectedDate, -6);
  const thisWeekMinutes = sessions
    .filter(s => s.date >= weekStartStr && s.date <= selectedDate)
    .reduce((acc, s) => acc + getSessionMinutes(s), 0);
  const thisWeekHours = thisWeekMinutes / 60;
  const totalWeeklyGoalHours = subjects.reduce(
    (acc, s) => acc + (Number(s.weeklyGoal) || 0),
    0
  );
  const weeklyPct = totalWeeklyGoalHours > 0
    ? Math.min(100, Math.round((thisWeekHours / totalWeeklyGoalHours) * 100))
    : 0;

  // Daily session goal derived from subjects' dailyGoal hours.
  const totalDailyGoalHours = subjects.reduce(
    (acc, s) => acc + (Number(s.dailyGoal) || 0),
    0
  );
  const sessionsToday = todaysSessions.length;
  const dailySessionGoal = totalDailyGoalHours > 0
    ? Math.max(1, Math.round(totalDailyGoalHours))
    : 4;
  const goalPct = Math.round((sessionsToday / dailySessionGoal) * 100);

  // Empty-state CTA: no subjects yet → push the user to Subjects to create one.
  if (subjects.length === 0) {
    return (
      <Container fluid className="sf-page">
        <div className="sf-empty-hero">
          <h1 className="sf-empty-title">Set up your first subject.</h1>
          <p className="sf-empty-sub">
            Track real focus time, set goals, build the streak.
          </p>
          <Button as={Link} to="/subjects" variant="primary" size="lg">
            Create a subject
          </Button>
        </div>
      </Container>
    );
  }

  const focusTitle = isToday ? "Today's Focus" : 'Focus';
  const sessionsTitle = isToday ? 'Sessions Today' : 'Sessions';
  const streakSubtitle = isToday
    ? streak > 0 ? 'Active days in a row' : 'Study today to start'
    : streak > 0
    ? `Streak as of ${relativeLabel(selectedDate, todayStr)}`
    : 'No streak on this day';
  const weeklySubtitle = totalWeeklyGoalHours > 0
    ? `${weeklyPct}% of weekly target`
    : 'Set goals on Subjects';

  return (
    <Container fluid className="sf-page">
      {/* Greeting + day navigator */}
      <div className="d-flex justify-content-between align-items-start flex-wrap gap-3 mb-4">
        <div>
          <div
            className="sf-section-label"
            style={{ color: 'var(--muted-strong)', letterSpacing: '0.1em' }}
          >
            {formatPrettyDate(selectedDate).toUpperCase()}
          </div>
          <h1 className="mb-2 mt-1">
            {isToday ? 'Welcome back.' : relativeLabel(selectedDate, todayStr)}
          </h1>
          <StreakBanner streak={streak} />
        </div>

        <div className="d-flex align-items-center gap-2 flex-wrap">
          <Button
            variant="outline-secondary"
            size="sm"
            onClick={() => setSelectedDate(prevDate)}
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
            onChange={e => {
              const val = e.target.value;
              if (val && val <= todayStr) setSelectedDate(val);
            }}
            style={{ width: 160 }}
            aria-label="Pick a day"
          />
          <Button
            variant="outline-secondary"
            size="sm"
            onClick={() => canGoNext && setSelectedDate(nextDate)}
            disabled={!canGoNext}
            aria-label="Next day"
          >
            <span className="me-1">Next</span> <IconChevronRight />
          </Button>
        </div>
      </div>

      <Row className="g-3 mb-4">
        <Col md={6} lg={3}>
          <StatsCard
            title={focusTitle}
            value={todaysHours}
            unit="hrs"
            icon={<IconClock />}
            iconBg="rgba(43, 74, 238, 0.1)"
            iconColor="var(--primary)"
            subtitle={focusChangeText}
            subtitleColor={focusChangeColor}
          />
        </Col>
        <Col md={6} lg={3}>
          <StatsCard
            title="Daily Streak"
            value={streak}
            unit={streak === 1 ? 'day' : 'days'}
            icon={<IconFlame />}
            iconBg="rgba(245, 158, 11, 0.15)"
            iconColor="var(--warning-text)"
            subtitle={streakSubtitle}
          />
        </Col>
        <Col md={6} lg={3}>
          <StatsCard
            title={sessionsTitle}
            value={`${sessionsToday}/${dailySessionGoal}`}
            icon={<IconCheck />}
            iconBg="rgba(16, 185, 129, 0.15)"
            iconColor="var(--success-text)"
            subtitle={`${Math.min(100, goalPct)}% of daily goal`}
          />
        </Col>
        <Col md={6} lg={3}>
          <StatsCard
            title={isToday ? 'Weekly Goal' : '7-Day Volume'}
            value={thisWeekHours.toFixed(1)}
            unit={totalWeeklyGoalHours > 0 ? `/ ${totalWeeklyGoalHours}h` : 'hrs'}
            icon={<IconTarget />}
            iconBg="rgba(124, 58, 237, 0.12)"
            iconColor="#7c3aed"
            subtitle={weeklySubtitle}
          />
        </Col>
      </Row>

      <Row className="g-3 mb-4">
        <Col lg={3} md={6}>
          <WeeklyTrendCard dailyMinutes={weeklyData} />
        </Col>
        <Col lg={6} md={12}>
          <StudyTimer subjects={subjects} />
        </Col>
        <Col lg={3} md={6}>
          <DailyPlanner />
        </Col>
      </Row>

      <Row>
        <Col>
          <RecentSessionsList sessions={sessions} subjects={subjects} />
        </Col>
      </Row>
    </Container>
  );
}
