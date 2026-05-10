import { useState } from 'react';
import { Container, Row, Col, Button } from 'react-bootstrap';
import SubjectForm from '../components/SubjectForm';
import SubjectCard from '../components/SubjectCard';
import WeeklyOverviewCard from '../components/WeeklyOverviewCard';
import { useStudyData } from '../context/StudyDataContext';

const IconPlus = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M8 3v10M3 8h10" />
  </svg>
);

function getSessionMinutes(session) {
  if (typeof session.durationSeconds === 'number') return session.durationSeconds / 60;
  if (typeof session.duration === 'number') return session.duration;
  return 0;
}

export default function SubjectManager() {
  const { subjects, sessions, addSubject, deleteSubject } = useStudyData();
  const [showForm, setShowForm] = useState(false);
  const [now] = useState(() => Date.now());

  const weekAgo = now - 7 * 86400000;
  const weeklyMinutesBySubject = {};
  sessions.forEach(s => {
    if (new Date(s.date).getTime() >= weekAgo) {
      weeklyMinutesBySubject[s.subjectId] =
        (weeklyMinutesBySubject[s.subjectId] || 0) + getSessionMinutes(s);
    }
  });

  function handleAdd(newSubject) {
    addSubject(newSubject);
    setShowForm(false);
  }

  function handleDelete(id) {
    deleteSubject(id);
  }

  return (
    <Container fluid className="sf-page">
      <div className="d-flex flex-wrap justify-content-between align-items-start mb-4 gap-2">
        <div>
          <h1 className="mb-1">Subjects</h1>
          <p className="text-muted mb-0">
            What you're tracking. Set goals. Watch progress compound.
          </p>
        </div>
        {!showForm && (
          <Button
            variant="primary"
            onClick={() => setShowForm(true)}
            className="d-flex align-items-center gap-2"
          >
            <IconPlus />
            New subject
          </Button>
        )}
      </div>

      {/* Collapsible create-subject card — unfolds inline */}
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
