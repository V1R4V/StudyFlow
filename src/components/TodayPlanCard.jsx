import { Card, Button } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { useStudyData } from '../context/StudyDataContext';
import { localDateString, getSessionMinutes } from '../utils/sessions';
import Icon from './Icon';
import { planForDate, loggedHoursFor } from '../utils/plan';
import { formatStudyTime, progressPercent } from '../utils/progress';

export default function TodayPlanCard({ selectedDate = localDateString() }) {
  const { subjects, sessions, planEntries } = useStudyData();
  const isToday = selectedDate === localDateString();
  const items = planForDate(subjects, planEntries, selectedDate).map(({ subject, plannedHours }) => {
    const planned = plannedHours * 60;
    const logged = loggedHoursFor(sessions, subject, selectedDate) * 60;
    return { subject, planned, logged, pct: progressPercent(logged, planned), done: logged >= planned };
  });
  const plannedTotal = items.reduce((sum, item) => sum + item.planned, 0);
  const creditedTotal = items.reduce((sum, item) => sum + Math.min(item.logged, item.planned), 0);
  const remaining = Math.max(0, plannedTotal - creditedTotal);
  const studied = sessions.filter(session => session.date === selectedDate).reduce((sum, session) => sum + getSessionMinutes(session), 0);
  const scheduledKeys = new Set(items.flatMap(item => [String(item.subject.id), String(item.subject.firestoreId)]));
  const additional = sessions.filter(session => session.date === selectedDate && !scheduledKeys.has(String(session.subjectId)))
    .reduce((sum, session) => sum + getSessionMinutes(session), 0);

  return (
    <Card className="h-100 sf-card-panel">
      <Card.Body className="sf-panel-body">
        <div className="d-flex justify-content-between align-items-start gap-2 mb-1">
          <h2 className="h5 mb-0">{isToday ? "Today's Subject Schedule" : 'Subject Schedule'}</h2>
          <Button as={Link} to={`/app/command?week=${selectedDate}#weekly-planner`} variant="link" size="sm" className="p-0">Edit</Button>
        </div>
        <small className="text-muted">
          {!isToday && <span className="d-block">{new Date(`${selectedDate}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>}
          {items.length === 0 ? 'No schedule set for this day' : remaining > 0
            ? `${formatStudyTime(remaining)} left of ${formatStudyTime(plannedTotal)} scheduled` : 'Scheduled study complete'}
        </small>
        <div className="flex-grow-1 mt-3">
          {items.length === 0 ? (
            <div className="text-center text-muted small py-4">
              <Icon name="calendar" size={28} className="mb-2" />
              <p className="mb-1 fw-semibold" style={{ color: 'var(--text-dark)' }}>{studied > 0 ? `${formatStudyTime(studied)} studied` : 'Your day is open'}</p>
              <p className="mb-0">{studied > 0 ? 'Your study time counts toward your weekly goals.' : 'Study anytime, or schedule time for your subjects.'}</p>
              <Button as={Link} to={`/app/command?week=${selectedDate}#weekly-planner`} variant="outline-primary" size="sm" className="mt-3">Plan your week</Button>
            </div>
          ) : items.map(({ subject, planned, logged, pct, done }) => (
            <div key={subject.firestoreId || subject.id} className="sf-todayplan-row py-2">
              <div className="d-flex align-items-center justify-content-between gap-2 mb-1">
                <div className="d-flex align-items-center gap-2 min-w-0">
                  <span className="sf-habit-dot" style={{ background: subject.color }} aria-hidden="true" />
                  <span className="fw-semibold text-truncate">{subject.name}</span>
                  {done && <span className="sf-goal-complete" aria-label={`${subject.name} daily schedule complete`}><Icon name="check" size={16} /></span>}
                </div>
              </div>
              <div className="small text-muted mb-2">{formatStudyTime(logged)} / {formatStudyTime(planned)} studied</div>
              <div className="sf-plan-bar" role="progressbar" aria-label={`${subject.name} daily schedule progress`} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                <div className={`sf-plan-bar-fill ${done ? 'sf-feas-bg-met' : 'sf-feas-bg-progress'}`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          ))}
          {items.length > 0 && additional > 0 && <p className="small text-muted mt-3 mb-0">Plus {formatStudyTime(additional)} of unscheduled study, counted toward weekly goals.</p>}
        </div>
      </Card.Body>
    </Card>
  );
}
