import { useTimeZone } from '../hooks/useTimeZone';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Card, Form, Table } from 'react-bootstrap';
import { studyTimingSummary, hourLabel, formatRecordedDateTime } from '../utils/sessionTiming';
import { formatSessionDuration, sessionDurationSeconds } from '../utils/sessionHistory';

export default function StudyTimingCard({ sessions, subjects }) {
  const { timeZone } = useTimeZone();
  const [subjectKey, setSubjectKey] = useState('all');
  const [selectedHour, setSelectedHour] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const summary = useMemo(() => studyTimingSummary(sessions, subjects, timeZone), [sessions, subjects, timeZone]);
  const activeKey = summary.subjects.some(s => s.key === subjectKey) ? subjectKey : 'all';
  const rows = summary.subjects.filter(s => activeKey === 'all' || s.key === activeKey);
  const matching = summary.recorded.filter(row => (activeKey === 'all' || row.subject.key === activeKey)
    && (selectedHour === null || row.hour === selectedHour));
  const maxCount = Math.max(1, ...rows.flatMap(s => s.starts));
  const starts = Array.from({ length: 24 }, (_, hour) => rows.reduce((sum, row) => sum + row.starts[hour], 0));
  const peak = starts.indexOf(Math.max(...starts));

  function selectCell(key, hour) {
    setSubjectKey(key);
    setSelectedHour(hour);
    setShowAll(false);
  }

  return (
    <Card className="mb-4 sf-study-timing">
      <Card.Header className="d-flex justify-content-between align-items-center flex-wrap gap-2">
        <span>When &amp; what you study</span>
        <span className="small text-muted">{timeZone}</span>
      </Card.Header>
      <Card.Body>
        <div className="d-flex justify-content-between align-items-end flex-wrap gap-3 mb-3">
          <div>
            <h3 className="h6 mb-1">Session starts by subject &amp; hour</h3>
            <p className="small text-muted mb-0">Select a cell to review those sessions. Uses the date range above.</p>
          </div>
          <Form.Group controlId="timing-subject">
            <Form.Label className="small mb-1">Subject</Form.Label>
            <Form.Select size="sm" value={activeKey} onChange={e => { setSubjectKey(e.target.value); setShowAll(false); }}>
              <option value="all">All subjects</option>
              {summary.subjects.map(row => <option key={row.key} value={row.key}>{row.name}</option>)}
            </Form.Select>
          </Form.Group>
        </div>
        {summary.recorded.length === 0 ? (
          <div className="text-muted text-center py-4">
            {sessions.length === 0 ? 'No sessions in this date range.' : 'No recorded start and end times in this range yet.'}
            <div className="small mt-1">Finish a timer session or add known times in <Link to="/app/sessions">Sessions</Link>.</div>
          </div>
        ) : (
          <>
            <div className="sf-timing-summary small mb-3">
              <span><strong>{rows.reduce((sum, row) => sum + row.count, 0)}</strong> sessions with recorded times</span>
              <span>Most frequent start: <strong>{hourLabel(peak)}–{hourLabel((peak + 1) % 24)}</strong></span>
            </div>
            <div className="table-responsive mb-2" role="region" aria-label="Session starts by subject and hour; scroll horizontally" tabIndex={0}>
              <table className="sf-timing-grid">
                <caption className="visually-hidden">Number of sessions started in each local hour, by subject. Select a cell to filter the session details.</caption>
                <thead><tr><th scope="col">Subject</th>{starts.map((_, hour) => <th scope="col" key={hour}>{hourLabel(hour)}</th>)}<th scope="col">Usual start</th></tr></thead>
                <tbody>{rows.map(row => {
                  const peakHour = row.starts.indexOf(Math.max(...row.starts));
                  return <tr key={row.key}>
                    <th scope="row"><span className="sf-timing-subject"><i style={{ background: row.color }} />{row.name}</span></th>
                    {row.starts.map((count, hour) => <td key={hour}>
                      <button type="button" className="sf-timing-cell" disabled={!count}
                        aria-pressed={activeKey === row.key && selectedHour === hour}
                        aria-label={`${row.name}, ${hourLabel(hour)} to ${hourLabel((hour + 1) % 24)}: ${count} ${count === 1 ? 'session' : 'sessions'}`}
                        title={`${row.name} · ${hourLabel(hour)} · ${count} starts`}
                        style={{ '--cell-color': row.color, '--cell-opacity': count ? 0.25 + 0.65 * count / maxCount : 0.04 }}
                        onClick={() => selectCell(row.key, hour)}><span>{count || '·'}</span></button>
                    </td>)}
                    <td className="text-nowrap small">{hourLabel(peakHour)}</td>
                  </tr>;
                })}</tbody>
              </table>
            </div>
            <p className="text-muted small mb-4">Darker cells mean more starts. Tied usual start hours show the earliest hour.</p>
            <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2">
              <h3 className="h6 mb-0">Session details <span className="text-muted">· {matching.length}{selectedHour !== null && ` · starts at ${hourLabel(selectedHour)}`}</span></h3>
              {(activeKey !== 'all' || selectedHour !== null) && <Button size="sm" variant="outline-secondary" onClick={() => { setSubjectKey('all'); setSelectedHour(null); setShowAll(false); }}>Clear selection</Button>}
            </div>
            <div className="table-responsive" role="region" aria-label="Recorded session times; scroll horizontally" tabIndex={0}>
              <Table className="small align-middle sf-timing-details mb-0">
                <thead><tr><th scope="col">Subject / work</th><th scope="col">Started</th><th scope="col">Ended</th><th scope="col">Focused time</th></tr></thead>
                <tbody>{(showAll ? matching : matching.slice(0, 10)).map(({ session, subject, startedAt, endedAt }) => <tr key={session.firestoreId || session.id}>
                  <td><span className="sf-timing-subject"><i style={{ background: subject.color }} />{subject.name}</span>{session.notes && <div className="text-muted sf-timing-notes">{session.notes}</div>}</td>
                  <td className="text-nowrap">{formatRecordedDateTime(startedAt)}</td>
                  <td className="text-nowrap">{formatRecordedDateTime(endedAt)}</td>
                  <td className="text-nowrap">{formatSessionDuration(sessionDurationSeconds(session))}</td>
                </tr>)}</tbody>
              </Table>
            </div>
            {matching.length === 0 && <p className="text-muted small mt-3">No sessions match this selection.</p>}
            {matching.length > 10 && <Button variant="link" size="sm" className="mt-2 p-0" onClick={() => setShowAll(!showAll)}>{showAll ? 'Show latest 10' : `Show all ${matching.length} sessions`}</Button>}
          </>
        )}
        {summary.missing > 0 && <p className="text-muted small mt-3 mb-0">{summary.missing} {summary.missing === 1 ? 'session has' : 'sessions have'} no recorded start/end times and {summary.missing === 1 ? 'is' : 'are'} excluded here. Their study totals still count. You can add known times in <Link to="/app/sessions">Sessions</Link>.</p>}
      </Card.Body>
    </Card>
  );
}
