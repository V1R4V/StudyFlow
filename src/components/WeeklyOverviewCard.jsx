import { Card } from 'react-bootstrap';

export default function WeeklyOverviewCard(props) {
  const { subjects, weeklyMinutesBySubject } = props;

  const totalMinutes = Object.values(weeklyMinutesBySubject).reduce(
    (acc, m) => acc + m,
    0
  );
  const totalGoalHours = subjects.reduce(
    (acc, s) => acc + (s.weeklyGoal || 0),
    0
  );
  const totalHours = (totalMinutes / 60).toFixed(1);

  const topSubjects = [...subjects]
    .map(s => ({ ...s, minutes: weeklyMinutesBySubject[s.id] || 0 }))
    .sort((a, b) => b.minutes - a.minutes)
    .slice(0, 3);

  return (
    <Card className="sf-overview-card sf-card-panel">
      <Card.Body className="d-flex justify-content-between align-items-center">
        <div>
          <div className="fw-bold" style={{ color: 'var(--primary)' }}>
            Weekly Overview
          </div>
          <small className="text-muted">
            Total study time: {totalHours} / {totalGoalHours} scheduled hours
          </small>
        </div>
        <div className="d-flex align-items-center">
          {topSubjects.map((s, i) => (
            <div
              key={s.id}
              className="sf-overview-dot"
              style={{ background: s.color, marginLeft: i === 0 ? 0 : -8 }}
              title={s.name}
            />
          ))}
          {subjects.length > 3 && (
            <div className="sf-overview-dot sf-overview-dot-more">
              +{subjects.length - 3}
            </div>
          )}
        </div>
      </Card.Body>
    </Card>
  );
}
