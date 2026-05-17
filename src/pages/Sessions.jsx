import { useState } from 'react';
import { Container, Card, Form, Table, Button } from 'react-bootstrap';
import EndSessionModal from '../components/EndSessionModal';
import { useStudyData } from '../context/StudyDataContext';
import { sessionMatchesSubject } from '../utils/sessions';

function getSessionSeconds(session) {
  if (typeof session.durationSeconds === 'number') return session.durationSeconds;
  if (typeof session.duration === 'number') return session.duration * 60;
  return 0;
}

function formatDuration(seconds) {
  const total = Math.max(0, Math.floor(seconds));
  if (total < 60) return `${total} sec`;
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (s === 0) return `${m} min`;
  return `${m} min ${s} sec`;
}

function Stars({ rating }) {
  const n = rating || 0;
  return (
    <span style={{ fontSize: 14, whiteSpace: 'nowrap' }} aria-label={`Focus rating: ${n} of 5`}>
      <span aria-hidden="true" style={{ color: 'var(--warning-text)' }}>{'★'.repeat(n)}</span>
      <span aria-hidden="true" style={{ color: '#9ca3af' }}>{'★'.repeat(5 - n)}</span>
    </span>
  );
}

export default function Sessions() {
  const { subjects, sessions, updateSession, deleteSession } = useStudyData();
  const [filterSubject, setFilterSubject] = useState('all');
  const [editing, setEditing] = useState(null);

  function handleDelete(id) {
    if (!window.confirm('Delete this session?')) return;
    deleteSession(id);
  }

  function handleEditSave(details) {
    updateSession(editing.id, {
      focusRating: details.focusRating,
      notes: details.notes,
    });
    setEditing(null);
  }

  const filtered = filterSubject === 'all'
    ? sessions
    : sessions.filter(s => String(s.subjectId) === filterSubject);

  return (
    <Container fluid className="sf-page">
      <div className="mb-4">
        <h1 className="mb-1">Sessions</h1>
        <p className="text-muted mb-0">
          Full session history. Edit ratings or notes anytime.
        </p>
      </div>

      <Card>
        <Card.Header className="d-flex justify-content-between align-items-center flex-wrap gap-2">
          <h2 className="h6 mb-0 fw-semibold">Session History</h2>
          <Form.Group controlId="session-filter" className="d-flex align-items-center gap-2 mb-0">
            <Form.Label className="mb-0 small text-muted">Filter</Form.Label>
            <Form.Select
              size="sm"
              style={{ width: 220 }}
              value={filterSubject}
              onChange={e => setFilterSubject(e.target.value)}
            >
              <option value="all">All subjects</option>
              {subjects.map(s => (
                <option key={s.id} value={s.firestoreId ?? s.id}>{s.name}</option>
              ))}
            </Form.Select>
          </Form.Group>
        </Card.Header>

        {filtered.length === 0 ? (
          <Card.Body className="text-center text-muted py-5">
            {sessions.length === 0
              ? 'No sessions yet. Start the timer on your Dashboard.'
              : 'No sessions match this filter.'}
          </Card.Body>
        ) : (
          <Table hover responsive className="mb-0 align-middle">
            <thead>
              <tr>
                <th>Date</th>
                <th>Subject</th>
                <th>Duration</th>
                <th>Focus</th>
                <th>Notes</th>
                <th className="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => {
                const subj = subjects.find(sub => sessionMatchesSubject(s, sub));
                const color = subj?.color || s.subjectColor || '#6b7280';
                return (
                  <tr key={s.id}>
                    <td>{s.date}</td>
                    <td>
                      <span className="d-inline-flex align-items-center gap-2">
                        <span
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            background: color,
                            display: 'inline-block',
                          }}
                        />
                        {s.subjectName}
                      </span>
                    </td>
                    <td>{formatDuration(getSessionSeconds(s))}</td>
                    <td><Stars rating={s.focusRating} /></td>
                    <td style={{ maxWidth: 280 }}>
                      {s.notes ? (
                        <span title={s.notes}>
                          {s.notes.length > 50 ? s.notes.slice(0, 50) + '…' : s.notes}
                        </span>
                      ) : (
                        <span className="text-muted">·</span>
                      )}
                    </td>
                    <td className="text-end">
                      <Button
                        size="sm"
                        variant="outline-secondary"
                        className="me-2"
                        onClick={() => setEditing(s)}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline-danger"
                        onClick={() => handleDelete(s.id)}
                        aria-label={`Delete ${s.subjectName} session from ${s.date}`}
                      >
                        <span aria-hidden="true">×</span>
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>

      {editing && (
        <EndSessionModal
          show={true}
          title="Edit Session"
          seconds={getSessionSeconds(editing)}
          initialRating={editing.focusRating}
          initialNotes={editing.notes}
          saveLabel="Save changes"
          discardLabel="Cancel"
          onSave={handleEditSave}
          onDiscard={() => setEditing(null)}
        />
      )}
    </Container>
  );
}
