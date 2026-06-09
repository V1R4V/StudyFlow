import { useMemo } from 'react';
import { Card, Button } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { useStudyData } from '../context/StudyDataContext';
import { localDateString } from '../utils/sessions';
import { planForDate, loggedHoursFor } from '../utils/plan';

const round1 = n => Math.round(n * 10) / 10;

export default function TodayPlanCard() {
  const { subjects, sessions, planEntries } = useStudyData();
  const todayStr = localDateString();

  const items = useMemo(
    () =>
      planForDate(subjects, planEntries, todayStr).map(({ subject, plannedHours }) => {
        const logged = loggedHoursFor(sessions, subject, todayStr);
        const pct = plannedHours > 0 ? Math.min(100, Math.round((logged / plannedHours) * 100)) : 0;
        return { subject, plannedHours, logged, pct, done: logged >= plannedHours };
      }),
    [subjects, planEntries, sessions, todayStr]
  );

  const plannedTotal = round1(items.reduce((a, i) => a + i.plannedHours, 0));
  const loggedTotal = round1(items.reduce((a, i) => a + Math.min(i.logged, i.plannedHours), 0));
  const remaining = round1(Math.max(0, plannedTotal - loggedTotal));

  return (
    <Card className="h-100 sf-card-panel">
      <Card.Body className="sf-panel-body">
        <div className="d-flex justify-content-between align-items-center mb-1">
          <h2 className="h5 mb-0">Today's Plan</h2>
          <Button as={Link} to="/command" variant="link" size="sm" className="p-0" style={{ textDecoration: 'none' }}>
            Edit
          </Button>
        </div>
        <small className="text-muted">
          {items.length === 0
            ? 'Nothing scheduled for today'
            : remaining > 0
            ? `${remaining}h left of ${plannedTotal}h planned`
            : `All ${plannedTotal}h done — nice.`}
        </small>

        <div className="flex-grow-1 overflow-auto mt-3" style={{ maxHeight: 280 }}>
          {items.length === 0 ? (
            <div className="text-center text-muted small py-4">
              No subjects planned today.
              <div className="mt-2">
                <Button as={Link} to="/command" variant="outline-primary" size="sm">Plan your week</Button>
              </div>
            </div>
          ) : (
            items.map(({ subject, plannedHours, logged, pct, done }) => (
              <div key={subject.firestoreId || subject.id} className="sf-todayplan-row py-2">
                <div className="d-flex align-items-center justify-content-between mb-1">
                  <div className="d-flex align-items-center gap-2 min-w-0">
                    <span className="sf-habit-dot" style={{ background: subject.color }} aria-hidden="true" />
                    <span className="fw-semibold text-truncate">{subject.name}</span>
                  </div>
                  <span className={`small fw-semibold ${done ? 'sf-feas-met' : 'text-muted'}`}>
                    {round1(logged)}/{round1(plannedHours)}h
                  </span>
                </div>
                <div className="sf-plan-bar" aria-hidden="true">
                  <div className={`sf-plan-bar-fill ${done ? 'sf-feas-bg-met' : 'sf-feas-bg-progress'}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            ))
          )}
        </div>
      </Card.Body>
    </Card>
  );
}
