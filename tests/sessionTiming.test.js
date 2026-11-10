import test from 'node:test';
import assert from 'node:assert/strict';
import { recordedSessionTiming, localDateTimeInput, timingValidationError, sessionTimingFields, studyTimingSummary } from '../src/utils/sessionTiming.js';
import { formatSessionTimeRange, compareSessionsNewest } from '../src/utils/sessionHistory.js';

const ms = text => new Date(text).getTime();
const makeSession = (start, end, extra = {}) => ({
  id: 1, subjectId: 1, subjectName: 'Math', durationSeconds: (ms(end) - ms(start)) / 1000,
  startedAt: ms(start), endedAt: ms(end), ...extra,
});

test('recorded endpoints survive JSON caching independently of save time and adjusted duration', () => {
  const row = makeSession('2026-10-01T09:00:00', '2026-10-01T10:00:00', { durationSeconds: 1800, createdAt: { seconds: ms('2026-10-02T12:00:00') / 1000 } });
  assert.deepEqual(recordedSessionTiming(JSON.parse(JSON.stringify(row))), { startedAt: row.startedAt, endedAt: row.endedAt });
  assert.match(formatSessionTimeRange(row, 'en-US'), /9:00.*10:00/);
  assert.equal(recordedSessionTiming({ createdAt: row.createdAt, duration: 30 }), null);
});

test('cross-midnight sessions use the start date and split hourly minutes across midnight', () => {
  const row = makeSession('2026-10-01T23:30:00', '2026-10-02T00:30:00');
  assert.equal(sessionTimingFields(row).date, '2026-10-01');
  assert.match(formatSessionTimeRange(row, 'en-US'), /Oct 1.*Oct 2/);
  const result = studyTimingSummary([row]);
  assert.equal(result.hourlyStarts[23], 1);
  assert.equal(result.hourlyMinutes[23], 30);
  assert.equal(result.hourlyMinutes[0], 30);
});

test('pauses and duration corrections preserve focused totals in hourly estimates', () => {
  const row = makeSession('2026-10-01T09:30:00', '2026-10-01T11:30:00', { durationSeconds: 3600 });
  const result = studyTimingSummary([row]);
  assert.equal(result.hourlyMinutes[9], 15);
  assert.equal(result.hourlyMinutes[10], 30);
  assert.equal(result.hourlyMinutes[11], 15);
  assert.equal(result.hourlyMinutes.reduce((a, b) => a + b), 60);
  assert.equal(result.hourlyStarts[9], 1);
});

test('subject aliases combine and old, imported, or malformed timestamps are excluded', () => {
  const row = makeSession('2026-10-01T09:30:00', '2026-10-01T10:00:00');
  const result = studyTimingSummary([row, { ...row, id: 2, subjectId: 'math-doc' },
    { id: 3, createdAt: { seconds: row.endedAt / 1000 }, duration: 30 },
    { ...row, endedAt: row.startedAt - 1 }, { ...row, startedAt: NaN },
  ], [{ id: 1, firestoreId: 'math-doc', name: 'Mathematics', color: '#123456' }]);
  assert.equal(result.missing, 3);
  assert.equal(result.subjects.length, 1);
  assert.equal(result.subjects[0].name, 'Mathematics');
  assert.equal(result.subjects[0].starts[9], 2);
  assert.equal(result.recorded.length, 2);
});

test('date-time inputs round-trip local time including seconds', () => {
  const instant = ms('2026-10-01T23:59:48');
  assert.equal(localDateTimeInput(instant), '2026-10-01T23:59:48');
  assert.equal(ms(localDateTimeInput(instant)), instant);
  assert.equal(localDateTimeInput(undefined), '');
});

test('validation rejects incomplete, reversed, future, and too-short windows', () => {
  const start = ms('2026-10-01T09:00:00');
  const end = start + 60000;
  assert.equal(timingValidationError(start, end, 60, end), '');
  assert.equal(timingValidationError(start, start + 1000, 1, end), '');
  assert.match(timingValidationError(start, undefined, 60, end), /valid start and end/);
  assert.match(timingValidationError(end, start, 60, end), /after start/);
  assert.match(timingValidationError(start, end + 2000, 60, end), /future/);
  assert.match(timingValidationError(start, end, 120, end), /cannot exceed/);
  assert.deepEqual(sessionTimingFields({ duration: 60 }), {});
  assert.throws(() => sessionTimingFields({ startedAt: start }), /Invalid/);
});

test('history sorts recorded start time ahead of delayed save timestamps', () => {
  const early = makeSession('2026-10-01T09:00:00', '2026-10-01T10:00:00', { date: '2026-10-01', createdAt: { seconds: ms('2026-10-02') / 1000 } });
  const late = makeSession('2026-10-01T11:00:00', '2026-10-01T12:00:00', { id: 2, date: '2026-10-01' });
  assert.deepEqual([early, late].sort(compareSessionsNewest).map(row => row.id), [2, 1]);
});

test('DST hour changes preserve total minutes and do not invent skipped hours', () => {
  const original = process.env.TZ;
  process.env.TZ = 'America/Chicago';
  try {
    const spring = studyTimingSummary([makeSession('2026-03-08T01:30:00-06:00', '2026-03-08T03:30:00-05:00')]);
    assert.equal(spring.hourlyMinutes[1], 30);
    assert.equal(spring.hourlyMinutes[2], 0);
    assert.equal(spring.hourlyMinutes[3], 30);
    const fall = studyTimingSummary([makeSession('2026-11-01T00:30:00-05:00', '2026-11-01T02:30:00-06:00')]);
    assert.equal(fall.hourlyMinutes[0], 30);
    assert.equal(fall.hourlyMinutes[1], 120);
    assert.equal(fall.hourlyMinutes[2], 30);
    assert.equal(fall.hourlyMinutes.reduce((a, b) => a + b), 180);
  } finally {
    if (original === undefined) delete process.env.TZ;
    else process.env.TZ = original;
  }
});
