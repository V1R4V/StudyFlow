import { useMemo, useRef, useState } from 'react';
import { Container, Card, Form, Table, Button, Row, Col, Badge, Alert } from 'react-bootstrap';
import EndSessionModal from '../components/EndSessionModal';
import KpiCard from '../components/KpiCard';
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

// "1h 23m" / "23m", compact, used in KPI sublines.
function formatMinsShort(minutes) {
  const mins = Math.max(0, Math.round(minutes));
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// ---------- CSV serialization helpers ----------

const CSV_COLUMNS = [
  'date',
  'subject',
  'duration_minutes',
  'duration_seconds',
  'focus_rating',
  'notes',
  'distractions',
];

function escapeCsv(value) {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function sessionsToCsv(rows) {
  const header = CSV_COLUMNS.join(',');
  const body = rows
    .map(s => {
      const seconds = typeof s.durationSeconds === 'number'
        ? s.durationSeconds
        : (Number(s.duration) || 0) * 60;
      const cells = [
        s.date || '',
        s.subjectName || '',
        Math.round(seconds / 60),
        seconds,
        s.focusRating ?? '',
        s.notes || '',
        s.distractions ?? '',
      ];
      return cells.map(escapeCsv).join(',');
    })
    .join('\n');
  return `${header}\n${body}\n`;
}

// Tiny CSV parser tolerant to quoted fields and embedded commas. Throws on
// malformed quoting so the caller can surface a useful error.
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let i = 0;
  let inQuotes = false;
  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += c; i++; continue;
    }
    if (c === '"') { inQuotes = true; i++; continue; }
    if (c === ',') { row.push(field); field = ''; i++; continue; }
    if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.length > 1 || (row.length === 1 && row[0] !== '')) rows.push(row);
      row = []; i++; continue;
    }
    field += c; i++;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function triggerDownload(filename, text) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
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
  const { subjects, sessions, updateSession, deleteSession, addSession } = useStudyData();
  const todayStr = localDateString();
  const [filterSubject, setFilterSubject] = useState('all');
  const [dateRange, setDateRange] = useState('all');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState(todayStr);
  const [grouping, setGrouping] = useState('none');
  const [editing, setEditing] = useState(null);
  const [importStatus, setImportStatus] = useState(null); // { type, text }
  const fileInputRef = useRef(null);

  function handleDelete(id) {
    if (!window.confirm('Delete this session?')) return;
    deleteSession(id);
  }

  function handleExport() {
    const rows = filtered.length > 0 ? filtered : sessions;
    const filename = `studyflow-sessions-${todayStr}.csv`;
    triggerDownload(filename, sessionsToCsv(rows));
    setImportStatus({
      type: 'success',
      text: `Exported ${rows.length} ${rows.length === 1 ? 'session' : 'sessions'} to ${filename}.`,
    });
  }

  async function handleImportFile(file) {
    if (!file) return;
    setImportStatus(null);
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      if (rows.length < 2) {
        setImportStatus({ type: 'danger', text: 'CSV is empty.' });
        return;
      }
      const header = rows[0].map(h => h.trim().toLowerCase());
      const colIdx = {
        date: header.indexOf('date'),
        subject: header.indexOf('subject'),
        durationMin: header.indexOf('duration_minutes'),
        durationSec: header.indexOf('duration_seconds'),
        focus: header.indexOf('focus_rating'),
        notes: header.indexOf('notes'),
        distractions: header.indexOf('distractions'),
      };
      if (colIdx.date < 0 || colIdx.subject < 0) {
        setImportStatus({
          type: 'danger',
          text: 'CSV must include "date" and "subject" columns. Export a file to see the expected format.',
        });
        return;
      }

      // Build a case-insensitive subject name → subject lookup.
      const subjectByName = new Map();
      subjects.forEach(s => subjectByName.set(s.name.trim().toLowerCase(), s));

      let imported = 0;
      let skipped = 0;
      const skippedReasons = new Set();

      // Process rows sequentially, addSession may write to Firestore.
      for (let i = 1; i < rows.length; i++) {
        const cells = rows[i];
        if (!cells || cells.every(c => !c || !c.trim())) continue;
        const date = (cells[colIdx.date] || '').trim();
        const subjectName = (cells[colIdx.subject] || '').trim();
        if (!date || !subjectName) {
          skipped += 1;
          skippedReasons.add('missing date or subject');
          continue;
        }
        const subj = subjectByName.get(subjectName.toLowerCase());
        if (!subj) {
          skipped += 1;
          skippedReasons.add(`unknown subject "${subjectName}"`);
          continue;
        }
        const seconds = colIdx.durationSec >= 0 && cells[colIdx.durationSec]
          ? Math.max(1, Math.floor(Number(cells[colIdx.durationSec])))
          : colIdx.durationMin >= 0 && cells[colIdx.durationMin]
          ? Math.max(1, Math.floor(Number(cells[colIdx.durationMin])) * 60)
          : 0;
        if (!seconds) {
          skipped += 1;
          skippedReasons.add('missing duration');
          continue;
        }
        const focus = colIdx.focus >= 0 && cells[colIdx.focus]
          ? Math.max(1, Math.min(5, Math.round(Number(cells[colIdx.focus]))))
          : 4;
        const notes = colIdx.notes >= 0 ? (cells[colIdx.notes] || '').trim() : '';
        const distractions = colIdx.distractions >= 0 && cells[colIdx.distractions]
          ? Math.max(0, Math.floor(Number(cells[colIdx.distractions])))
          : 0;

        const newSession = {
          id: Date.now() + i,
          subjectId: String(subj.firestoreId ?? subj.id),
          subjectName: subj.name,
          subjectColor: subj.color,
          duration: Math.max(1, Math.ceil(seconds / 60)),
          durationSeconds: seconds,
          focusRating: focus,
          notes,
          distractions,
          date,
        };
        // eslint-disable-next-line no-await-in-loop
        await addSession(subj.id, newSession);
        imported += 1;
      }

      const reasonText = skippedReasons.size > 0
        ? ` Skipped reasons: ${[...skippedReasons].join('; ')}.`
        : '';
      setImportStatus({
        type: imported > 0 ? 'success' : 'warning',
        text: `Imported ${imported} ${imported === 1 ? 'session' : 'sessions'}${
          skipped > 0 ? `, skipped ${skipped}.` : '.'
        }${reasonText}`,
      });
    } catch (err) {
      setImportStatus({
        type: 'danger',
        text: `Couldn't parse CSV: ${err.message || 'unknown error'}.`,
      });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function handleEditSave(details) {
    const updates = {
      focusRating: details.focusRating,
      notes: details.notes,
      date: details.date,
      distractions: typeof details.distractions === 'number' ? details.distractions : 0,
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
  // selection at a glance, no need to add up rows in their head.
  const summary = useMemo(() => {
    const count = filtered.length;
    const totalMin = filtered.reduce((acc, s) => acc + getSessionMinutes(s), 0);
    const avgFocus = count > 0
      ? (filtered.reduce((acc, s) => acc + (s.focusRating || 0), 0) / count).toFixed(1)
      : '–';
    const avgSessionMin = count > 0 ? totalMin / count : 0;
    const longestSec = filtered.reduce((m, s) => Math.max(m, getSessionSeconds(s)), 0);
    const highFocus = filtered.filter(s => (s.focusRating || 0) >= 4).length;
    const activeDays = new Set(filtered.map(s => s.date)).size;
    return { count, totalMin, avgFocus, avgSessionMin, longestSec, highFocus, activeDays };
  }, [filtered]);

  // Session-cadence snapshot for the KPI row. Deliberately scoped to ALL
  // sessions (not the filter) and centered on session *rhythm* (count, daily
  // habit, weekly momentum) so this page complements the Statistics page,
  // which owns time totals and focus-depth analytics, instead of repeating it.
  const sessionStats = useMemo(() => {
    const total = sessions.length;
    const byDate = new Map();
    for (const s of sessions) byDate.set(s.date, (byDate.get(s.date) || 0) + 1);
    const activeDays = byDate.size;

    const todayCount = byDate.get(todayStr) || 0;
    const todayMin = sessions
      .filter(s => s.date === todayStr)
      .reduce((acc, s) => acc + getSessionMinutes(s), 0);

    const { start: wkStart, end: wkEnd } = weekBoundsFor(todayStr);
    const lastWkStart = shiftDateStr(wkStart, -7);
    const lastWkEnd = shiftDateStr(wkEnd, -7);
    let thisWeek = 0;
    let lastWeek = 0;
    for (const s of sessions) {
      if (s.date >= wkStart && s.date <= wkEnd) thisWeek += 1;
      else if (s.date >= lastWkStart && s.date <= lastWkEnd) lastWeek += 1;
    }

    const avgPerActiveDay = activeDays > 0 ? total / activeDays : 0;

    let bestDate = null;
    let bestCount = 0;
    for (const [date, count] of byDate) {
      if (count > bestCount) { bestCount = count; bestDate = date; }
    }

    return {
      total, activeDays, todayCount, todayMin,
      thisWeek, lastWeek, avgPerActiveDay, bestDate, bestCount,
    };
  }, [sessions, todayStr]);

  // For grouped views: bucket by day/week/month with a per-bucket total.
  const grouped = useMemo(() => {
    if (grouping === 'none') return null;
    const map = new Map();
    filtered.forEach(s => {
      const key = groupKeyFor(s.date, grouping);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(s);
    });
    const arr = [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
    const groups = arr.map(([key, items]) => {
      const totalMin = items.reduce((acc, s) => acc + getSessionMinutes(s), 0);
      const avgFocus = items.length > 0
        ? items.reduce((acc, s) => acc + (s.focusRating || 0), 0) / items.length
        : 0;
      // Subject color mix, ordered by time spent, a quick read on what a
      // week/month was actually about.
      const byColor = new Map();
      items.forEach(s => {
        const subj = subjects.find(sub => sessionMatchesSubject(s, sub));
        const color = subj?.color || s.subjectColor || '#6b7280';
        byColor.set(color, (byColor.get(color) || 0) + getSessionMinutes(s));
      });
      const colors = [...byColor.entries()].sort((a, b) => b[1] - a[1]).map(e => e[0]);
      return { key, label: groupLabel(key, grouping), sessions: items, totalMin, avgFocus, colors };
    });
    const maxGroupMin = Math.max(1, ...groups.map(g => g.totalMin));
    return { groups, maxGroupMin };
  }, [filtered, grouping, subjects]);

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
          <span className="sf-subject-pill" style={{ '--pill': color }}>
            <span className="sf-subject-pill-dot" />
            {s.subjectName}
          </span>
        </td>
        <td>
          <div className="sf-dur-value">{formatDuration(getSessionSeconds(s))}</div>
          {summary.longestSec > 0 && (
            <div
              className="sf-dur-track"
              aria-hidden="true"
              title={`${formatDuration(getSessionSeconds(s))} of longest ${formatDuration(summary.longestSec)}`}
            >
              <div
                className="sf-dur-fill"
                style={{ width: `${Math.max(6, Math.round((getSessionSeconds(s) / summary.longestSec) * 100))}%` }}
              />
            </div>
          )}
        </td>
        <td><Stars rating={s.focusRating} /></td>
        <td className="text-center">
          {Number(s.distractions) > 0 ? (
            <Badge bg="warning" text="dark">{s.distractions}</Badge>
          ) : (
            <span className="text-muted">–</span>
          )}
        </td>
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
      <div className="d-flex justify-content-between align-items-start flex-wrap gap-3 mb-4">
        <div>
          <h1 className="mb-1">Sessions</h1>
          <p className="text-muted mb-0">
            Full session history. Edit ratings or notes anytime.
          </p>
        </div>
        <div className="d-flex align-items-center gap-2 flex-wrap">
          <Button
            variant="outline-secondary"
            size="sm"
            onClick={handleExport}
            disabled={sessions.length === 0}
            title="Download the current filter as CSV (or all sessions if no filter is active)"
          >
            ⬇ Export CSV
          </Button>
          <Button
            variant="outline-secondary"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
          >
            ⬆ Import CSV
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            style={{ display: 'none' }}
            onChange={e => handleImportFile(e.target.files?.[0])}
          />
        </div>
      </div>

      {importStatus && (
        <Alert
          variant={importStatus.type}
          onClose={() => setImportStatus(null)}
          dismissible
          className="mb-3"
        >
          {importStatus.text}
        </Alert>
      )}

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

          <div className="d-flex justify-content-end mt-2">
            <span className="text-muted small">Showing {showingRangeLabel}</span>
          </div>
        </Card.Body>
      </Card>

      <Row className="g-3 mb-3">
        <Col md={3} sm={6}>
          <KpiCard
            label="Sessions Today"
            value={sessionStats.todayCount}
            sub={
              sessionStats.todayCount > 0
                ? `${formatMinsShort(sessionStats.todayMin)} focused today`
                : 'none logged yet'
            }
          />
        </Col>
        <Col md={3} sm={6}>
          <KpiCard
            label="This Week"
            value={sessionStats.thisWeek}
            sub={`vs ${sessionStats.lastWeek} last week`}
            delta={
              sessionStats.thisWeek !== sessionStats.lastWeek
                ? {
                    positive: sessionStats.thisWeek > sessionStats.lastWeek,
                    text: `${sessionStats.thisWeek > sessionStats.lastWeek ? '↑' : '↓'} ${Math.abs(
                      sessionStats.thisWeek - sessionStats.lastWeek
                    )}`,
                  }
                : undefined
            }
          />
        </Col>
        <Col md={3} sm={6}>
          <KpiCard
            label="Daily Average"
            value={sessionStats.total > 0 ? sessionStats.avgPerActiveDay.toFixed(1) : '–'}
            sub={
              sessionStats.total > 0
                ? `over ${sessionStats.activeDays} active ${sessionStats.activeDays === 1 ? 'day' : 'days'}`
                : 'per active day'
            }
          />
        </Col>
        <Col md={3} sm={6}>
          <KpiCard
            label="Best Day"
            value={sessionStats.bestCount > 0 ? sessionStats.bestCount : '–'}
            sub={
              sessionStats.bestDate
                ? new Date(`${sessionStats.bestDate}T00:00:00`).toLocaleDateString(undefined, {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  })
                : 'no sessions yet'
            }
          />
        </Col>
      </Row>

      <Card>
        <Card.Header className="d-flex justify-content-between align-items-center flex-wrap gap-2">
          <h2 className="h6 mb-0 fw-semibold">Session History</h2>
          {summary.count > 0 && (
            <span className="small text-muted">
              {summary.count} {summary.count === 1 ? 'session' : 'sessions'} ·{' '}
              {formatHours(summary.totalMin)}h
              {summary.avgFocus !== '–' && ` · ${summary.avgFocus}★ avg`}
              {grouping !== 'none' &&
                ` · ${grouped?.groups.length || 0} ${grouped?.groups.length === 1 ? 'group' : 'groups'}`}
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
                <th className="text-center">Distractions</th>
                <th>Notes</th>
                <th className="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>{filtered.map(renderRow)}</tbody>
          </Table>
        ) : (
          <div>
            {grouped.groups.map(g => (
              <div key={g.key}>
                <div className="sf-group-board">
                  <div className="d-flex justify-content-between align-items-center gap-2 flex-wrap">
                    <span className="fw-semibold">{g.label}</span>
                    <span className="text-muted small d-inline-flex align-items-center gap-2">
                      {g.colors.length > 0 && (
                        <span className="sf-group-mix" aria-hidden="true">
                          {g.colors.slice(0, 4).map((c, i) => (
                            <span key={i} className="sf-group-mix-dot" style={{ background: c }} />
                          ))}
                        </span>
                      )}
                      <span>
                        {g.sessions.length} {g.sessions.length === 1 ? 'session' : 'sessions'} ·{' '}
                        {formatHours(g.totalMin)}h
                        {g.avgFocus > 0 && ` · ${g.avgFocus.toFixed(1)}★`}
                      </span>
                    </span>
                  </div>
                  <div
                    className="sf-group-bar-track"
                    aria-hidden="true"
                    title={`${formatHours(g.totalMin)}h of busiest ${formatHours(grouped.maxGroupMin)}h`}
                  >
                    <div
                      className="sf-group-bar-fill"
                      style={{ width: `${Math.max(4, Math.round((g.totalMin / grouped.maxGroupMin) * 100))}%` }}
                    />
                  </div>
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
          initialDistractions={editing.distractions || 0}
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
