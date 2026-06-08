import { Card } from 'react-bootstrap';
import { scheduledFor, instanceStatus, isDone, weightFor, PRIORITY_LABELS } from '../utils/habits';

const STATUS_META = {
  done: { label: 'Done', className: 'sf-habit-status-done' },
  missed: { label: 'Missed', className: 'sf-habit-status-missed' },
  pending: { label: 'Pending', className: 'sf-habit-status-pending' },
};

export default function HabitChecklist({ habits, habitLogs, dateStr, todayStr, onToggle }) {
  const scheduled = scheduledFor(habits, dateStr).sort(
    (a, b) => weightFor(b.priority) - weightFor(a.priority)
  );
  // You can tick today and back-fill past days, but not the future.
  const editable = dateStr <= todayStr;

  return (
    <Card className="h-100 sf-card-panel">
      <Card.Body>
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h2 className="h5 mb-0">Habits for this day</h2>
          <span className="text-muted small">
            {scheduled.filter(h => isDone(habitLogs, h.id, dateStr)).length}/{scheduled.length} done
          </span>
        </div>

        {scheduled.length === 0 ? (
          <div className="text-center py-4" style={{ color: 'var(--muted-strong)' }}>
            No habits scheduled for this day.
          </div>
        ) : (
          <ul className="list-unstyled mb-0">
            {scheduled.map(h => {
              const done = isDone(habitLogs, h.id, dateStr);
              const status = instanceStatus(h, habitLogs, dateStr, todayStr);
              const meta = STATUS_META[status];
              return (
                <li key={h.firestoreId || h.id} className="sf-habit-row d-flex align-items-center gap-3 py-2">
                  <button
                    type="button"
                    className={`sf-habit-check${done ? ' sf-habit-check-on' : ''}`}
                    onClick={() => editable && onToggle(h.id, dateStr, !done)}
                    disabled={!editable}
                    aria-pressed={done}
                    aria-label={done ? `Mark ${h.name} not done` : `Mark ${h.name} done`}
                  >
                    {done && (
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M3 8.5l3.5 3.5L13 4.5" />
                      </svg>
                    )}
                  </button>

                  <span className="sf-habit-dot" style={{ background: h.subjectColor }} aria-hidden="true" />

                  <div className="flex-grow-1 min-w-0">
                    <div className={`fw-semibold${done ? ' sf-habit-name-done' : ''}`}>{h.name}</div>
                    <div className="small text-muted">{h.subjectName}</div>
                  </div>

                  <span className={`sf-priority-badge sf-priority-${h.priority}`}>
                    {PRIORITY_LABELS[h.priority]}
                  </span>
                  <span className={`small fw-semibold ${meta.className}`} style={{ minWidth: 56, textAlign: 'right' }}>
                    {meta.label}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Card.Body>
    </Card>
  );
}
