import { useState } from 'react';
import { Container, Row, Col, Button } from 'react-bootstrap';
import SubjectForm from '../components/SubjectForm';
import SubjectCard from '../components/SubjectCard';
import WeeklyOverviewCard from '../components/WeeklyOverviewCard';
import { useStudyData } from '../context/StudyDataContext';
import { sessionMatchesSubject, getSessionMinutes } from '../utils/sessions';

const IconPlus = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M8 3v10M3 8h10" />
  </svg>
);

export default function SubjectManager() {
  const { subjects, sessions, addSubject, updateSubject, deleteSubject } = useStudyData();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [now] = useState(() => Date.now());

  const weekAgo = now - 7 * 86400000;
  const recentSessions = sessions.filter(s => new Date(s.date).getTime() >= weekAgo);
  const weeklyMinutesBySubject = {};
  subjects.forEach(subject => {
    const mins = recentSessions
      .filter(sess => sessionMatchesSubject(sess, subject))
      .reduce((acc, sess) => acc + getSessionMinutes(sess), 0);
    weeklyMinutesBySubject[subject.id] = mins;
  });

  function handleAdd(newSubject) {
    addSubject(newSubject);
    setShowForm(false);
  }

  function handleDelete(id) {
    deleteSubject(id);
  }

  function handleEditOpen(subject) {
    setEditingId(subject.id);
    setShowForm(false);
  }

  function handleEditSave(updates) {
    if (editingId !== null) updateSubject(editingId, updates);
    setEditingId(null);
  }

  const editingSubject = subjects.find(s => s.id === editingId) || null;

  return (
    <Container fluid className="sf-page">
      <div className="d-flex flex-wrap justify-content-between align-items-start mb-4 gap-2">
        <div>
          <h1 className="mb-1">Subjects</h1>
          <p className="text-muted mb-0">
            What you're tracking. Set goals. Watch progress compound.
          </p>
        </div>
        {!showForm && !editingSubject && (
          <Button
            variant="primary"
            onClick={() => { setShowForm(true); setEditingId(null); }}
            className="d-flex align-items-center gap-2"
          >
            <IconPlus />
            New subject
          </Button>
        )}
      </div>

      {/* Collapsible create-subject card, unfolds inline */}
      <div className={`sf-collapsible${showForm ? ' sf-collapsible-open' : ''}`}>
        {showForm && (
          <div className="mb-4">
            <SubjectForm
              onAdd={handleAdd}
              onCancel={() => setShowForm(false)}
            />
          </div>
        )}
      </div>

      {/* Edit-subject card, same component, edit mode */}
      <div className={`sf-collapsible${editingSubject ? ' sf-collapsible-open' : ''}`}>
        {editingSubject && (
          <div className="mb-4">
            <SubjectForm
              initial={editingSubject}
              onSave={handleEditSave}
              onCancel={() => setEditingId(null)}
            />
          </div>
        )}
      </div>

      {subjects.length === 0 ? (
        <div className="sf-empty-card">
          <h2 className="sf-empty-title-sm">No subjects yet.</h2>
          <p className="text-muted mb-3">
            Add your first subject to start tracking real study time.
          </p>
          {!showForm && (
            <Button variant="primary" onClick={() => setShowForm(true)}>
              <IconPlus /> Create your first subject
            </Button>
          )}
        </div>
      ) : (
        <>
          <Row className="g-3">
            {subjects.map(subject => (
              <Col key={subject.id} md={6} lg={4}>
                <SubjectCard
                  subject={subject}
                  weeklyMinutes={weeklyMinutesBySubject[subject.id] || 0}
                  onDelete={handleDelete}
                  onEdit={handleEditOpen}
                />
              </Col>
            ))}
          </Row>

          <div className="mt-4">
            <WeeklyOverviewCard
              subjects={subjects}
              weeklyMinutesBySubject={weeklyMinutesBySubject}
            />
          </div>
        </>
      )}
    </Container>
  );
}
