import { useState } from 'react';
import { Container, Row, Col, Button } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import StreakBanner from '../components/StreakBanner';
import StatsCard from '../components/StatsCard';
import StudyTimer from '../components/StudyTimer';
import WeeklyTrendCard from '../components/WeeklyTrendCard';
import RecentSessionsList from '../components/RecentSessionsList';
import DailyPlanner from '../components/DailyPlanner';
import { useStudyData } from '../context/StudyDataContext';

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

const DAY_LABELS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

function getSessionMinutes(session) {
  if (typeof session.durationSeconds === 'number') return session.durationSeconds / 60;
  if (typeof session.duration === 'number') return session.duration;
  return 0;
}

export default function Dashboard() {
  const { subjects, sessions } = useStudyData();
  const [now] = useState(() => Date.now());

  // Today's focus
  const today = new Date(now).toISOString().slice(0, 10);
  const todaysSessions = sessions.filter(s => s.date === today);
  const todaysMinutes = todaysSessions.reduce((acc, s) => acc + getSessionMinutes(s), 0);
  const todaysHours = (todaysMinutes / 60).toFixed(1);

  // Yesterday comparison
  const yesterday = new Date(now - 86400000).toISOString().slice(0, 10);
  const yesterdaysMinutes = sessions
    .filter(s => s.date === yesterday)
    .reduce((acc, s) => acc + getSessionMinutes(s), 0);
  let focusChangeText = 'No data yesterday';
  let focusChangeColor = 'var(--muted-strong)';
  if (yesterdaysMinutes > 0) {
    const diff = Math.round(((todaysMinutes - yesterdaysMinutes) / yesterdaysMinutes) * 100);
    focusChangeText = `${diff >= 0 ? '+' : ''}${diff}% vs yesterday`;
    focusChangeColor = diff >= 0 ? 'var(--success-text)' : 'var(--danger-text)';
  }

  // Streak: consecutive days ending today (or yesterday if no session today)
  const uniqueDates = [...new Set(sessions.map(s => s.date))].sort().reverse();
  let streak = 0;
  if (uniqueDates.length > 0) {
    let cursor = new Date(now);
    if (uniqueDates[0] !== today) cursor = new Date(now - 86400000);
    for (const dateStr of uniqueDates) {
      const cursorStr = cursor.toISOString().slice(0, 10);
      if (dateStr === cursorStr) {
        streak++;
        cursor = new Date(cursor.getTime() - 86400000);
      } else {
        break;
      }
    }
  }

  // Weekly trend: last 7 days
  const weeklyData = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now - i * 86400000);
    const dateStr = d.toISOString().slice(0, 10);
    const mins = sessions
      .filter(s => s.date === dateStr)
      .reduce((acc, s) => acc + getSessionMinutes(s), 0);
    weeklyData.push({ date: dateStr, label: DAY_LABELS[d.getDay()], minutes: mins });
  }

  // Weekly progress: this week's minutes vs sum of subjects' weeklyGoal hours
  const weekStart = now - 6 * 86400000;
  const thisWeekMinutes = sessions
    .filter(s => new Date(s.date).getTime() >= weekStart)
    .reduce((acc, s) => acc + getSessionMinutes(s), 0);
  const thisWeekHours = thisWeekMinutes / 60;
  const totalWeeklyGoalHours = subjects.reduce(
    (acc, s) => acc + (Number(s.weeklyGoal) || 0),
    0
  );
  const weeklyPct = totalWeeklyGoalHours > 0
    ? Math.min(100, Math.round((thisWeekHours / totalWeeklyGoalHours) * 100))
    : 0;

  // Daily session goal derived from subjects' dailyGoal hours
  const totalDailyGoalHours = subjects.reduce(
    (acc, s) => acc + (Number(s.dailyGoal) || 0),
    0
  );
  const sessionsToday = todaysSessions.length;
  const dailySessionGoal = totalDailyGoalHours > 0
    ? Math.max(1, Math.round(totalDailyGoalHours))
    : 4;
  const goalPct = Math.round((sessionsToday / dailySessionGoal) * 100);

  // Empty-state CTA: no subjects yet → push the user to Subjects to create one
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

  return (
    <Container fluid className="sf-page">
      <div className="mb-4">
        <h1 className="mb-2">Welcome back.</h1>
        <StreakBanner streak={streak} />
      </div>

      <Row className="g-3 mb-4">
        <Col md={6} lg={3}>
          <StatsCard
            title="Today's Focus"
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
            subtitle={streak > 0 ? 'Active days in a row' : 'Study today to start'}
          />
        </Col>
        <Col md={6} lg={3}>
          <StatsCard
            title="Sessions Today"
            value={`${sessionsToday}/${dailySessionGoal}`}
            icon={<IconCheck />}
            iconBg="rgba(16, 185, 129, 0.15)"
            iconColor="var(--success-text)"
            subtitle={`${Math.min(100, goalPct)}% of daily goal`}
          />
        </Col>
        <Col md={6} lg={3}>
          <StatsCard
            title="Weekly Goal"
            value={thisWeekHours.toFixed(1)}
            unit={totalWeeklyGoalHours > 0 ? `/ ${totalWeeklyGoalHours}h` : 'hrs'}
            icon={<IconTarget />}
            iconBg="rgba(124, 58, 237, 0.12)"
            iconColor="#7c3aed"
            subtitle={totalWeeklyGoalHours > 0 ? `${weeklyPct}% this week` : 'Set goals on Subjects'}
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
