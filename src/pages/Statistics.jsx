import { Container, Row, Col, Card } from 'react-bootstrap';
import { useStudyData } from '../context/StudyDataContext';

function getSessionMinutes(session) {
  if (typeof session.durationSeconds === 'number') return session.durationSeconds / 60;
  if (typeof session.duration === 'number') return session.duration;
  return 0;
}

// Builds an SVG donut chart from { label, value, color } items.
// Center shows the total. Returns an empty state when total is 0.
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
        <div className="sf-donut-empty-text">No data yet</div>
      </div>
    );
  }

  let offset = 0;
  return (
    <svg viewBox="0 0 200 200" width="200" height="200" role="img" aria-label="Time distribution by subject">
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
        fontSize="28"
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

// Bar chart of minutes per day for the last `days` days.
function DailyActivityChart({ sessions, days = 14 }) {
  const today = new Date();
  const data = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
    const dateStr = d.toISOString().slice(0, 10);
    const minutes = sessions
      .filter(s => s.date === dateStr)
      .reduce((acc, s) => acc + getSessionMinutes(s), 0);
    data.push({ date: dateStr, minutes, day: d.getDate(), month: d.getMonth() + 1 });
  }

  const max = Math.max(...data.map(d => d.minutes), 60);
  const chartWidth = 800;
  const chartHeight = 140;
  const gap = 6;
  const barWidth = (chartWidth - gap * (days - 1)) / days;

  return (
    <svg
      viewBox={`0 0 ${chartWidth} ${chartHeight + 24}`}
      width="100%"
      role="img"
      aria-label={`Daily study minutes for the last ${days} days`}
    >
      {data.map((d, i) => {
        const h = max > 0 ? (d.minutes / max) * chartHeight : 0;
        const x = i * (barWidth + gap);
        const y = chartHeight - h;
        const isToday = i === days - 1;
        return (
          <g key={i}>
            <rect
              x={x}
              y={y}
              width={barWidth}
              height={Math.max(h, 2)}
              rx={3}
              fill={isToday ? 'var(--primary)' : 'var(--primary)'}
              opacity={d.minutes > 0 ? (isToday ? 1 : 0.7) : 0.15}
            />
            <text
              x={x + barWidth / 2}
              y={chartHeight + 18}
              textAnchor="middle"
              fontSize="10"
              fontWeight="600"
              fill="var(--text-light)"
            >
              {d.day}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export default function Statistics() {
  const { subjects, sessions } = useStudyData();

  const breakdown = subjects
    .map(s => {
      const subjSessions = sessions.filter(sess => sess.subjectId === s.id);
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

  const totalMinutes = breakdown.reduce((acc, b) => acc + b.minutes, 0);
  const totalHours = (totalMinutes / 60).toFixed(1);

  const overallAvgFocus =
    sessions.length > 0
      ? (
          sessions.reduce((acc, s) => acc + (s.focusRating || 0), 0) /
          sessions.length
        ).toFixed(1)
      : '—';

  // Best day in the last 14 days
  const last14 = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const dateStr = d.toISOString().slice(0, 10);
    const minutes = sessions
      .filter(s => s.date === dateStr)
      .reduce((acc, s) => acc + getSessionMinutes(s), 0);
    last14.push({ date: dateStr, minutes });
  }
  const bestDay = last14.reduce((acc, d) => (d.minutes > acc.minutes ? d : acc), {
    date: '',
    minutes: 0,
  });
  const last14Total = last14.reduce((acc, d) => acc + d.minutes, 0);
  const last14Avg = (last14Total / 14 / 60).toFixed(1);

  const donutItems = breakdown.map(b => ({
    label: b.name,
    value: b.minutes,
    color: b.color,
  }));

  return (
    <Container fluid className="sf-page">
      <div className="mb-4">
        <h1 className="mb-1">Statistics</h1>
        <p className="text-muted mb-0">Where your hours actually go.</p>
      </div>

      {/* Top stat cards */}
      <Row className="g-3 mb-4">
        <Col md={3} sm={6}>
          <Card className="h-100">
            <Card.Body>
              <div className="sf-section-label mb-2">Total Study Time</div>
              <div className="sf-stats-value">{totalHours}h</div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3} sm={6}>
          <Card className="h-100">
            <Card.Body>
              <div className="sf-section-label mb-2">Total Sessions</div>
              <div className="sf-stats-value">{sessions.length}</div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3} sm={6}>
          <Card className="h-100">
            <Card.Body>
              <div className="sf-section-label mb-2">Avg Focus</div>
              <div className="sf-stats-value">
                {overallAvgFocus}
                <span className="text-muted fs-6 fw-normal ms-1">/ 5</span>
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3} sm={6}>
          <Card className="h-100">
            <Card.Body>
              <div className="sf-section-label mb-2">14-Day Avg</div>
              <div className="sf-stats-value">{last14Avg}h</div>
              <div className="small text-muted mt-1">per day</div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Distribution row: donut + breakdown bars */}
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
                {breakdown.map(b => {
                  const pct = totalMinutes > 0 ? Math.round((b.minutes / totalMinutes) * 100) : 0;
                  return (
                    <div key={b.id} className="sf-donut-legend-item">
                      <span className="sf-donut-legend-dot" style={{ background: b.color }} />
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
              {breakdown.map(b => {
                const pct = totalMinutes > 0 ? Math.round((b.minutes / totalMinutes) * 100) : 0;
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
                          · {b.count} {b.count === 1 ? 'session' : 'sessions'} · focus {b.avgFocus}
                        </span>
                      </div>
                      <span className="fw-semibold small">
                        {(b.minutes / 60).toFixed(1)}h <span className="text-muted">({pct}%)</span>
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
      <Card>
        <Card.Header className="d-flex justify-content-between align-items-center">
          <span>Daily Activity</span>
          <span className="small text-muted">
            {bestDay.minutes > 0
              ? `Best day: ${bestDay.date} (${(bestDay.minutes / 60).toFixed(1)}h)`
              : 'Last 14 days'}
          </span>
        </Card.Header>
        <Card.Body>
          {sessions.length === 0 ? (
            <div className="text-muted text-center py-4">
              No sessions yet. Start the timer on your Dashboard.
            </div>
          ) : (
            <DailyActivityChart sessions={sessions} days={14} />
          )}
        </Card.Body>
      </Card>
    </Container>
  );
}
