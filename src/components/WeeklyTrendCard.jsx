import { Card, Row, Col } from 'react-bootstrap';
import CardExpand from './CardExpand';

export default function WeeklyTrendCard(props) {
  const days = props.dailyMinutes || [];
  const maxMinutes = Math.max(...days.map(d => d.minutes), 60);

  const totalMinutes = days.reduce((acc, d) => acc + d.minutes, 0);
  const totalHours = (totalMinutes / 60).toFixed(1);
  const avgHours = (totalMinutes / 7 / 60).toFixed(1);

  // Find peak day
  const peak = days.reduce(
    (acc, d) => (d.minutes > acc.minutes ? d : acc),
    { minutes: 0, label: '–' }
  );

  // Chart layout
  const chartWidth = 280;
  const chartHeight = 100;
  const barGap = 8;
  const barWidth = (chartWidth - barGap * 7) / 7;

  return (
    <Card className="h-100 sf-card-panel">
      <Card.Body className="sf-panel-body">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h2 className="h5 mb-0">Weekly Trend</h2>
          <CardExpand to="/app/statistics" label="Open Statistics" />
        </div>

        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight + 20}`}
          width="100%"
          style={{ maxHeight: 140 }}
          role="img"
          aria-label={`Bar chart of study minutes per day for the last 7 days. ${days
            .map(d => `${d.label}: ${d.minutes} minutes`)
            .join(', ')}.`}
        >
          <defs>
            <linearGradient id="sfTrendBar" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary-light)" />
              <stop offset="100%" stopColor="var(--primary)" />
            </linearGradient>
          </defs>
          {days.map((d, i) => {
            const h =
              maxMinutes > 0 ? (d.minutes / maxMinutes) * chartHeight : 0;
            const x = i * (barWidth + barGap);
            const y = chartHeight - h;
            const isPeak = d.minutes > 0 && d.minutes === peak.minutes;
            const dayHours = (d.minutes / 60).toFixed(1);
            return (
              <g key={i}>
                <title>{`${d.label}: ${dayHours}h logged. Weekly total: ${totalHours}h.`}</title>
                {/* faint track behind each bar for a fuller, premium look */}
                <rect
                  x={x}
                  y={0}
                  width={barWidth}
                  height={chartHeight}
                  fill="var(--primary)"
                  opacity={0.06}
                  rx={4}
                />
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={h}
                  fill="url(#sfTrendBar)"
                  rx={4}
                  opacity={d.minutes > 0 ? 1 : 0.25}
                  style={isPeak ? { filter: 'drop-shadow(0 3px 6px var(--focus-ring))' } : undefined}
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

        <Row className="mt-auto pt-3 border-top">
          <Col>
            <div className="text-muted small">
              DAILY AVG
            </div>
            <div className="fw-bold fs-5">{avgHours}h</div>
          </Col>
          <Col>
            <div className="text-muted small">
              PEAK DAY
            </div>
            <div className="fw-bold fs-5">
              {peak.label}{' '}
              {peak.minutes > 0 && (
                <small className="text-muted fw-normal">
                  ({(peak.minutes / 60).toFixed(1)}h)
                </small>
              )}
            </div>
          </Col>
        </Row>
      </Card.Body>
    </Card>
  );
}
