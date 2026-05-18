import { useMemo, useState } from 'react';
import { Container, Row, Col, Card, Form } from 'react-bootstrap';
import { useStudyData } from '../context/StudyDataContext';
import { sessionMatchesSubject, getSessionMinutes, localDateString } from '../utils/sessions';

const RANGE_OPTIONS = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: 'ytd', label: 'Year to date' },
  { value: 'all', label: 'All time' },
];

const DOW_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function shiftDateStr(dateStr, deltaDays) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + deltaDays);
  return localDateString(d);
}

function daysBetween(startStr, endStr) {
  const start = new Date(`${startStr}T00:00:00`).getTime();
  const end = new Date(`${endStr}T00:00:00`).getTime();
  return Math.max(1, Math.round((end - start) / MS_PER_DAY) + 1);
}

function rangeBoundaries(range, sessions) {
  const today = new Date();
  const endDate = localDateString(today);

  if (range === 'all') {
    if (sessions.length === 0) {
      return { startDate: endDate, endDate, days: 1 };
    }
    const earliest = sessions.reduce(
      (acc, s) => (s.date && s.date < acc ? s.date : acc),
      endDate
    );
    return { startDate: earliest, endDate, days: daysBetween(earliest, endDate) };
  }

  if (range === 'ytd') {
    const startDate = `${today.getFullYear()}-01-01`;
    return { startDate, endDate, days: daysBetween(startDate, endDate) };
  }

  const daysMap = { '7d': 7, '30d': 30, '90d': 90 };
  const days = daysMap[range] || 7;
  const startDate = shiftDateStr(endDate, -(days - 1));
  return { startDate, endDate, days };
}

function filterByRange(sessions, startDate, endDate) {
  return sessions.filter(s => s.date >= startDate && s.date <= endDate);
}

function formatHours(minutes) {
  return (minutes / 60).toFixed(1);
}

