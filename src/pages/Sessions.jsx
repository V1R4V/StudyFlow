import { useMemo, useState } from 'react';
import { Container, Card, Form, Table, Button, Row, Col, Badge } from 'react-bootstrap';
import EndSessionModal from '../components/EndSessionModal';
import { useStudyData } from '../context/StudyDataContext';
import { sessionMatchesSubject, localDateString, shiftDateStr, getSessionMinutes } from '../utils/sessions';

function getSessionSeconds(session) {
  if (typeof session.durationSeconds === 'number') return session.durationSeconds;
  if (typeof session.duration === 'number') return session.duration * 60;
  return 0;
}

function toMillis(ts) {
  if (!ts) return null;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (typeof ts.seconds === 'number') return ts.seconds * 1000;
  return null;
}

function formatClock(ms) {
  return new Date(ms).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatTimeRange(session) {
  const endMs = toMillis(session.createdAt);
  if (endMs === null) return null;
  const durSec = getSessionSeconds(session);
  const startMs = endMs - durSec * 1000;
  return `${formatClock(startMs)} – ${formatClock(endMs)}`;
}

function formatDuration(seconds) {
  const total = Math.max(0, Math.floor(seconds));
  if (total < 60) return `${total} sec`;
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (s === 0) return `${m} min`;
  return `${m} min ${s} sec`;
}

function formatHours(minutes) {
  return (minutes / 60).toFixed(1);
}

function Stars({ rating }) {
  const n = rating || 0;
  return (
    <span style={{ fontSize: 14, whiteSpace: 'nowrap' }} aria-label={`Focus rating: ${n} of 5`}>
      <span aria-hidden="true" style={{ color: 'var(--warning-text)' }}>{'★'.repeat(n)}</span>
      <span aria-hidden="true" style={{ color: '#9ca3af' }}>{'★'.repeat(5 - n)}</span>
    </span>
  );
}

const DATE_RANGES = [
  { value: 'all', label: 'All time' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: 'thisWeek', label: 'This week (Sun–Sat)' },
  { value: 'thisMonth', label: 'This month' },
  { value: 'custom', label: 'Custom range…' },
];

const GROUPINGS = [
  { value: 'none', label: 'No grouping' },
  { value: 'day', label: 'Group by day' },
  { value: 'week', label: 'Group by week' },
  { value: 'month', label: 'Group by month' },
];

// Sunday-anchored week boundaries for `dateStr`. Mirrors the Dashboard logic
// so "this week" reads consistently across pages.
function weekBoundsFor(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  const dow = d.getDay(); // 0 = Sunday
  const start = shiftDateStr(dateStr, -dow);
  const end = shiftDateStr(start, 6);
  return { start, end };
}

function monthBoundsFor(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  const y = d.getFullYear();
  const m = d.getMonth();
  const start = `${y}-${String(m + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(y, m + 1, 0).getDate();
  const end = `${y}-${String(m + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { start, end };
}

function rangeFor(range, todayStr, customStart, customEnd) {
  if (range === 'all') return { start: '0000-00-00', end: '9999-99-99' };
  if (range === '7d') return { start: shiftDateStr(todayStr, -6), end: todayStr };
  if (range === '30d') return { start: shiftDateStr(todayStr, -29), end: todayStr };
  if (range === '90d') return { start: shiftDateStr(todayStr, -89), end: todayStr };
  if (range === 'thisWeek') return weekBoundsFor(todayStr);
  if (range === 'thisMonth') return monthBoundsFor(todayStr);
  if (range === 'custom') {
    return {
      start: customStart || '0000-00-00',
      end: customEnd || '9999-99-99',
    };
  }
  return { start: '0000-00-00', end: '9999-99-99' };
}

function formatFriendlyDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function groupKeyFor(dateStr, grouping) {
  if (grouping === 'day') return dateStr;
  if (grouping === 'week') {
    const { start, end } = weekBoundsFor(dateStr);
    return `${start}::${end}`;
  }
  if (grouping === 'month') {
    return dateStr.slice(0, 7);
  }
  return '';
}

function groupLabel(key, grouping) {
  if (grouping === 'day') return formatFriendlyDate(key);
  if (grouping === 'week') {
    const [start, end] = key.split('::');
    const fmt = d => new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const yr = new Date(`${end}T00:00:00`).getFullYear();
    return `Week of ${fmt(start)} – ${fmt(end)}, ${yr}`;
  }
  if (grouping === 'month') {
    const d = new Date(`${key}-01T00:00:00`);
    return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  }
  return '';
}

export default function Sessions() {
  const { subjects, sessions, updateSession, deleteSession } = useStudyData();
  const todayStr = localDateString();
  const [filterSubject, setFilterSubject] = useState('all');
  const [dateRange, setDateRange] = useState('all');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState(todayStr);
  const [grouping, setGrouping] = useState('none');
  const [editing, setEditing] = useState(null);

  function handleDelete(id) {
    if (!window.confirm('Delete this session?')) return;
    deleteSession(id);
  }

  function handleEditSave(details) {
    const updates = {
      focusRating: details.focusRating,
      notes: details.notes,
      date: details.date,
    };
    if (typeof details.durationSeconds === 'number') {
      updates.durationSeconds = details.durationSeconds;
      updates.duration = details.duration;
    }
    updateSession(editing.id, updates);
    setEditing(null);
  }

  const { start: rangeStart, end: rangeEnd } = useMemo(
    () => rangeFor(dateRange, todayStr, customStart, customEnd),
    [dateRange, todayStr, customStart, customEnd]
  );

  const filtered = useMemo(() => {
    return sessions
      .filter(s => filterSubject === 'all' || String(s.subjectId) === filterSubject)
      .filter(s => s.date >= rangeStart && s.date <= rangeEnd);
  }, [sessions, filterSubject, rangeStart, rangeEnd]);

  // Summary across the current filter so the user sees the impact of their
  // selection at a glance — no need to add up rows in their head.
  const summary = useMemo(() => {
    const totalMin = filtered.reduce((acc, s) => acc + getSessionMinutes(s), 0);
    const avgFocus = filtered.length > 0
      ? (filtered.reduce((acc, s) => acc + (s.focusRating || 0), 0) / filtered.length).toFixed(1)
      : '—';
    return { count: filtered.length, totalMin, avgFocus };
  }, [filtered]);

  // For grouped views — bucket by day/week/month with a per-bucket total.
  const grouped = useMemo(() => {
    if (grouping === 'none') return null;
    const map = new Map();
    filtered.forEach(s => {
      const key = groupKeyFor(s.date, grouping);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(s);
    });
    const arr = [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
    return arr.map(([key, items]) => ({
      key,
      label: groupLabel(key, grouping),
      sessions: items,
      totalMin: items.reduce((acc, s) => acc + getSessionMinutes(s), 0),
    }));
  }, [filtered, grouping]);

  const hasCustomRange = dateRange === 'custom';
  const showingRangeLabel = dateRange === 'all'
    ? 'all time'
    : `${formatFriendlyDate(rangeStart)} – ${formatFriendlyDate(rangeEnd)}`;

  function renderRow(s) {
    const subj = subjects.find(sub => sessionMatchesSubject(s, sub));
    const color = subj?.color || s.subjectColor || '#6b7280';
    return (
      <tr key={s.id}>
        <td>
          <div>{formatFriendlyDate(s.date)}</div>
          {formatTimeRange(s) && (
            <div className="text-muted small">{formatTimeRange(s)}</div>
          )}
        </td>
        <td>
          <span className="d-inline-flex align-items-center gap-2">
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: color,
                display: 'inline-block',
              }}
            />
            {s.subjectName}
          </span>
        </td>
        <td>{formatDuration(getSessionSeconds(s))}</td>
        <td><Stars rating={s.focusRating} /></td>
        <td style={{ maxWidth: 280 }}>
          {s.notes ? (
            <span title={s.notes}>
              {s.notes.length > 50 ? s.notes.slice(0, 50) + '…' : s.notes}
            </span>
          ) : (
            <span className="text-muted">·</span>
          )}
        </td>
        <td className="text-end">
          <Button
            size="sm"
            variant="outline-secondary"
            className="me-2"
            onClick={() => setEditing(s)}
          >
            Edit
          </Button>
          <Button
            size="sm"
            variant="outline-danger"
            onClick={() => handleDelete(s.id)}
            aria-label={`Delete ${s.subjectName} session from ${s.date}`}
          >
            <span aria-hidden="true">×</span>
          </Button>
        </td>
      </tr>
    );
  }

  return (
    <Container fluid className="sf-page">
      <div className="mb-4">
        <h1 className="mb-1">Sessions</h1>
        <p className="text-muted mb-0">
          Full session history. Edit ratings or notes anytime.
        </p>
      </div>

      <Card className="mb-3">
        <Card.Body className="py-3">
          <Row className="g-3 align-items-end">
            <Col md={3} sm={6}>
              <Form.Group controlId="filter-subject">
                <Form.Label className="small text-muted mb-1">Subject</Form.Label>
                <Form.Select
                  size="sm"
                  value={filterSubject}
                  onChange={e => setFilterSubject(e.target.value)}
                >
                  <option value="all">All subjects</option>
                  {subjects.map(s => (
                    <option key={s.id} value={s.firestoreId ?? s.id}>{s.name}</option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={3} sm={6}>
              <Form.Group controlId="filter-range">
                <Form.Label className="small text-muted mb-1">Date range</Form.Label>
                <Form.Select
                  size="sm"
                  value={dateRange}
                  onChange={e => setDateRange(e.target.value)}
                >
                  {DATE_RANGES.map(r => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={3} sm={6}>
              <Form.Group controlId="filter-grouping">
                <Form.Label className="small text-muted mb-1">Aggregate by</Form.Label>
                <Form.Select
                  size="sm"
                  value={grouping}
                  onChange={e => setGrouping(e.target.value)}
                >
                  {GROUPINGS.map(g => (
                    <option key={g.value} value={g.value}>{g.label}</option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={3} sm={6} className="d-flex justify-content-md-end">
              <Button
                size="sm"
                variant="outline-secondary"
                onClick={() => {
                  setFilterSubject('all');
                  setDateRange('all');
                  setGrouping('none');
                  setCustomStart('');
                  setCustomEnd(todayStr);
                }}
                disabled={
                  filterSubject === 'all' &&
                  dateRange === 'all' &&
                  grouping === 'none'
                }
              >
                Reset filters
              </Button>
            </Col>

            {hasCustomRange && (
              <>
                <Col md={3} sm={6}>
                  <Form.Group controlId="filter-custom-start">
                    <Form.Label className="small text-muted mb-1">From</Form.Label>
                    <Form.Control
                      size="sm"
                      type="date"
                      value={customStart}
                      max={customEnd || todayStr}
                      onChange={e => setCustomStart(e.target.value)}
                    />
                  </Form.Group>
                </Col>
                <Col md={3} sm={6}>
                  <Form.Group controlId="filter-custom-end">
                    <Form.Label className="small text-muted mb-1">To</Form.Label>
                    <Form.Control
                      size="sm"
                      type="date"
                      value={customEnd}
                      max={todayStr}
                      min={customStart || undefined}
                      onChange={e => setCustomEnd(e.target.value)}
                    />
                  </Form.Group>
                </Col>
              </>
            )}
          </Row>

          <div className="d-flex flex-wrap gap-2 mt-3 align-items-center">
            <Badge bg="primary" pill className="px-3 py-2">
              {summary.count} {summary.count === 1 ? 'session' : 'sessions'}
            </Badge>
            <Badge bg="secondary" pill className="px-3 py-2">
              {formatHours(summary.totalMin)}h total
            </Badge>
            <Badge bg="info" pill className="px-3 py-2">
              Avg focus {summary.avgFocus}{summary.avgFocus !== '—' && '/5'}
            </Badge>
            <span className="text-muted small ms-auto">
              Showing {showingRangeLabel}
            </span>
          </div>
        </Card.Body>
      </Card>

      <Card>
        <Card.Header className="d-flex justify-content-between align-items-center flex-wrap gap-2">
          <h2 className="h6 mb-0 fw-semibold">Session History</h2>
          {grouping !== 'none' && (
            <span className="small text-muted">
              {grouped?.length || 0} {grouped?.length === 1 ? 'group' : 'groups'}
            </span>
          )}
        </Card.Header>

        {filtered.length === 0 ? (
          <Card.Body className="text-center text-muted py-5">
            {sessions.length === 0
              ? 'No sessions yet. Start the timer on your Dashboard.'
              : 'No sessions match these filters.'}
          </Card.Body>
        ) : grouping === 'none' ? (
          <Table hover responsive className="mb-0 align-middle">
            <thead>
              <tr>
                <th>Date</th>
                <th>Subject</th>
                <th>Duration</th>
                <th>Focus</th>
                <th>Notes</th>
                <th className="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>{filtered.map(renderRow)}</tbody>
          </Table>
        ) : (
          <div>
            {grouped.map(g => (
              <div key={g.key}>
                <div
                  className="px-3 py-2 d-flex justify-content-between align-items-center"
                  style={{
                    background: 'var(--bg-light)',
                    borderTop: '1px solid var(--border-color)',
                    borderBottom: '1px solid var(--border-color)',
                  }}
                >
                  <span className="fw-semibold small">{g.label}</span>
                  <span className="text-muted small">
                    {g.sessions.length} {g.sessions.length === 1 ? 'session' : 'sessions'} ·{' '}
                    {formatHours(g.totalMin)}h
                  </span>
                </div>
                <Table hover responsive className="mb-0 align-middle">
                  <tbody>{g.sessions.map(renderRow)}</tbody>
                </Table>
              </div>
            ))}
          </div>
        )}
      </Card>

      {editing && (
        <EndSessionModal
          show={true}
          title="Edit Session"
          seconds={getSessionSeconds(editing)}
          initialRating={editing.focusRating}
          initialNotes={editing.notes}
          initialDate={editing.date}
          showDateField={true}
          saveLabel="Save changes"
          discardLabel="Cancel"
          onSave={handleEditSave}
          onDiscard={() => setEditing(null)}
        />
      )}
    </Container>
  );
}
