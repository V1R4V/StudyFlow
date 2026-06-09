import { useMemo } from 'react';
import { Card } from 'react-bootstrap';
import { useStudyData } from '../context/StudyDataContext';
import { localDateString, shiftDateStr, getSessionMinutes } from '../utils/sessions';
import { weekStartStr, dayLoad } from '../utils/plan';

const DAY_ABBR = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const round1 = n => Math.round(n * 10) / 10;

export default function WeekCalendarCard() {
  const { subjects, sessions, planEntries } = useStudyData();
  const todayStr = localDateString();
  const weekStart = weekStartStr(todayStr);

  const days = useMemo(() => {
    const loads = dayLoad(planEntries, subjects, weekStart);
    // Logged hours per day (all subjects) for the same week.
    const loggedByDate = new Map();
    const end = shiftDateStr(weekStart, 6);
    sessions.forEach(s => {
      if (s.date >= weekStart && s.date <= end) {
        loggedByDate.set(s.date, (loggedByDate.get(s.date) || 0) + getSessionMinutes(s));
      }
    });
    return loads.map((l, i) => {
      const logged = round1((loggedByDate.get(l.date) || 0) / 60);
      const planned = l.hours;
      const max = Math.max(planned, logged, 1);
      return {
        date: l.date,
        abbr: DAY_ABBR[i],
        num: new Date(`${l.date}T00:00:00`).getDate(),
        planned,
        logged,
        plannedPct: Math.round((planned / max) * 100),
        loggedPct: Math.round((logged / max) * 100),
        isToday: l.date === todayStr,
        isPast: l.date < todayStr,
      };
    });
  }, [subjects, sessions, planEntries, weekStart, todayStr]);

  const totalPlanned = round1(days.reduce((a, d) => a + d.planned, 0));
  const totalLogged = round1(days.reduce((a, d) => a + d.logged, 0));
  const summary = totalPlanned > 0
    ? `${totalLogged}/${totalPlanned}h logged vs scheduled`
    : totalLogged > 0
    ? `${totalLogged}h logged this week`
    : 'No weekly plan yet';

  return (
    <Card className="h-100 sf-card-panel">
      <Card.Body>
        <div className="d-flex justify-content-between align-items-center mb-1">
          <h2 className="h5 mb-0">This Week</h2>
          <span className="small text-muted">{summary}</span>
        </div>

        <div className="sf-weekcal d-flex justify-content-between gap-2 mt-3 align-items-end">
          {days.map(d => (
            <div key={d.date} className={`sf-weekcal-day${d.isToday ? ' sf-weekcal-today' : ''}`} title={`${d.date}: ${d.logged}h logged / ${d.planned}h scheduled`}>
              <div className="sf-weekcal-bars">
                <div className="sf-weekcal-track">
                  {d.planned > 0 && <div className="sf-weekcal-planned" style={{ height: `${d.plannedPct}%` }} />}
                  {d.logged > 0 && <div className="sf-weekcal-logged" style={{ height: `${d.loggedPct}%` }} />}
                </div>
              </div>
              <div className="sf-weekcal-abbr">{d.abbr}</div>
              <div className="sf-weekcal-num">{d.num}</div>
            </div>
          ))}
        </div>

        <div className="d-flex gap-3 mt-3 small text-muted">
          <span className="d-inline-flex align-items-center gap-1"><span className="sf-weekcal-key sf-weekcal-key-planned" /> Scheduled</span>
          <span className="d-inline-flex align-items-center gap-1"><span className="sf-weekcal-key sf-weekcal-key-logged" /> Logged</span>
        </div>
      </Card.Body>
    </Card>
  );
}
