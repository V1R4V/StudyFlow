import test from 'node:test';
import assert from 'node:assert/strict';
import { weekProgress, progressPercent, formatStudyTime } from '../src/utils/progress.js';
import { weekStartStr, plannedHoursFor, dayLoad } from '../src/utils/plan.js';
import { getSessionMinutes, shiftDateStr } from '../src/utils/sessions.js';

const dsa = { id: 1, firestoreId: 'dsa-doc', name: 'DSA', weeklyGoal: 1 };
const design = { id: 2, name: 'System Design', weeklyGoal: 1 };
const summarize = overrides => weekProgress({
  subjects: [dsa, design], sessions: [], planEntries: [],
  anchorDate: '2026-10-01', today: '2026-10-01', ...overrides,
});

test('Sunday–Saturday includes both boundaries and excludes adjacent weeks', () => {
  const result = summarize({ sessions: [
    { subjectId: 1, date: '2026-09-26', duration: 99 },
    { subjectId: 1, date: '2026-09-27', duration: 10 },
    { subjectId: 1, date: '2026-10-03', duration: 20 },
    { subjectId: 1, date: '2026-10-04', duration: 99 },
  ], today: '2026-10-03' });
  assert.equal(result.start, '2026-09-27');
  assert.equal(result.end, '2026-10-03');
  assert.equal(result.totalMinutes, 30);
  assert.equal(weekStartStr('2026-10-03'), result.start);
  assert.equal(weekStartStr('2026-10-04'), '2026-10-04');
});

test('unscheduled sessions and both subject identifiers advance actual goals', () => {
  const result = summarize({ sessions: [
    { subjectId: 'dsa-doc', date: '2026-09-30', durationSeconds: 1800, duration: 99 },
    { subjectId: '1', date: '2026-10-01', duration: 18 },
  ] });
  assert.equal(result.rows[0].loggedMinutes, 48);
  assert.equal(result.rows[0].goalPct, 80);
  assert.equal(result.rows[0].plannedMinutes, 0);
  assert.equal(result.rows[0].remainingMinutes, 12);
  assert.equal(result.totalMinutes, 48);
});

test('surplus for one subject cannot complete another subject goal or schedule', () => {
  const result = summarize({ sessions: [{ subjectId: 1, date: '2026-10-01', duration: 180 }], planEntries: [
    { subjectId: 'dsa-doc', scope: 'once', date: '2026-10-01', hours: 1 },
    { subjectId: '2', scope: 'once', date: '2026-10-01', hours: 1 },
  ] });
  assert.equal(result.goalPct, 50);
  assert.equal(result.schedulePct, 50);
  assert.equal(result.goalsMet, 1);
  assert.equal(result.rows[1].goalMet, false);
  assert.equal(result.remainingGoalMinutes, 60);
  assert.equal(result.remainingScheduleMinutes, 60);
  assert.equal(result.totalMinutes, 180);
});

test('scheduled time never marks an unstudied goal complete', () => {
  const result = summarize({ planEntries: [{ subjectId: 'dsa-doc', scope: 'once', date: '2026-10-02', hours: 4 }] });
  assert.equal(result.plannedMinutes, 240);
  assert.equal(result.goalPct, 0);
  assert.equal(result.goalsMet, 0);
});

test('seconds preserve precision and a nearly complete goal is not complete', () => {
  assert.equal(getSessionMinutes({ durationSeconds: 30, duration: 1 }), 0.5);
  assert.equal(formatStudyTime(0.5), '30s');
  assert.equal(formatStudyTime(0.5, 'minutes'), '0.5 min');
  assert.equal(formatStudyTime(0.5, 'hours'), '<0.01 h');
  const result = summarize({ sessions: [{ subjectId: 1, date: '2026-10-01', durationSeconds: 3599 }] });
  assert.equal(result.rows[0].goalPct, 99);
  assert.equal(result.rows[0].goalMet, false);
  assert.equal(progressPercent(60, 60), 100);
});

test('future-dated sessions do not count as completed work', () => {
  const result = summarize({ sessions: [{ subjectId: 1, date: '2026-10-02', duration: 120 }] });
  assert.equal(result.totalMinutes, 0);
  assert.equal(result.days[5].isFuture, true);
  assert.equal(result.goalsMet, 0);
});

test('current-week change compares the same elapsed weekdays in the previous week', () => {
  const result = summarize({ sessions: [
    { subjectId: 1, date: '2026-09-20', duration: 10 },
    { subjectId: 1, date: '2026-09-24', duration: 20 },
    { subjectId: 1, date: '2026-09-25', duration: 99 },
  ] });
  assert.equal(result.previousMinutes, 30);
  assert.equal(result.elapsedDays, 5);
});

test('a past-week review includes its entire week and compares entire prior week', () => {
  const result = summarize({ anchorDate: '2026-09-22', sessions: [
    { subjectId: 1, date: '2026-09-26', duration: 20 },
    { subjectId: 1, date: '2026-09-19', duration: 10 },
  ] });
  assert.equal(result.totalMinutes, 20);
  assert.equal(result.previousMinutes, 10);
  assert.equal(result.elapsedDays, 7);
});

test('local date shifts survive DST and year boundaries', () => {
  assert.equal(shiftDateStr('2026-03-08', 1), '2026-03-09');
  assert.equal(shiftDateStr('2026-11-01', 1), '2026-11-02');
  assert.equal(weekStartStr('2027-01-01'), '2026-12-27');
  const spring = summarize({ anchorDate: '2026-03-08', today: '2026-03-14' });
  assert.deepEqual(spring.days.map(day => day.date), ['2026-03-08', '2026-03-09', '2026-03-10', '2026-03-11', '2026-03-12', '2026-03-13', '2026-03-14']);
});

test('explicit zero hours override recurring legacy plans', () => {
  assert.equal(plannedHoursFor([
    { subjectId: 'dsa-doc', scope: 'weekly', day: 1, hours: 2 },
    { subjectId: 'dsa-doc', scope: 'once', date: '2026-06-08', hours: 0 },
  ], 'dsa-doc', '2026-06-08'), 0);
});

test('planner totals preserve fractional hours and accept stored numeric strings', () => {
  const plans = [{ subjectId: 'dsa-doc', scope: 'once', date: '2026-10-01', hours: '0.3333333333333333' }];
  const result = summarize({ planEntries: plans });
  assert.equal(result.plannedMinutes, 20);
  assert.equal(dayLoad(plans, [dsa], result.start)[4].hours, 1 / 3);
});

test('missing goals and malformed durations do not create invalid totals', () => {
  const result = summarize({ subjects: [{ id: 1, weeklyGoal: 0 }], sessions: [
    { subjectId: 1, date: '2026-10-01', durationSeconds: NaN },
    { subjectId: 1, date: '2026-10-01', duration: -10 },
    { subjectId: 1, date: '2026-10-01', duration: 1 },
  ] });
  assert.equal(result.totalMinutes, 1);
  assert.equal(result.goalPct, 0);
  assert.equal(result.rows[0].goalMet, false);
  assert.equal(result.goalCount, 0);
});
