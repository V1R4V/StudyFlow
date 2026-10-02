import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sessionActivityStats, formatSessionDuration, formatSessionTimeRange,
  sessionDurationSeconds, timestampMillis, compareSessionsNewest,
} from '../src/utils/sessionHistory.js';

const session = (date, id = 1) => ({ id, date, durationSeconds: 60 });

test('session week comparisons use the same Sunday–weekday period', () => {
  const stats = sessionActivityStats([
    session('2026-09-27'), session('2026-10-01'),
    session('2026-09-20'), session('2026-09-24'),
    session('2026-09-25'), session('2026-09-26'), session('2026-10-02'),
  ], '2026-10-01');
  assert.equal(stats.thisWeek, 2);
  assert.equal(stats.lastWeek, 2);
  assert.equal(stats.total, 6);
  assert.equal(stats.todayCount, 1);
});

test('active-day average counts sessions and ties pick the most recent best day', () => {
  const stats = sessionActivityStats([
    session('2026-06-10', 1), session('2026-06-10', 2),
    session('2026-09-28', 3), session('2026-09-28', 4), session('2026-10-01', 5),
  ], '2026-10-02');
  assert.equal(stats.avgPerActiveDay, 5 / 3);
  assert.equal(stats.activeDays, 3);
  assert.equal(stats.bestCount, 2);
  assert.equal(stats.bestDate, '2026-09-28');
});

test('duration labels include exact seconds and hours without rounding away short sessions', () => {
  assert.equal(formatSessionDuration(2763), '46m 3s');
  assert.equal(formatSessionDuration(5400), '1h 30m');
  assert.equal(formatSessionDuration(30), '30s');
  assert.equal(formatSessionDuration(3661), '1h 1m 1s');
  assert.equal(formatSessionDuration(NaN), '0s');
  assert.equal(sessionDurationSeconds({ durationSeconds: 30, duration: 1 }), 30);
});

test('clock range survives Firestore JSON caching and uses a shared AM/PM label', () => {
  const end = new Date('2026-09-28T16:44:00').getTime();
  const saved = { date: '2026-09-28', durationSeconds: 46 * 60, createdAt: { seconds: end / 1000 } };
  assert.match(formatSessionTimeRange(saved, 'en-US'), /3:58.*4:44.*PM/);
  assert.equal(timestampMillis({ toMillis: () => end }), end);
  assert.equal(timestampMillis({ seconds: 10, nanoseconds: 500000000 }), 10500);
});

test('sessions edited onto another date do not display the old save timestamp as a study time', () => {
  const end = new Date('2026-10-01T16:44:00').getTime();
  assert.equal(formatSessionTimeRange({ date: '2026-09-28', duration: 46, createdAt: { seconds: end / 1000 } }), null);
  assert.equal(formatSessionTimeRange({ date: '2026-09-28', duration: 46 }), null);
});

test('history sorts by study date, then timestamp or legacy id', () => {
  const rows = [session('2026-09-28', 1), session('2026-10-01', 3), session('2026-09-28', 2)];
  assert.deepEqual(rows.sort(compareSessionsNewest).map(row => row.id), [3, 2, 1]);
  assert.equal(compareSessionsNewest({ date: '2026-09-28', id: 'abc' }, { date: '2026-09-28', id: 'def' }), 0);
});

test('empty session history has finite zero statistics', () => {
  const stats = sessionActivityStats([], '2026-10-02');
  assert.equal(stats.total, 0);
  assert.equal(stats.avgPerActiveDay, 0);
  assert.equal(stats.bestDate, null);
  assert.equal(stats.bestCount, 0);
});
