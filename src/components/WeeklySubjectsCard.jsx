import { Card, Button } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import Icon from './Icon';
import { subjectKey } from '../utils/plan';
import { formatStudyTime, formatWeekRange } from '../utils/progress';

export default function WeeklySubjectsCard({ weekly }) {
  const { rows, totalMinutes, goalMinutes, plannedMinutes, goalPct, remainingGoalMinutes, goalsMet, goalCount } = weekly;
  return (
    <Card className="h-100 sf-card-panel" id="weekly-goals">
      <Card.Body>
        <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
          <div>
            <h2 className="h5 mb-1">Weekly Subjects</h2>
            <span className="small text-muted">{formatWeekRange(weekly.start)} · Logged study counts automatically</span>
          </div>
          <Button as={Link} to="/app/command#weekly-planner" variant="link" size="sm" className="p-0 text-nowrap">Manage goals</Button>
        </div>
        <div className="sf-week-summary mb-3">
          <div><span className="small text-muted">Studied</span><strong>{formatStudyTime(totalMinutes)}</strong></div>
          <div><span className="small text-muted">Weekly goals</span><strong>{goalMinutes > 0 ? formatStudyTime(goalMinutes) : 'Not set'}</strong></div>
          <div><span className="small text-muted">Scheduled</span><strong>{formatStudyTime(plannedMinutes)}</strong></div>
        </div>
        {goalMinutes > 0 && (
          <div className="mb-3">
            <div className="d-flex justify-content-between flex-wrap gap-1 small mb-2">
              <span className="fw-semibold">{goalPct}% of subject goals completed</span>
              <span className="text-muted">{goalsMet}/{goalCount} reached · {remainingGoalMinutes > 0 ? `${formatStudyTime(remainingGoalMinutes)} remaining` : 'All goals reached'}</span>
            </div>
            <div className="sf-plan-bar" role="progressbar" aria-label="Overall weekly goal progress" aria-valuenow={goalPct} aria-valuemin={0} aria-valuemax={100}>
              <div className="sf-plan-bar-fill" style={{ width: `${goalPct}%`, background: goalPct === 100 ? 'var(--success)' : 'var(--primary)' }} />
            </div>
          </div>
        )}
        {rows.map(({ subject, loggedMinutes, plannedMinutes: scheduled, goalMinutes: goal, goalPct: pct, goalMet, remainingMinutes }) => (
          <div key={subjectKey(subject)} className="sf-week-subject-row py-2">
            <div className="sf-goal-row-heading">
              <Link to={`/app/sessions?${new URLSearchParams({ subject: subjectKey(subject), range: 'custom', start: weekly.start, end: weekly.end })}`}
                className="sf-subject-session-link d-inline-flex align-items-center gap-2 min-w-0" aria-label={`View ${subject.name} sessions for ${formatWeekRange(weekly.start)}`}>
                <span className="sf-habit-dot" style={{ background: subject.color }} aria-hidden="true" />
                <span className="fw-semibold text-truncate">{subject.name}</span>
                <Icon name="arrowRight" size={16} />
              </Link>
              <div className="d-flex align-items-center flex-wrap gap-2">
                <span className="small fw-semibold sf-study-summary">{formatStudyTime(loggedMinutes)} studied{goal > 0 ? ` / ${formatStudyTime(goal)} goal` : ''}</span>
                {goalMet && <span className="sf-goal-complete" role="status" aria-label={`${subject.name} weekly goal reached`}><Icon name="check" size={17} /> Goal reached</span>}
              </div>
            </div>
            <div className="d-flex justify-content-between flex-wrap gap-1 mb-2 small text-muted">
              <span>{scheduled > 0 ? `${formatStudyTime(scheduled)} scheduled` : 'No time scheduled'}{loggedMinutes > 0 && scheduled === 0 && goal > 0 ? ' · Study counted toward your goal' : ''}</span>
              <span>{goal > 0 ? goalMet ? 'Complete for this week' : `${pct}% complete · ${formatStudyTime(remainingMinutes)} to go` : 'No weekly goal set'}</span>
            </div>
            {goal > 0 && <div className="sf-plan-bar" role="progressbar" aria-label={`${subject.name} weekly goal progress`} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}
              aria-valuetext={`${formatStudyTime(loggedMinutes)} studied of ${formatStudyTime(goal)} goal`}>
              <div className="sf-plan-bar-fill" style={{ width: `${pct}%`, background: goalMet ? 'var(--success)' : subject.color }} />
            </div>}
          </div>
        ))}
      </Card.Body>
    </Card>
  );
}
