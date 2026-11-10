import { useState } from 'react';
import { Card, Button } from 'react-bootstrap';
import CardExpand from './CardExpand';
import { formatStudyTime, formatWeekRange } from '../utils/progress';
import { localDateString } from '../utils/sessions';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function WeeklyTrendCard({ weekly, selectedDate, onSelectDate }) {
  const [unit, setUnit] = useState('minutes');
  const [inspectedDate, setInspectedDate] = useState(null);
  const { days, totalMinutes, elapsedDays, previousMinutes } = weekly;
  const maximum = Math.max(60, ...days.map(day => day.minutes));
  const step = maximum <= 120 ? 30 : maximum <= 360 ? 60 : Math.ceil(maximum / 180) * 60;
  const ceiling = Math.ceil(maximum / step) * step;
  const activeDay = days.find(day => day.date === (inspectedDate || selectedDate)) || days[0];
  const peak = days.reduce((best, day) => day.minutes > best.minutes ? day : best, days[0]);
  const change = totalMinutes - previousMinutes;
  const today = localDateString();
  const currentWeek = days.some(day => day.date === today);
  const average = elapsedDays > 0 ? totalMinutes / elapsedDays : 0;
  const labelFor = date => new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });

  return (
    <Card className="h-100 sf-card-panel sf-weekly-trend">
      <Card.Body className="sf-panel-body">
        <div className="d-flex justify-content-between align-items-center gap-2 mb-1">
          <h2 className="h5 mb-0">Weekly Trend</h2>
          <CardExpand to="/app/statistics" label="Open Statistics" />
        </div>
        <span className="text-muted small">{formatWeekRange(weekly.start)} · Sun–Sat</span>
        <div className="mt-2">
            <div className="sf-unit-switch" role="group" aria-label="Chart time unit">
              {['minutes', 'hours'].map(option => (
                <Button key={option} size="sm" variant={unit === option ? 'primary' : 'link'}
                  aria-pressed={unit === option} onClick={() => setUnit(option)}>
                  {option === 'minutes' ? 'Minutes' : 'Hours'}
                </Button>
              ))}
            </div>
        </div>
        <div className="sf-trend-headline mt-3">
          <span className="sf-trend-total">{formatStudyTime(totalMinutes)}</span>
          <span className="text-muted">studied this week</span>
        </div>
        <div className="sf-trend-chart mt-3" aria-label={`Study time for ${formatWeekRange(weekly.start)}`}>
          <div className="sf-trend-axis" aria-hidden="true">
            {[ceiling, ceiling / 2, 0].map(tick => <span key={tick}>{unit === 'hours' ? Number((tick / 60).toFixed(1)) : tick}</span>)}
          </div>
          <div className="sf-trend-columns" onMouseLeave={() => setInspectedDate(null)}>
            {days.map((day, index) => (
              <button key={day.date} type="button"
                className={`sf-trend-day${day.date === selectedDate ? ' is-selected' : ''}${day.isFuture ? ' is-future' : ''}`}
                disabled={day.isFuture} aria-pressed={day.date === selectedDate}
                aria-label={`${labelFor(day.date)}: ${formatStudyTime(day.minutes, 'minutes')}${day.isFuture ? ', upcoming' : ', view this day'}`}
                onMouseEnter={() => setInspectedDate(day.date)} onFocus={() => setInspectedDate(day.date)}
                onBlur={() => setInspectedDate(null)} onClick={() => { setInspectedDate(null); onSelectDate(day.date); }}>
                <span className="sf-trend-day-value">{day.isFuture ? '–' : unit === 'hours' ? formatStudyTime(day.minutes, unit).replace(' h', '') : formatStudyTime(day.minutes, unit).replace(' min', '')}</span>
                <span className="sf-trend-bar-track">
                  <span className="sf-trend-bar" style={{ height: `${(day.minutes / ceiling) * 100}%` }} />
                </span>
                <span className="sf-trend-day-label">{DAYS[index]}</span>
                <span className="sf-trend-day-date">{new Date(`${day.date}T00:00:00`).getDate()}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="sf-trend-detail small" aria-live="polite">
          <span>{labelFor(activeDay.date)}</span>
          <strong>{activeDay.isFuture ? 'Upcoming' : formatStudyTime(activeDay.minutes, unit)}</strong>
        </div>
        <div className="sf-trend-facts mt-auto pt-3">
          <div><span className="text-muted small" title={currentWeek ? 'Average per elapsed day, including today' : 'Average across all seven days'}>Daily avg</span><strong>{formatStudyTime(average)}</strong></div>
          <div><span className="text-muted small">Best day</span><strong>{peak.minutes > 0 ? `${DAYS[days.indexOf(peak)]} · ${formatStudyTime(peak.minutes)}` : 'No sessions yet'}</strong></div>
          <div><span className="text-muted small" title={currentWeek ? 'Compared with Sunday through the same weekday last week' : 'Compared with the previous Sunday–Saturday week'}>{currentWeek ? 'Same days last week' : 'Vs last week'}</span>
            <strong style={{ color: change >= 0 ? 'var(--success-text)' : 'var(--warning-text)' }}>{previousMinutes > 0 ? `${change >= 0 ? '+' : '−'}${formatStudyTime(Math.abs(change))}` : totalMinutes > 0 ? 'First active week' : '—'}</strong>
          </div>
        </div>
      </Card.Body>
    </Card>
  );
}
