import { useState } from 'react';
import { Container, Row, Col, Button } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import SubjectForm from '../components/SubjectForm';
import SubjectCard from '../components/SubjectCard';
import { useStudyData } from '../context/StudyDataContext';

export default function SubjectManager() {
  const { subjects, addSubject, updateSubject, deleteSubject } = useStudyData();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const editingSubject = subjects.find(subject => subject.id === editingId) || null;

  async function handleAdd(subject) {
    await addSubject(subject);
    setShowForm(false);
  }
  async function handleSave(updates) {
    if (editingId !== null) await updateSubject(editingId, updates);
    setEditingId(null);
  }
  return (
    <Container fluid className="sf-page">
      <div className="d-flex flex-wrap justify-content-between align-items-start mb-4 gap-3">
        <div>
          <h1 className="mb-1">Subjects</h1>
          <p className="text-muted mb-0">Manage your subject names and colors. <Link to="/app/command">Set goals and plan your week in Command Center.</Link></p>
        </div>
        {!showForm && !editingSubject && <Button onClick={() => setShowForm(true)}>+ New subject</Button>}
      </div>
      {showForm && <div className="mb-4"><SubjectForm onAdd={handleAdd} onCancel={() => setShowForm(false)} /></div>}
      {editingSubject && <div className="mb-4"><SubjectForm key={editingSubject.id} initial={editingSubject} onSave={handleSave} onCancel={() => setEditingId(null)} /></div>}
      {subjects.length === 0 ? (
        <div className="sf-empty-card">
          <h2 className="sf-empty-title-sm">No subjects yet.</h2>
          <p className="text-muted mb-3">Add your first subject to start tracking study time.</p>
          {!showForm && <Button onClick={() => setShowForm(true)}>Create your first subject</Button>}
        </div>
      ) : (
        <Row className="g-3">
          {subjects.map(subject => <Col key={subject.firestoreId || subject.id} md={6} lg={4}>
            <SubjectCard subject={subject} onEdit={subject => { setEditingId(subject.id); setShowForm(false); }} onDelete={deleteSubject} />
          </Col>)}
        </Row>
      )}
    </Container>
  );
}
