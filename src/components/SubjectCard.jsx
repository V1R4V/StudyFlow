import { Card, Button } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { subjectKey } from '../utils/plan';

export default function SubjectCard({ subject, onEdit, onDelete }) {
  function handleDelete() {
    if (window.confirm(`Delete "${subject.name}"?`)) onDelete(subject.id);
  }
  return (
    <Card className="h-100 sf-card-panel">
      <Card.Body>
        <div className="d-flex flex-wrap align-items-start justify-content-between gap-3 mb-4">
          <div className="d-flex align-items-center gap-3 min-w-0">
            <div className="sf-subject-icon sf-subject-icon-lg" style={{ background: subject.color }}>{subject.name?.[0]?.toUpperCase() || '?'}</div>
            <h2 className="h5 mb-0 sf-subject-name">{subject.name}</h2>
          </div>
          <div className="d-flex gap-2">
            <Button size="sm" variant="outline-secondary" aria-label={`Edit ${subject.name}`} onClick={() => onEdit(subject)}>Edit</Button>
            <Button size="sm" variant="outline-danger" aria-label={`Delete ${subject.name}`} onClick={handleDelete}>Delete</Button>
          </div>
        </div>
        <div className="d-flex justify-content-between flex-wrap gap-2 small">
          <Link to={`/app/sessions?${new URLSearchParams({ subject: subjectKey(subject) })}`}>View sessions</Link>
          <Link to="/app/command#weekly-planner">Goals & schedule →</Link>
        </div>
      </Card.Body>
    </Card>
  );
}
