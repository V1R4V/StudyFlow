import test from 'node:test';
import assert from 'node:assert/strict';
import { zonedDateTimeInput, parseZonedDateTime, isTimeZone } from '../src/utils/timeZone.js';
import { studyTimingSummary, formatRecordedDateTime } from '../src/utils/sessionTiming.js';
import { formatSessionTimeRange } from '../src/utils/sessionHistory.js';

const ms = Date.parse;
test('session inputs convert the same instant across international date boundaries', () => {
  const instant = ms('2026-11-10T01:05:14Z');
  assert.equal(zonedDateTimeInput(instant, 'America/Chicago'), '2026-11-09T19:05:14');
  assert.equal(zonedDateTimeInput(instant, 'Asia/Kolkata'), '2026-11-10T06:35:14');
  assert.equal(zonedDateTimeInput(instant, 'Pacific/Kiritimati'), '2026-11-10T15:05:14');
  assert.equal(parseZonedDateTime('2026-11-10T06:35:14', 'Asia/Kolkata'), instant);
});

test('editing supports fractional UTC offsets and rejects nonexistent dates', () => {
  assert.equal(parseZonedDateTime('2026-11-10T06:50', 'Asia/Kathmandu'), ms('2026-11-10T01:05:00Z'));
  for (const value of ['2026-02-30T09:00', '2026-11-10T24:00', '', 'not a date']) {
    assert.ok(Number.isNaN(parseZonedDateTime(value, 'UTC')));
  }
  assert.equal(isTimeZone('Mars/Olympus'), false);
  assert.equal(isTimeZone('Australia/Lord_Howe'), true);
});

test('DST gaps cannot silently become a different study time', () => {
  assert.ok(Number.isNaN(parseZonedDateTime('2026-03-08T02:30', 'America/Chicago')));
});

test('ambiguous fall-back edits preserve the original occurrence', () => {
  const early = ms('2026-11-01T01:30:00-05:00');
  const late = ms('2026-11-01T01:30:00-06:00');
  assert.equal(parseZonedDateTime('2026-11-01T01:35', 'America/Chicago', early), early + 300000);
  assert.equal(parseZonedDateTime('2026-11-01T01:35', 'America/Chicago', late), late + 300000);
});

test('hourly analytics convert zones without changing focus totals or stored records', () => {
  const session = { subjectId: 1, startedAt: ms('2026-11-10T00:30Z'), endedAt: ms('2026-11-10T01:30Z'), durationSeconds: 1800, date: '2026-11-09' };
  const before = JSON.stringify(session);
  const chicago = studyTimingSummary([session], [], 'America/Chicago');
  const nepal = studyTimingSummary([session], [], 'Asia/Kathmandu');
  assert.equal(chicago.hourlyStarts[18], 1);
  assert.equal(nepal.hourlyStarts[6], 1);
  assert.equal(nepal.hourlyMinutes[6], 22.5);
  assert.equal(nepal.hourlyMinutes[7], 7.5);
  assert.equal(chicago.hourlyMinutes.reduce((a, b) => a + b), 30);
  assert.equal(nepal.hourlyMinutes.reduce((a, b) => a + b), 30);
  assert.equal(JSON.stringify(session), before);
  assert.match(formatSessionTimeRange(session, 'en-US', 'Asia/Kathmandu'), /Nov 10/);
  assert.match(formatRecordedDateTime(session.startedAt, 'Asia/Kathmandu'), /6:15/);
});

test('analytics explicitly handle DST in a zone different from the device', () => {
  const session = { startedAt: ms('2026-11-01T00:30-05:00'), endedAt: ms('2026-11-01T02:30-06:00'), durationSeconds: 10800 };
  const summary = studyTimingSummary([session], [], 'America/Chicago');
  assert.equal(summary.hourlyMinutes[0], 30);
  assert.equal(summary.hourlyMinutes[1], 120);
  assert.equal(summary.hourlyMinutes[2], 30);
});