// "1h 23m" or "23m" — used for session durations.
function formatDurationMinutes(minutes) {
  const mins = Math.max(0, Math.round(minutes));
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// "Apr 1" — chart labels and best-day pills.
function formatShortDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// Percent change vs previous period. Returns null when no comparison makes
// sense (e.g. zero prior data and zero current data).
function computeDelta(current, prev) {
  if (prev === 0 && current === 0) return null;
  if (prev === 0) return { text: 'New', positive: true };
  const diff = Math.round(((current - prev) / prev) * 100);
  return {
    text: `${diff >= 0 ? '+' : ''}${diff}% vs prev`,
    positive: diff >= 0,
  };
}

function currentStreakDays(sessions, todayStr) {
  if (sessions.length === 0) return 0;
  const uniqueDates = [...new Set(sessions.map(s => s.date))].sort().reverse();
  let cursor = todayStr;
  // Allow a streak that ended yesterday to still count when no session today.
  if (uniqueDates[0] !== todayStr) cursor = shiftDateStr(todayStr, -1);
  let streak = 0;
  for (const dateStr of uniqueDates) {
    if (dateStr === cursor) {
      streak += 1;
      cursor = shiftDateStr(cursor, -1);
    } else if (dateStr < cursor) {
      break;
    }
  }
  return streak;
}

// SVG donut. Items: { label, value, color }. Empty state when total is 0.
function DonutChart({ items, totalLabel, totalValue }) {
  const total = items.reduce((acc, i) => acc + i.value, 0);
  const cx = 100;
  const cy = 100;
  const radius = 78;
  const strokeWidth = 22;
  const circumference = 2 * Math.PI * radius;

  if (total === 0) {
    return (
      <div className="sf-donut-empty">
        <div className="sf-donut-empty-text">No data in range</div>
      </div>
    );
  }

  let offset = 0;
  return (
    <svg
      viewBox="0 0 200 200"
      width="200"
      height="200"
      role="img"
      aria-label="Time distribution by subject"
    >
      <circle
        cx={cx}
        cy={cy}
        r={radius}
        fill="none"
        stroke="var(--bg-light)"
        strokeWidth={strokeWidth}
      />
      {items.map((item, i) => {
        if (item.value === 0) return null;
        const fraction = item.value / total;
        const dash = fraction * circumference;
        const gap = circumference - dash;
        const segment = (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke={item.color}
            strokeWidth={strokeWidth}
            strokeDasharray={`${dash} ${gap}`}
            strokeDashoffset={-offset}
            transform={`rotate(-90 ${cx} ${cy})`}
            strokeLinecap="butt"
          />
        );
        offset += dash;
        return segment;
      })}
      <text
        x={cx}
        y={cy - 6}
        textAnchor="middle"
        fontSize="26"
        fontWeight="800"
        fill="var(--text-dark)"
        style={{ letterSpacing: '-0.04em' }}
      >
        {totalValue}
      </text>
      <text
        x={cx}
        y={cy + 18}
        textAnchor="middle"
        fontSize="10"
        fontWeight="600"
        fill="var(--text-light)"
        style={{ letterSpacing: '0.08em', textTransform: 'uppercase' }}
      >
        {totalLabel}
      </text>
    </svg>
  );
}

// Daily activity bars across `startDate..endDate` (inclusive).
// Label cadence scales so axes stay readable from 7d to multi-year ranges.
function DailyActivityChart({ sessions, startDate, days }) {
  const data = useMemo(() => {
    const start = new Date(`${startDate}T00:00:00`).getTime();
    const byDate = new Map();
    sessions.forEach(s => {
      byDate.set(s.date, (byDate.get(s.date) || 0) + getSessionMinutes(s));
    });
    const result = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(start + i * MS_PER_DAY);
      const dateStr = localDateString(d);
      result.push({
        date: dateStr,
        minutes: byDate.get(dateStr) || 0,
        day: d.getDate(),
        month: d.getMonth() + 1,
      });
    }
    return result;
  }, [sessions, startDate, days]);

  // Label every Nth bar so the x-axis stays legible at long ranges.
  let labelEvery = 1;
  if (days > 14 && days <= 31) labelEvery = 3;
  else if (days > 31 && days <= 90) labelEvery = 7;
  else if (days > 90 && days <= 200) labelEvery = 14;
  else if (days > 200) labelEvery = Math.ceil(days / 14);

  const max = Math.max(...data.map(d => d.minutes), 60);
  const chartWidth = 800;
  const chartHeight = 160;
  const gap = days <= 14 ? 6 : days <= 31 ? 4 : days <= 90 ? 2 : 1;
  const barWidth = Math.max(1, (chartWidth - gap * (days - 1)) / days);

  // Reference gridlines at 25/50/75/100% so users can read minutes by eye.
  const gridFractions = [0.25, 0.5, 0.75, 1];

  return (
    <svg
      viewBox={`0 0 ${chartWidth} ${chartHeight + 28}`}
      width="100%"
      role="img"
      aria-label={`Daily study minutes from ${startDate} to ${shiftDateStr(startDate, days - 1)}`}
    >
      {gridFractions.map(p => (
        <line
          key={p}
          x1={0}
          x2={chartWidth}
          y1={chartHeight - chartHeight * p}
          y2={chartHeight - chartHeight * p}
          stroke="var(--border-color)"
          strokeWidth={0.5}
          strokeDasharray="2 4"
        />
      ))}
      {data.map((d, i) => {
        const h = max > 0 ? (d.minutes / max) * chartHeight : 0;
        const x = i * (barWidth + gap);
        const y = chartHeight - h;
        const isToday = i === days - 1;
        const showLabel = i === days - 1 || i === 0 || i % labelEvery === 0;
        return (
          <g key={i}>
            <title>{`${d.date}: ${formatDurationMinutes(d.minutes)}`}</title>
            <rect
              x={x}
              y={y}
              width={barWidth}
              height={Math.max(h, 2)}
              rx={Math.min(3, barWidth / 2)}
              fill="var(--primary)"
              opacity={d.minutes > 0 ? (isToday ? 1 : 0.7) : 0.15}
            />
            {showLabel && barWidth > 6 && (
              <text
                x={x + barWidth / 2}
                y={chartHeight + 18}
                textAnchor="middle"
                fontSize="10"
                fontWeight="600"
                fill="var(--text-light)"
              >
                {labelEvery >= 7 ? `${d.month}/${d.day}` : d.day}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// Total minutes per weekday across the filtered range. Reveals "I never
// actually study on Sundays" kind of patterns.
function DayOfWeekChart({ sessions }) {
  const buckets = useMemo(() => {
    // JS getDay: 0=Sun..6=Sat. Reorder to Mon-first for nicer UX.
    const raw = [0, 0, 0, 0, 0, 0, 0];
    sessions.forEach(s => {
      if (!s.date) return;
      const dow = new Date(`${s.date}T00:00:00`).getDay();
      raw[dow] += getSessionMinutes(s);
    });
    const order = [1, 2, 3, 4, 5, 6, 0];
    return order.map((idx, i) => ({
      label: DOW_LABELS[i],
      minutes: raw[idx],
    }));
  }, [sessions]);

  const max = Math.max(...buckets.map(b => b.minutes), 30);
  const chartWidth = 360;
  const chartHeight = 140;
  const gap = 14;
  const barWidth = (chartWidth - gap * 6) / 7;

  if (sessions.length === 0) {
    return <div className="text-muted text-center py-4">No sessions in range.</div>;
  }

  return (
    <svg
      viewBox={`0 0 ${chartWidth} ${chartHeight + 28}`}
      width="100%"
      role="img"
      aria-label="Study minutes by day of week"
    >
      {buckets.map((b, i) => {
        const h = max > 0 ? (b.minutes / max) * chartHeight : 0;
        const x = i * (barWidth + gap);
        const y = chartHeight - h;
        return (
          <g key={b.label}>
            <title>{`${b.label}: ${formatDurationMinutes(b.minutes)}`}</title>
            <rect
              x={x}
              y={y}
              width={barWidth}
              height={Math.max(h, 2)}
              rx={4}
              fill="var(--primary)"
              opacity={b.minutes > 0 ? 0.85 : 0.15}
            />
            <text
              x={x + barWidth / 2}
              y={chartHeight + 18}
              textAnchor="middle"
              fontSize="11"
              fontWeight="600"
              fill="var(--text-light)"
            >
              {b.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function KpiCard({ label, value, sub, delta }) {
  return (
    <Card className="h-100">
      <Card.Body>
        <div className="sf-section-label mb-2">{label}</div>
        <div className="sf-stats-value">{value}</div>
        <div className="d-flex align-items-center gap-2 mt-1" style={{ minHeight: 18 }}>
          {sub && <span className="small text-muted">{sub}</span>}
          {delta && (
            <span
              className="small fw-semibold"
              style={{ color: delta.positive ? 'var(--success-text)' : 'var(--danger-text)' }}
            >
              {delta.text}
            </span>
          )}
        </div>
      </Card.Body>
    </Card>
  );
}

export default function Statistics() {
  const { subjects, sessions } = useStudyData();
  const [range, setRange] = useState('30d');

  const todayStr = localDateString();

  // Current and previous range boundaries. Prev period is same length, ending
  // the day before the current range starts — apples-to-apples comparison.
  const { startDate, endDate, days } = useMemo(
    () => rangeBoundaries(range, sessions),
    [range, sessions]
  );
  const { prevStart, prevEnd } = useMemo(() => {
    const pEnd = shiftDateStr(startDate, -1);
    const pStart = shiftDateStr(pEnd, -(days - 1));
    return { prevStart: pStart, prevEnd: pEnd };
  }, [startDate, days]);

  const rangedSessions = useMemo(
    () => filterByRange(sessions, startDate, endDate),
    [sessions, startDate, endDate]
  );
  const prevSessions = useMemo(
    () => filterByRange(sessions, prevStart, prevEnd),
    [sessions, prevStart, prevEnd]
  );

  // Per-subject totals within the current range. Subjects with zero minutes
  // are kept so the breakdown shows "this subject got 0 attention" honestly.
  const breakdown = useMemo(() => {
    return subjects
      .map(s => {
        const subjSessions = rangedSessions.filter(sess => sessionMatchesSubject(sess, s));
        const minutes = subjSessions.reduce((acc, sess) => acc + getSessionMinutes(sess), 0);
        const avgFocus =
          subjSessions.length > 0
            ? (
                subjSessions.reduce((acc, sess) => acc + (sess.focusRating || 0), 0) /
                subjSessions.length
              ).toFixed(1)
            : '—';
        return { ...s, minutes, count: subjSessions.length, avgFocus };
      })
      .sort((a, b) => b.minutes - a.minutes);
  }, [subjects, rangedSessions]);

  // Headline numbers for the current range + previous range (for deltas).
  const totalMinutes = rangedSessions.reduce((acc, s) => acc + getSessionMinutes(s), 0);
  const prevTotalMinutes = prevSessions.reduce((acc, s) => acc + getSessionMinutes(s), 0);

  const totalSessions = rangedSessions.length;
  const prevTotalSessions = prevSessions.length;

  const avgFocus =
    rangedSessions.length > 0
      ? rangedSessions.reduce((acc, s) => acc + (s.focusRating || 0), 0) / rangedSessions.length
      : 0;
  const prevAvgFocus =
    prevSessions.length > 0
      ? prevSessions.reduce((acc, s) => acc + (s.focusRating || 0), 0) / prevSessions.length
      : 0;

  const avgSessionMinutes = totalSessions > 0 ? totalMinutes / totalSessions : 0;
  const prevAvgSessionMinutes =
    prevTotalSessions > 0 ? prevTotalMinutes / prevTotalSessions : 0;

  // Best day within range.
  const dailyTotals = useMemo(() => {
    const map = new Map();
    rangedSessions.forEach(s => {
      map.set(s.date, (map.get(s.date) || 0) + getSessionMinutes(s));
    });
    return map;
  }, [rangedSessions]);

  let bestDay = { date: '', minutes: 0 };
  dailyTotals.forEach((minutes, date) => {
    if (minutes > bestDay.minutes) bestDay = { date, minutes };
  });

  // Longest single session within range.
  const longestSession = rangedSessions.reduce(
    (acc, s) => {
      const mins = getSessionMinutes(s);
      return mins > acc.minutes ? { minutes: mins, subjectName: s.subjectName, date: s.date } : acc;
    },
    { minutes: 0, subjectName: '', date: '' }
  );

  // Streak is global, not range-scoped — "you've shown up N days in a row" is
  // always about right now, regardless of which range the user is viewing.
  const streak = useMemo(() => currentStreakDays(sessions, todayStr), [sessions, todayStr]);

  // Active days within range: how many of the N days had at least one session.
  const activeDays = dailyTotals.size;
  const activeDaysPct = days > 0 ? Math.round((activeDays / days) * 100) : 0;

  // Subject-level avg focus, sorted highest first. Surfaces what the user
  // actually concentrates on vs what just eats clock time.
  const focusBySubject = useMemo(() => {
    return breakdown
      .filter(b => b.count > 0)
      .slice()
      .sort((a, b) => Number(b.avgFocus) - Number(a.avgFocus));
  }, [breakdown]);

  const donutItems = breakdown.map(b => ({
    label: b.name,
    value: b.minutes,
    color: b.color,
  }));

  const totalHours = formatHours(totalMinutes);
  const totalMinutesDelta = computeDelta(totalMinutes, prevTotalMinutes);
  const totalSessionsDelta = computeDelta(totalSessions, prevTotalSessions);
  const avgFocusDelta = computeDelta(avgFocus, prevAvgFocus);
  const avgSessionDelta = computeDelta(avgSessionMinutes, prevAvgSessionMinutes);

  const rangeLabel = RANGE_OPTIONS.find(o => o.value === range)?.label || '';
  const isEmpty = sessions.length === 0;
  const rangeEmpty = !isEmpty && rangedSessions.length === 0;

  return (
    <Container fluid className="sf-page">
      <div className="d-flex justify-content-between align-items-start flex-wrap gap-3 mb-4">
        <div>
          <h1 className="mb-1">Statistics</h1>
          <p className="text-muted mb-0">
            {isEmpty
              ? 'Start a session on the Dashboard to see stats here.'
              : `${rangeLabel} · ${startDate} → ${endDate}`}
          </p>
        </div>
        <Form.Select
          size="sm"
          value={range}
          onChange={e => setRange(e.target.value)}
          style={{ width: 200 }}
          aria-label="Statistics time range"
          disabled={isEmpty}
        >
          {RANGE_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Form.Select>
      </div>

      {isEmpty ? (
        <Card>
          <Card.Body className="text-center py-5">
            <div className="sf-section-label mb-2">No data yet</div>
            <div className="text-muted">
              Track a few sessions and your trends, focus, and goal progress will appear here.
            </div>
          </Card.Body>
        </Card>
      ) : (
        <>
          {/* Headline KPIs with prev-period deltas */}
          <Row className="g-3 mb-3">
            <Col md={3} sm={6}>
              <KpiCard
                label="Total Time"
                value={`${totalHours}h`}
                sub={`${formatDurationMinutes(totalMinutes)} in range`}
                delta={totalMinutesDelta}
              />
            </Col>
            <Col md={3} sm={6}>
              <KpiCard
                label="Sessions"
                value={totalSessions}
                sub={totalSessions === 1 ? 'session' : 'sessions'}
                delta={totalSessionsDelta}
              />
            </Col>
            <Col md={3} sm={6}>
              <KpiCard
                label="Avg Focus"
                value={
                  totalSessions > 0 ? (
                    <>
                      {avgFocus.toFixed(1)}
                      <span className="text-muted fs-6 fw-normal ms-1">/ 5</span>
                    </>
                  ) : (
                    '—'
                  )
                }
                sub={totalSessions > 0 ? 'across all sessions' : 'no sessions'}
                delta={avgFocusDelta}
              />
            </Col>
            <Col md={3} sm={6}>
              <KpiCard
                label="Avg Session"
                value={totalSessions > 0 ? formatDurationMinutes(avgSessionMinutes) : '—'}
                sub="per session"
                delta={avgSessionDelta}
              />
            </Col>
          </Row>

          {/* Secondary KPIs — range-aware highlights */}
          <Row className="g-3 mb-4">
            <Col md={3} sm={6}>
              <KpiCard
                label="Best Day"
                value={bestDay.minutes > 0 ? formatDurationMinutes(bestDay.minutes) : '—'}
                sub={bestDay.minutes > 0 ? formatShortDate(bestDay.date) : 'no sessions yet'}
              />
            </Col>
            <Col md={3} sm={6}>
              <KpiCard
                label="Longest Session"
                value={
                  longestSession.minutes > 0
                    ? formatDurationMinutes(longestSession.minutes)
                    : '—'
                }
                sub={
                  longestSession.minutes > 0
                    ? `${longestSession.subjectName} · ${formatShortDate(longestSession.date)}`
                    : 'no sessions yet'
                }
              />
            </Col>
            <Col md={3} sm={6}>
              <KpiCard
                label="Current Streak"
                value={`${streak} ${streak === 1 ? 'day' : 'days'}`}
                sub={streak > 0 ? 'keep it alive' : 'study today to start'}
              />
            </Col>
            <Col md={3} sm={6}>
              <KpiCard
                label="Days Studied"
                value={`${activeDays} / ${days}`}
                sub={`${activeDaysPct}% of the range`}
              />
            </Col>
          </Row>

          {/* Distribution row */}
          <Row className="g-3 mb-4">
            <Col lg={5}>
              <Card className="h-100">
                <Card.Header>Time Distribution</Card.Header>
                <Card.Body className="d-flex flex-column align-items-center justify-content-center">
                  <DonutChart
                    items={donutItems}
                    totalLabel="Total Hours"
                    totalValue={`${totalHours}h`}
                  />
                  <div className="sf-donut-legend mt-3">
                    {breakdown.length === 0 && (
                      <div className="text-muted small">No subjects yet.</div>
                    )}
                    {breakdown.map(b => {
                      const pct =
                        totalMinutes > 0 ? Math.round((b.minutes / totalMinutes) * 100) : 0;
                      return (
                        <div key={b.id} className="sf-donut-legend-item">
                          <span
                            className="sf-donut-legend-dot"
                            style={{ background: b.color }}
                          />
                          <span className="sf-donut-legend-name">{b.name}</span>
                          <span className="sf-donut-legend-pct">{pct}%</span>
                        </div>
                      );
                    })}
                  </div>
                </Card.Body>
              </Card>
            </Col>

            <Col lg={7}>
              <Card className="h-100">
                <Card.Header>Subject Breakdown</Card.Header>
                <Card.Body>
                  {breakdown.length === 0 && (
                    <div className="text-muted text-center py-3">No subjects yet.</div>
                  )}
                  {breakdown.length > 0 && totalMinutes === 0 && (
                    <div className="text-muted text-center py-3">
                      No time logged in this range.
                    </div>
                  )}
                  {breakdown.map(b => {
                    const pct =
                      totalMinutes > 0 ? Math.round((b.minutes / totalMinutes) * 100) : 0;
                    return (
                      <div key={b.id} className="mb-3">
                        <div className="d-flex justify-content-between align-items-center mb-1">
                          <div className="d-flex align-items-center gap-2">
                            <span
                              style={{
                                width: 10,
                                height: 10,
                                borderRadius: '50%',
                                background: b.color,
                                display: 'inline-block',
                              }}
                            />
                            <span style={{ fontWeight: 600 }}>{b.name}</span>
                            <span className="text-muted small">
                              · {b.count} {b.count === 1 ? 'session' : 'sessions'} · focus{' '}
                              {b.avgFocus}
                            </span>
                          </div>
                          <span className="fw-semibold small">
                            {formatHours(b.minutes)}h{' '}
                            <span className="text-muted">({pct}%)</span>
                          </span>
                        </div>
                        <div className="progress" style={{ height: 8 }}>
                          <div
                            className="progress-bar"
                            style={{ width: `${pct}%`, background: b.color }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </Card.Body>
              </Card>
            </Col>
          </Row>

          {/* Daily activity chart */}
          <Card className="mb-4">
            <Card.Header className="d-flex justify-content-between align-items-center">
              <span>Daily Activity</span>
              <span className="small text-muted">
                {bestDay.minutes > 0
                  ? `Peak: ${formatShortDate(bestDay.date)} (${formatDurationMinutes(bestDay.minutes)})`
                  : rangeLabel}
              </span>
            </Card.Header>
            <Card.Body>
              {rangeEmpty ? (
                <div className="text-muted text-center py-4">
                  No sessions in this range.
                </div>
              ) : (
                <DailyActivityChart
                  sessions={rangedSessions}
                  startDate={startDate}
                  days={days}
                />
              )}
            </Card.Body>
          </Card>

          {/* Day-of-week + focus quality */}
          <Row className="g-3">
            <Col lg={6}>
              <Card className="h-100">
                <Card.Header>By Day of Week</Card.Header>
                <Card.Body>
                  <DayOfWeekChart sessions={rangedSessions} />
                </Card.Body>
              </Card>
            </Col>
            <Col lg={6}>
              <Card className="h-100">
                <Card.Header>Focus Quality</Card.Header>
                <Card.Body>
                  {focusBySubject.length === 0 ? (
                    <div className="text-muted text-center py-4">
                      No rated sessions in this range.
                    </div>
                  ) : (
                    focusBySubject.map(b => {
                      const focusPct = Math.round((Number(b.avgFocus) / 5) * 100);
                      return (
                        <div key={b.id} className="mb-3">
                          <div className="d-flex justify-content-between align-items-center mb-1">
                            <div className="d-flex align-items-center gap-2">
                              <span
                                style={{
                                  width: 10,
                                  height: 10,
                                  borderRadius: '50%',
                                  background: b.color,
                                  display: 'inline-block',
                                }}
                              />
                              <span style={{ fontWeight: 600 }}>{b.name}</span>
                              <span className="text-muted small">
                                · {b.count} {b.count === 1 ? 'session' : 'sessions'}
                              </span>
                            </div>
                            <span className="fw-semibold small">
                              {b.avgFocus} <span className="text-muted">/ 5</span>
                            </span>
                          </div>
                          <div className="progress" style={{ height: 8 }}>
                            <div
                              className="progress-bar"
                              style={{
                                width: `${focusPct}%`,
                                background: b.color,
                              }}
                            />
                          </div>
                        </div>
                      );
                    })
                  )}
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </>
      )}
    </Container>
  );
}
