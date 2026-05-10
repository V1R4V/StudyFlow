import { useState, useMemo } from 'react';
import { Card, Form } from 'react-bootstrap';

function getSessionSeconds(session) {
  if (typeof session.durationSeconds === 'number') return session.durationSeconds;
  if (typeof session.duration === 'number') return session.duration * 60;
  return 0;
}

function formatDuration(seconds) {
  const total = Math.max(0, Math.floor(seconds));
  if (total < 60) return `${total}s`;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return s > 0 ? `${h}h ${m}m ${s}s` : `${h}h ${m}m`;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

const RANGE_OPTIONS = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: 'Last 7 days' },
  { value: 'all', label: 'All time' },
];

export default function RecentSessionsList(props) {
  const { sessions, subjects } = props;
  const [range, setRange] = useState('7d');

  // Filter sessions by selected range. `today` matches the local YYYY-MM-DD;
  // `7d` keeps the last 7 days inclusive; `all` returns everything.
  const filtered = useMemo(() => {
    if (range === 'all') return sessions;
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    if (range === 'today') {
      return sessions.filter(s => s.date === todayStr);
    }
    const cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    return sessions.filter(s => s.date >= cutoff);
  }, [sessions, range]);

  // Cap to 8 items in the list to keep the dashboard tidy.
  const visible = filtered.slice(0, 8);

  return (
    <Card>
      <Card.Header className="d-flex justify-content-between align-items-center flex-wrap gap-2">
        <span>Recent Sessions</span>
        <Form.Select
          size="sm"
          value={range}
          onChange={e => setRange(e.target.value)}
          style={{ width: 150 }}
          aria-label="Time range filter"
        >
          {RANGE_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </Form.Select>
      </Card.Header>
      {visible.length === 0 ? (
        <Card.Body className="text-muted text-center py-4">
          {sessions.length === 0
            ? 'No sessions yet. Start the timer above!'
            : 'No sessions in this range.'}
        </Card.Body>
      ) : (
        <div className="list-group list-group-flush">
          {visible.map(s => {
            const subject = subjects.find(sub => sub.id === s.subjectId);
            const color = subject?.color || s.subjectColor || '#6b7280';
            const initial = s.subjectName?.[0]?.toUpperCase() || '?';
            return (
              <div
                key={s.id}
                className="list-group-item d-flex justify-content-between align-items-center"
              >
                <div className="d-flex align-items-center gap-3">
                  <div className="sf-subject-icon" style={{ background: color }}>
                    {initial}
                  </div>
                  <div>
                    <div className="fw-semibold">{s.subjectName}</div>
                    <small className="text-muted">
                      {s.date}
                      {s.notes && ` • ${s.notes.slice(0, 40)}${s.notes.length > 40 ? '…' : ''}`}
                    </small>
                  </div>
                </div>
                <div className="text-end">
                  <div className="fw-semibold">{formatDuration(getSessionSeconds(s))}</div>
                  <small className="text-muted">Focus: {s.focusRating}/5</small>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
