import { useMemo } from 'react';
import { Card, Button } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { useStudyData } from '../context/StudyDataContext';
import { localDateString } from '../utils/sessions';
import {
  weekStartStr,
  subjectWeekPlanned,
  loggedHoursForWeek,
  feasibility,
} from '../utils/plan';

const round1 = n => Math.round(n * 10) / 10;

function subjectId(subject) {
  return subject.firestoreId || subject.id;
}

export default function WeeklySubjectsCard() {
  const { subjects, sessions, planEntries } = useStudyData();
  const weekStart = weekStartStr(localDateString());

  const rows = useMemo(
    () =>
      subjects
        .map(subject => {
          const scheduled = round1(subjectWeekPlanned(planEntries, subject, weekStart));
          const logged = round1(loggedHoursForWeek(sessions, subject, weekStart));
          const goal = Number(subject.weeklyGoal) || 0;
          const feas = feasibility(subject, scheduled);
          const scheduleGap = round1(Math.max(0, goal - scheduled));
          const studyLeft = round1(Math.max(0, scheduled - logged));
          const extra = round1(Math.max(0, logged - scheduled));
          return { subject, scheduled, logged, goal, feas, scheduleGap, studyLeft, extra };
        })
        .sort((a, b) => {
          if (b.scheduleGap !== a.scheduleGap) return b.scheduleGap - a.scheduleGap;
          return b.studyLeft - a.studyLeft;
        }),
    [subjects, sessions, planEntries, weekStart]
  );

  const totalScheduled = round1(rows.reduce((acc, row) => acc + row.scheduled, 0));
  const totalLogged = round1(rows.reduce((acc, row) => acc + row.logged, 0));
  const totalGoal = round1(rows.reduce((acc, row) => acc + row.goal, 0));

  return (
    <Card className="h-100 sf-card-panel">
      <Card.Body className="sf-panel-body">
        <div className="d-flex justify-content-between align-items-start gap-3 mb-2">
          <div>
            <h2 className="h5 mb-0">Weekly Subjects</h2>
            <small className="text-muted">
              {totalGoal > 0
                ? `${totalScheduled}/${totalGoal}h scheduled · ${totalLogged}h logged`
                : `${totalLogged}h logged this week`}
            </small>
          </div>
          <Button as={Link} to="/app/command" variant="link" size="sm" className="p-0" style={{ textDecoration: 'none' }}>
            Plan
          </Button>
        </div>

        <div className="flex-grow-1 overflow-auto mt-2" style={{ maxHeight: 330 }}>
          {rows.length === 0 ? (
            <div className="text-center text-muted small py-4">
              Add subjects to build a weekly plan.
            </div>
          ) : (
            rows.map(({ subject, scheduled, logged, goal, feas, scheduleGap, studyLeft, extra }) => {
              let note = 'Set a weekly goal';
              if (goal > 0 && scheduleGap > 0) note = `${scheduleGap}h still needs a scheduled slot`;
              else if (studyLeft > 0) note = `${studyLeft}h scheduled study left`;
              else if (extra > 0.05) note = `${extra}h above scheduled time`;
              else if (scheduled > 0) note = 'Scheduled study complete';

              return (
                <div key={subjectId(subject)} className="sf-week-subject-row py-2">
                  <div className="d-flex align-items-center justify-content-between gap-2 mb-1">
                    <div className="d-flex align-items-center gap-2 min-w-0">
                      <span className="sf-habit-dot" style={{ background: subject.color }} aria-hidden="true" />
                      <span className="fw-semibold text-truncate">{subject.name}</span>
                    </div>
                    <span className={`small fw-semibold sf-feas-${feas.status}`}>
                      {scheduled}h{goal > 0 ? ` / ${goal}h` : ''}
                    </span>
                  </div>
                  {goal > 0 && (
                    <div className="sf-plan-bar" aria-hidden="true">
                      <div
                        className={`sf-plan-bar-fill sf-feas-bg-${feas.status}`}
                        style={{ width: `${feas.pct}%` }}
                      />
                    </div>
                  )}
                  <div className="d-flex justify-content-between gap-2 mt-1 small text-muted">
                    <span>{note}</span>
                    <span>{logged}h logged</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Card.Body>
    </Card>
  );
}
