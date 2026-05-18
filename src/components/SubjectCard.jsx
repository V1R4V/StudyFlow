import { Card, Button } from 'react-bootstrap';

export default function SubjectCard(props) {
  const { subject, weeklyMinutes, onEdit } = props;
  const weeklyGoal = subject.weeklyGoal || 0;
  const weeklyGoalMin = weeklyGoal * 60;
  const hoursStudied = (weeklyMinutes / 60).toFixed(1);
  const percent =
    weeklyGoalMin > 0
      ? Math.min(100, Math.round((weeklyMinutes / weeklyGoalMin) * 100))
      : 0;

  function handleDelete() {
    if (window.confirm(`Delete "${subject.name}"?`)) {
      props.onDelete(subject.id);
    }
  }

  const initial = subject.name?.[0]?.toUpperCase() || '?';

  return (
    <Card className="mb-3 sf-card-panel">
      <Card.Body>
        <div className="d-flex align-items-start justify-content-between mb-3">
          <div className="d-flex align-items-center gap-3">
            <div
              className="sf-subject-icon sf-subject-icon-lg"
              style={{ background: subject.color }}
            >
              {initial}
            </div>
            <div>
              <h3 className="h5 mb-0">{subject.name}</h3>
              <small className="text-muted">
                Goal: {weeklyGoal} hours / week
              </small>
            </div>
          </div>
          <div className="d-flex gap-2">
            {onEdit && (
              <Button size="sm" variant="outline-secondary" onClick={() => onEdit(subject)}>
                Edit
              </Button>
            )}
            <Button size="sm" variant="outline-danger" onClick={handleDelete}>
              Delete
            </Button>
          </div>
        </div>

        <div className="d-flex justify-content-between small mb-1">
          <span style={{ color: 'var(--muted-strong)' }}>Weekly Progress</span>
          <span style={{ color: 'var(--text-dark)', fontWeight: 600 }}>
            {hoursStudied} / {weeklyGoal} Hours ({percent}%)
          </span>
        </div>
        <div
          className="progress"
          style={{ height: 8 }}
          role="progressbar"
          aria-label={`${subject.name} weekly progress`}
          aria-valuenow={percent}
          aria-valuemin="0"
          aria-valuemax="100"
        >
          <div
            className="progress-bar"
            style={{ width: `${percent}%`, background: subject.color }}
          />
        </div>
      </Card.Body>
    </Card>
  );
}
