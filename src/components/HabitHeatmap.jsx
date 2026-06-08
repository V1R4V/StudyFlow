import { useMemo, useState } from 'react';
import { Card, Button } from 'react-bootstrap';
import { localDateString } from '../utils/sessions';
import { dayGrade, gradeColor } from '../utils/habits';

const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DOW_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const IconLeft = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M10 3L5 8l5 5" />
  </svg>
);
const IconRight = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M6 3l5 5-5 5" />
  </svg>
);

export default function HabitHeatmap({ habits, habitLogs, todayStr, onPickDay }) {
  const now = new Date(`${todayStr}T00:00:00`);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-11

  const { cells, canGoNext } = useMemo(() => {
    const first = new Date(year, month, 1);
    const leadBlanks = first.getDay(); // 0=Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const out = [];
    for (let i = 0; i < leadBlanks; i++) out.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = localDateString(new Date(year, month, d));
      const isFuture = dateStr > todayStr;
      const grade = isFuture ? null : dayGrade(habits, habitLogs, dateStr);
      out.push({ day: d, dateStr, grade, isFuture, isToday: dateStr === todayStr });
    }
    // Can't navigate past the current month.
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const shownStart = new Date(year, month, 1).getTime();
    return { cells: out, canGoNext: shownStart < thisMonthStart };
  }, [year, month, habits, habitLogs, todayStr]); // eslint-disable-line react-hooks/exhaustive-deps

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (!canGoNext) return;
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  }

  return (
    <Card className="h-100 sf-card-panel">
      <Card.Body>
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h2 className="h5 mb-0">Calendar heatmap</h2>
          <div className="d-flex align-items-center gap-2">
            <Button variant="outline-secondary" size="sm" onClick={prevMonth} aria-label="Previous month">
              <IconLeft />
            </Button>
            <span className="small fw-semibold" style={{ minWidth: 110, textAlign: 'center' }}>
              {MONTH_LABELS[month]} {year}
            </span>
            <Button variant="outline-secondary" size="sm" onClick={nextMonth} disabled={!canGoNext} aria-label="Next month">
              <IconRight />
            </Button>
          </div>
        </div>

        <div className="sf-heatmap-grid" role="grid" aria-label={`Habit completion grade for ${MONTH_LABELS[month]} ${year}`}>
          {DOW_LABELS.map((d, i) => (
            <div key={`h${i}`} className="sf-heatmap-head" aria-hidden="true">{d}</div>
          ))}
          {cells.map((c, i) => {
            if (!c) return <div key={`b${i}`} className="sf-heatmap-cell sf-heatmap-blank" />;
            const hasPlan = c.grade !== null;
            const title = hasPlan
              ? `${c.dateStr}: ${c.grade}%`
              : c.isFuture ? `${c.dateStr}: upcoming` : `${c.dateStr}: no habits`;
            return (
              <button
                key={c.dateStr}
                type="button"
                className={`sf-heatmap-cell${hasPlan ? ' sf-heatmap-planned' : ''}${c.isToday ? ' sf-heatmap-today' : ''}`}
                style={{ background: hasPlan ? gradeColor(c.grade) : 'var(--grade-none)' }}
                title={title}
                onClick={() => onPickDay && onPickDay(c.dateStr)}
              >
                <span className="sf-heatmap-day">{c.day}</span>
                {hasPlan && <span className="sf-heatmap-pct">{c.grade}%</span>}
              </button>
            );
          })}
        </div>

        <div className="d-flex align-items-center gap-2 mt-3 small text-muted">
          <span>Low</span>
          <span className="sf-heatmap-legend" style={{ background: 'var(--grade-zero)' }} />
          <span className="sf-heatmap-legend" style={{ background: 'var(--grade-low)' }} />
          <span className="sf-heatmap-legend" style={{ background: 'var(--grade-mid)' }} />
          <span className="sf-heatmap-legend" style={{ background: 'var(--grade-high)' }} />
          <span className="sf-heatmap-legend" style={{ background: 'var(--grade-full)' }} />
          <span>High</span>
        </div>
      </Card.Body>
    </Card>
  );
}
