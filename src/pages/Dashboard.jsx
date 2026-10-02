import { useMemo, useState } from 'react';
import { Container, Row, Col, Button, Form } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import StreakBanner from '../components/StreakBanner';
import StatsCard from '../components/StatsCard';
import StudyTimer from '../components/StudyTimer';
import WeeklyTrendCard from '../components/WeeklyTrendCard';
import RecentSessionsList from '../components/RecentSessionsList';
import TodayPlanCard from '../components/TodayPlanCard';
import WeeklySubjectsCard from '../components/WeeklySubjectsCard';
import Icon from '../components/Icon';
import { useStudyData } from '../context/StudyDataContext';
import { useAuthContext } from '../context/AuthContext';
import { localDateString, shiftDateStr, getSessionMinutes } from '../utils/sessions';
import { planForDate, loggedHoursFor } from '../utils/plan';
import { formatStudyTime, formatWeekRange, progressPercent, weekProgress } from '../utils/progress';

function timeGreeting(name) {
  const hour = new Date().getHours();
  const greeting = hour < 5 ? 'Late night focus' : hour < 12 ? 'Good morning'
    : hour < 17 ? 'Good afternoon' : hour < 21 ? 'Good evening' : 'Night session';
  return name ? `${greeting}, ${name}.` : `${greeting}.`;
}

function streakAsOf(sessions, anchorDate, isToday) {
  const dates = new Set(sessions.filter(session => getSessionMinutes(session) > 0).map(session => session.date));
  let cursor = anchorDate;
  if (!dates.has(cursor) && isToday) cursor = shiftDateStr(cursor, -1);
  let streak = 0;
  while (dates.has(cursor)) {
    streak += 1;
    cursor = shiftDateStr(cursor, -1);
  }
  return streak;
}

