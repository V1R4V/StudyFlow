import { useMemo } from 'react';
import { Card, Row, Col, Button } from 'react-bootstrap';
import { useStudyData } from '../context/StudyDataContext';
import { summarizeBreaks, ratioText, getBreakMinutes } from '../utils/breaks';
import { localDateString, shiftDateStr } from '../utils/sessions';

const TYPE_LABELS = { short: 'Short', long: 'Long', custom: 'Custom' };

// "75m" → "1h 15m", "8m" → "8m".
function formatMins(mins) {
  const total = Math.round(mins);
  if (total < 60) return `${total}m`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function relativeDay(dateStr, todayStr) {
  if (dateStr === todayStr) return 'Today';
  if (dateStr === shiftDateStr(todayStr, -1)) return 'Yesterday';
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function Stat({ label, value, sub }) {
  return (
    <div className="sf-break-stat">
      <div className="text-muted small">{label}</div>
      <div className="fw-bold fs-5">{value}</div>
      {sub && <div className="small" style={{ color: 'var(--muted-strong)' }}>{sub}</div>}
    </div>
  );
}

export default function BreakStatsCard() {
  const { breaks, sessions, deleteBreak } = useStudyData();
  const todayStr = localDateString();

  const s = useMemo(
    () => summarizeBreaks(breaks, sessions, todayStr),
    [breaks, sessions, todayStr]
  );

  const recent = useMemo(
    () =>
      [...breaks]
        .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (b.id || 0) - (a.id || 0)))
        .slice(0, 6),
    [breaks]
  );

  const maxMinutes = Math.max(...s.last7.map(d => d.minutes), 10);
  const chartWidth = 280;
  const chartHeight = 90;
  const barGap = 8;
  const barWidth = (chartWidth - barGap * 7) / 7;

  return (
    <Card className="h-100 sf-card-panel">
      <Card.Body>
        <div className="d-flex justify-content-between align-items-center mb-1">
          <h2 className="h5 mb-0">Break Insights</h2>
          <span className="sf-pill sf-pill-break" aria-hidden="true">EXTRA INFO</span>
        </div>
        <p className="small mb-3" style={{ color: 'var(--muted-strong)' }}>
          Tracked separately. Breaks never count toward your focus time.
        </p>

        {breaks.length === 0 ? (
          <div className="text-center py-4" style={{ color: 'var(--muted-strong)' }}>
            No breaks logged yet. Start a break to see your rest patterns here.
          </div>
        ) : (
          <>
            <Row className="g-3 mb-3">
              <Col xs={6} md={3}>
                <Stat
                  label="TODAY"
                  value={formatMins(s.todayMinutes)}
                  sub={`${s.todayCount} break${s.todayCount === 1 ? '' : 's'}`}
                />
              </Col>
              <Col xs={6} md={3}>
                <Stat
                  label="THIS WEEK"
                  value={formatMins(s.weekMinutes)}
                  sub={`${s.weekCount} break${s.weekCount === 1 ? '' : 's'}`}
                />
              </Col>
              <Col xs={6} md={3}>
                <Stat label="AVG LENGTH" value={formatMins(s.avgMinutes)} sub="per break" />
              </Col>
              <Col xs={6} md={3}>
                <Stat
                  label="WORK : BREAK"
                  value={ratioText(s.studyWeek, s.weekMinutes)}
                  sub="this week"
                />
              </Col>
            </Row>

            <div className="text-muted small mb-1">
              LAST 7 DAYS · BREAK MINUTES
            </div>
            <svg
              viewBox={`0 0 ${chartWidth} ${chartHeight + 20}`}
              width="100%"
              style={{ maxHeight: 130 }}
              role="img"
              aria-label={`Break minutes per day for the last 7 days. ${s.last7
                .map(d => `${d.label}: ${d.minutes} minutes`)
                .join(', ')}.`}
            >
              {s.last7.map((d, i) => {
                const h = maxMinutes > 0 ? (d.minutes / maxMinutes) * chartHeight : 0;
                const x = i * (barWidth + barGap);
                const y = chartHeight - h;
                return (
                  <g key={d.date}>
                    <rect
                      x={x}
                      y={y}
                      width={barWidth}
                      height={h}
                      fill="var(--break-accent)"
                      rx={3}
                      opacity={d.minutes > 0 ? 1 : 0.3}
                    />
                    <text
                      x={x + barWidth / 2}
                      y={chartHeight + 15}
                      textAnchor="middle"
                      fontSize="9"
                      fill="var(--muted-strong)"
                      fontWeight="600"
                    >
                      {d.label}
                    </text>
                  </g>
                );
              })}
            </svg>

            <div className="text-muted small mb-2 mt-3">
              RECENT BREAKS
            </div>
            <ul className="list-unstyled mb-0">
              {recent.map(brk => (
                <li
                  key={brk.firestoreId || brk.id}
                  className="d-flex align-items-center justify-content-between py-2 sf-break-row"
                >
                  <div className="d-flex align-items-center gap-2">
                    <span className="sf-pill sf-pill-break">
                      {TYPE_LABELS[brk.type] || 'Break'}
                    </span>
                    <span className="fw-semibold">{formatMins(getBreakMinutes(brk))}</span>
                  </div>
                  <div className="d-flex align-items-center gap-2">
                    <span className="small" style={{ color: 'var(--muted-strong)' }}>
                      {relativeDay(brk.date, todayStr)}
                    </span>
                    <Button
                      variant="link"
                      size="sm"
                      className="p-0 text-danger"
                      onClick={() => deleteBreak(brk.id)}
                      aria-label="Delete break"
                      title="Delete break"
                    >
                      ✕
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card.Body>
    </Card>
  );
}
