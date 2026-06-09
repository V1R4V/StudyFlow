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
import { useStudyData } from '../context/StudyDataContext';
import { localDateString, shiftDateStr, getSessionMinutes } from '../utils/sessions';
import { planForDate, loggedHoursFor } from '../utils/plan';

// iOS-style native emoji for the KPI tiles. Wrapped in a flex-centered span so
// they sit dead-center in the 44px gradient chip regardless of glyph metrics.
const EmojiIcon = ({ symbol, label }) => (
  <span
    role="img"
    aria-label={label}
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
      height: '100%',
      fontSize: '1.35rem',
      lineHeight: 1,
    }}
  >
    {symbol}
  </span>
);

const IconClock = () => <EmojiIcon symbol="⏱️" label="focus time" />;
const IconFlame = () => <EmojiIcon symbol="🔥" label="streak" />;
const IconCheck = () => <EmojiIcon symbol="✅" label="schedule" />;
const IconTarget = () => <EmojiIcon symbol="🎯" label="weekly goal" />;

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
  // continue from yesterday, they haven't "broken" it until midnight.
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
  const { subjects, sessions, planEntries } = useStudyData();
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

  // Rolling 7 days ending on the selected day, chart and weekly volume use
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

  // Sunday-anchored week: aggregation resets every Sunday at 00:00.
  // weekStart = most recent Sunday on or before selectedDate.
  const selectedDayObj = new Date(`${selectedDate}T00:00:00`);
  const sundayOffset = selectedDayObj.getDay(); // 0 (Sun) … 6 (Sat)
  const weekStartStr = shiftDateStr(selectedDate, -sundayOffset);
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

  const scheduledPlan = useMemo(() => {
    const items = planForDate(subjects, planEntries, selectedDate).map(({ subject, plannedHours }) => {
      const logged = loggedHoursFor(sessions, subject, selectedDate);
      return { subject, plannedHours, logged };
    });
    const plannedHours = items.reduce((acc, item) => acc + item.plannedHours, 0);
    const cappedLoggedHours = items.reduce((acc, item) => acc + Math.min(item.logged, item.plannedHours), 0);
    const rawLoggedHours = items.reduce((acc, item) => acc + item.logged, 0);
    const pct = plannedHours > 0 ? Math.round((cappedLoggedHours / plannedHours) * 100) : 0;
    return { items, plannedHours, rawLoggedHours, pct };
  }, [subjects, planEntries, sessions, selectedDate]);

  // Empty-state CTA: no subjects yet → push the user to Subjects to create one.
  if (subjects.length === 0) {
    return (
      <Container fluid className="sf-page">
        <div className="sf-empty-hero">
          <h1 className="sf-empty-title">Set up your first subject.</h1>
          <p className="sf-empty-sub">
            Track real focus time, set goals, build the streak.
          </p>
          <Button as={Link} to="/app/subjects" variant="primary" size="lg">
            Create a subject
          </Button>
        </div>
      </Container>
    );
  }

  const focusTitle = isToday ? "Today's Focus" : 'Focus';
  const scheduleTitle = isToday ? "Today's Schedule" : 'Scheduled';

  // Streak subtitle: green when there's an active streak, muted otherwise.
  const streakSubtitle = isToday
    ? streak > 0 ? 'Active days in a row' : 'Study today to start'
    : streak > 0
    ? `Streak as of ${relativeLabel(selectedDate, todayStr)}`
    : 'No streak on this day';
  const streakSubtitleColor = streak > 0
    ? 'var(--success-text)'
    : 'var(--muted-strong)';

  const scheduledPct = Math.min(100, scheduledPlan.pct);
  let scheduleValue = `${scheduledPlan.rawLoggedHours.toFixed(1)}/${scheduledPlan.plannedHours.toFixed(1)}`;
  let scheduleSubtitle = scheduledPlan.items.length === 0
    ? 'No subjects scheduled'
    : `${scheduledPct}% of scheduled study`;
  let scheduleSubtitleColor = scheduledPlan.items.length === 0
    ? 'var(--muted-strong)'
    : 'var(--primary)';

  if (scheduledPlan.items.length > 0 && scheduledPlan.rawLoggedHours >= scheduledPlan.plannedHours) {
    const extra = scheduledPlan.rawLoggedHours - scheduledPlan.plannedHours;
    scheduleSubtitle = extra > 0.05 ? `${extra.toFixed(1)}h above schedule` : 'Schedule complete';
    scheduleSubtitleColor = extra > 0.05 ? 'var(--info-text)' : 'var(--success-text)';
  }

  if (scheduledPlan.items.length === 0) {
    scheduleValue = '-';
  }

  const weeklySubtitle = totalWeeklyGoalHours > 0
    ? thisWeekHours > totalWeeklyGoalHours
      ? `${(thisWeekHours - totalWeeklyGoalHours).toFixed(1)}h above weekly target`
      : `${weeklyPct}% of weekly target`
    : 'Set goals on Subjects';
  let weeklySubtitleColor = 'var(--muted-strong)';
  if (totalWeeklyGoalHours > 0) {
    if (thisWeekHours > totalWeeklyGoalHours) weeklySubtitleColor = 'var(--info-text)';
    else if (weeklyPct >= 100) weeklySubtitleColor = 'var(--success-text)';
    else if (weeklyPct >= 50) weeklySubtitleColor = 'var(--primary)';
    else if (weeklyPct < 25 && sundayOffset >= 4) weeklySubtitleColor = 'var(--danger-text)';
  }

  // Friendly explanation surfaced via the info button on the Weekly Goal tile.
  const weekEndStr = shiftDateStr(weekStartStr, 6);
  const fmtRange = d => new Date(`${d}T00:00:00`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
  const weeklyInfoText = totalWeeklyGoalHours > 0
    ? `Counts focus time from Sunday through Saturday. Current week: ${fmtRange(weekStartStr)} - ${fmtRange(weekEndStr)}. Resets every Sunday at midnight.`
    : `Counts focus time from Sunday through Saturday and resets every Sunday at midnight. Set weekly goals on the Subjects page to see a target here.`;

  return (
    <Container fluid className="sf-page sf-dashboard-page">
      {/* Greeting + day navigator */}
      <div className="sf-page-header d-flex justify-content-between align-items-start flex-wrap gap-3 mb-4">
        <div>
          <div
            className="sf-section-label"
            style={{ color: 'var(--muted-strong)' }}
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
            tone="blue"
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
            tone="amber"
            subtitle={streakSubtitle}
            subtitleColor={streakSubtitleColor}
          />
        </Col>
        <Col md={6} lg={3}>
          <StatsCard
            title={scheduleTitle}
            value={scheduleValue}
            unit={scheduledPlan.items.length > 0 ? 'hrs' : ''}
            icon={<IconCheck />}
            tone="green"
            progress={scheduledPlan.items.length > 0 ? scheduledPct : undefined}
            subtitle={scheduleSubtitle}
            subtitleColor={scheduleSubtitleColor}
          />
        </Col>
        <Col md={6} lg={3}>
          <StatsCard
            title={isToday ? 'Weekly Goal' : 'Weekly Progress'}
            value={thisWeekHours.toFixed(1)}
            unit={totalWeeklyGoalHours > 0 ? `/ ${totalWeeklyGoalHours}h` : 'hrs'}
            icon={<IconTarget />}
            tone="violet"
            progress={totalWeeklyGoalHours > 0 ? weeklyPct : undefined}
            subtitle={weeklySubtitle}
            subtitleColor={weeklySubtitleColor}
            info={weeklyInfoText}
            infoTitle="How this is counted"
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
          <TodayPlanCard />
        </Col>
      </Row>

      <Row className="g-3 mb-4">
        <Col>
          <WeeklySubjectsCard />
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