export default function Dashboard() {
  const { subjects, sessions, planEntries } = useStudyData();
  const { user } = useAuthContext();
  const today = localDateString();
  const [selectedDate, setSelectedDate] = useState(today);
  const isToday = selectedDate === today;
  const previousDay = shiftDateStr(selectedDate, -1);
  const nextDay = shiftDateStr(selectedDate, 1);
  const dayMinutes = sessions.filter(session => session.date === selectedDate)
    .reduce((sum, session) => sum + getSessionMinutes(session), 0);
  const priorMinutes = sessions.filter(session => session.date === previousDay)
    .reduce((sum, session) => sum + getSessionMinutes(session), 0);
  const streak = streakAsOf(sessions, selectedDate, isToday);
  const weekly = useMemo(() => weekProgress({ subjects, sessions, planEntries, anchorDate: selectedDate, today }),
    [subjects, sessions, planEntries, selectedDate, today]);
  const scheduled = planForDate(subjects, planEntries, selectedDate).map(({ subject, plannedHours }) => ({
    plannedMinutes: plannedHours * 60,
    loggedMinutes: loggedHoursFor(sessions, subject, selectedDate) * 60,
  }));
  const plannedMinutes = scheduled.reduce((sum, row) => sum + row.plannedMinutes, 0);
  const scheduleCredit = scheduled.reduce((sum, row) => sum + Math.min(row.loggedMinutes, row.plannedMinutes), 0);
  const schedulePct = progressPercent(scheduleCredit, plannedMinutes);
  const scheduleLeft = Math.max(0, plannedMinutes - scheduleCredit);
  const focusDifference = dayMinutes - priorMinutes;
  const focusSubtitle = priorMinutes > 0
    ? `${focusDifference >= 0 ? '+' : '−'}${formatStudyTime(Math.abs(focusDifference))} vs ${isToday ? 'yesterday' : 'prior day'}`
    : dayMinutes > 0 ? 'Every saved session counts' : isToday ? 'Start a session to get going' : 'No sessions on this day';
  const prettyDate = new Date(`${selectedDate}T00:00:00`).toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });

  if (subjects.length === 0) {
    return (
      <Container fluid className="sf-page">
        <div className="sf-empty-hero">
          <h1 className="sf-empty-title">Set up your first subject.</h1>
          <p className="sf-empty-sub">Track real focus time, set goals, build the streak.</p>
          <Button as={Link} to="/app/subjects" variant="primary" size="lg">Create a subject</Button>
        </div>
      </Container>
    );
  }

  return (
    <Container fluid className="sf-page sf-dashboard-page">
      <div className="sf-page-header d-flex justify-content-between align-items-start flex-wrap gap-3 mb-4">
        <div>
          <div className="sf-section-label">{prettyDate}</div>
          <h1 className="mb-2 mt-1">{isToday ? timeGreeting(user?.displayName?.split(' ')[0]) : prettyDate}</h1>
          <StreakBanner streak={streak} />
        </div>
        <div className="d-flex align-items-center gap-2 flex-wrap">
          <Button variant="outline-secondary" size="sm" onClick={() => setSelectedDate(previousDay)} aria-label="Previous day">‹</Button>
          <Button variant={isToday ? 'primary' : 'outline-secondary'} size="sm" onClick={() => setSelectedDate(today)} disabled={isToday}>Today</Button>
          <Form.Control type="date" size="sm" value={selectedDate} max={today}
            onChange={event => { if (event.target.value && event.target.value <= today) setSelectedDate(event.target.value); }}
            style={{ width: 160 }} aria-label="Pick a day" />
          <Button variant="outline-secondary" size="sm" onClick={() => setSelectedDate(nextDay)} disabled={nextDay > today} aria-label="Next day">›</Button>
        </div>
      </div>

      <Row className="g-3 mb-4">
        <Col md={6} lg={3}>
          <StatsCard title={isToday ? "Today's Focus" : 'Daily Focus'} value={formatStudyTime(dayMinutes)}
            icon={<Icon name="clock" size={24} />} tone="blue" subtitle={focusSubtitle}
            subtitleColor={focusDifference >= 0 && dayMinutes > 0 ? 'var(--success-text)' : 'var(--muted-strong)'} />
        </Col>
        <Col md={6} lg={3}>
          <StatsCard title="Daily Streak" value={streak} unit={streak === 1 ? 'day' : 'days'}
            icon={<Icon name="flame" size={24} />} tone="amber"
            subtitle={streak > 0 ? 'Active days in a row' : isToday ? 'Study today to start' : 'No streak on this day'} />
        </Col>
        <Col md={6} lg={3}>
          <StatsCard title={isToday ? "Today's Schedule" : 'Daily Schedule'}
            value={plannedMinutes > 0 ? `${schedulePct}%` : 'Open'}
            icon={<Icon name="calendar" size={24} />} tone="green"
            progress={plannedMinutes > 0 ? schedulePct : undefined}
            subtitle={plannedMinutes > 0 ? scheduleLeft > 0 ? `${formatStudyTime(scheduleLeft)} left of ${formatStudyTime(plannedMinutes)}` : 'All scheduled subjects complete'
              : dayMinutes > 0 ? 'Your study still counts toward goals' : 'Study anytime or plan your day'} />
        </Col>
        <Col md={6} lg={3}>
          <StatsCard title="Weekly Goal Progress" value={weekly.goalMinutes > 0 ? `${weekly.goalPct}%` : formatStudyTime(weekly.totalMinutes)}
            icon={<Icon name="target" size={24} />} tone="violet"
            progress={weekly.goalMinutes > 0 ? weekly.goalPct : undefined}
            subtitle={weekly.goalMinutes > 0 ? `${weekly.goalsMet} of ${weekly.goalCount} subject goals reached` : 'Set a weekly goal to track progress'}
            info={`Sunday–Saturday: ${formatWeekRange(weekly.start)}. Saved sessions count automatically, even without a schedule. Each subject contributes up to its own goal; extra time remains in your study total.`}
            infoTitle="How this is counted" />
        </Col>
      </Row>

      <Row className="g-3 mb-4">
        <Col xl={3} md={6} className="order-2 order-xl-1"><WeeklyTrendCard weekly={weekly} selectedDate={selectedDate} onSelectDate={setSelectedDate} /></Col>
        <Col xl={6} md={12} className="order-1 order-xl-2"><StudyTimer subjects={subjects} /></Col>
        <Col xl={3} md={6} className="order-3"><TodayPlanCard selectedDate={selectedDate} /></Col>
      </Row>
      <Row className="g-3 mb-4">
        <Col><WeeklySubjectsCard weekly={weekly} /></Col>
      </Row>
      <RecentSessionsList sessions={sessions} subjects={subjects} selectedDate={selectedDate} />
    </Container>
  );
}
