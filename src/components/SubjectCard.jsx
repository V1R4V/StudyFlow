import { Card, Button } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { subjectKey } from '../utils/plan';
import Icon from './Icon';

export default function SubjectCard({ subject, onEdit, onDelete }) {
  function handleDelete() {
    if (window.confirm(`Delete "${subject.name}"?`)) onDelete(subject.id);
  }
  return (
    <Card className="h-100 sf-card-panel sf-subject-card">
      <Card.Body>
        <div className="sf-subject-card-heading">
          <div className="sf-subject-identity">
            <div className="sf-subject-symbol" style={{ '--subject-color': subject.color }}><Icon name="book" size={22} /></div>
            <h2 className="h5 mb-0 sf-subject-name">{subject.name}</h2>
          </div>
          <div className="sf-subject-card-actions">
            <Button size="sm" variant="outline-secondary" aria-label={`Edit ${subject.name}`} title="Edit subject" onClick={() => onEdit(subject)}><Icon name="edit" size={16} /></Button>
            <Button size="sm" variant="outline-danger" aria-label={`Delete ${subject.name}`} title="Delete subject" onClick={handleDelete}><Icon name="trash" size={16} /></Button>
          </div>
        </div>
        <div className="sf-subject-card-links small">
          <Link to={`/app/sessions?${new URLSearchParams({ subject: subjectKey(subject) })}`}>View sessions <Icon name="arrowRight" size={15} /></Link>
          <Link to="/app/command#weekly-planner">Goals & schedule <Icon name="calendar" size={15} /></Link>
        </div>
      </Card.Body>
    </Card>
  );
}
