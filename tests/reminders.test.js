import test from 'node:test';
import assert from 'node:assert/strict';
import {
  nextOccurrence, advanceRepeat, dueAtMs, isOverdue, groupForView,
  badgeCount, remindersForDate, matchesSearch, formatTime, nextAlertAt,
} from '../src/utils/reminders.js';

const at = (date, time = '00:00') => new Date(`${date}T${time}:00`).getTime();
const r = overrides => ({
  id: Math.random(), title: 'R', note: '', dueDate: null, dueTime: null,
  priority: 'none', repeat: 'none', checklist: [], done: false, createdAt: 0, ...overrides,
});

test('nextOccurrence handles each repeat rule', () => {
  assert.equal(nextOccurrence('2026-10-22', 'daily'), '2026-10-23');
  assert.equal(nextOccurrence('2026-10-22', 'weekly'), '2026-10-29');
  assert.equal(nextOccurrence('2026-10-23', 'weekdays'), '2026-10-26'); // Fri -> Mon
  assert.equal(nextOccurrence('2026-10-24', 'weekdays'), '2026-10-26'); // Sat -> Mon
  assert.equal(nextOccurrence('2026-10-26', 'weekdays'), '2026-10-27'); // Mon -> Tue
  assert.equal(nextOccurrence('2027-01-31', 'monthly'), '2027-02-28');
  assert.equal(nextOccurrence('2028-01-31', 'monthly'), '2028-02-29');
  assert.equal(nextOccurrence('2026-12-15', 'monthly'), '2027-01-15');
  assert.equal(nextOccurrence('2026-10-22', 'none'), '2026-10-22');
});

test('advanceRepeat skips missed occurrences and lands after today', () => {
  assert.equal(advanceRepeat('2026-10-15', 'daily', '2026-10-22'), '2026-10-23');
  assert.equal(advanceRepeat('2026-10-22', 'daily', '2026-10-22'), '2026-10-23');
  // Completing early keeps the cadence anchored to the due date.
  assert.equal(advanceRepeat('2026-10-25', 'daily', '2026-10-22'), '2026-10-26');
  assert.equal(advanceRepeat('2026-10-01', 'weekly', '2026-10-22'), '2026-10-29');
});

test('dueAtMs uses the time, 09:00 for all-day, null when undated', () => {
  assert.equal(dueAtMs(r({ dueDate: '2026-10-22', dueTime: '14:30' })), at('2026-10-22', '14:30'));
  assert.equal(dueAtMs(r({ dueDate: '2026-10-22' })), at('2026-10-22', '09:00'));
  assert.equal(dueAtMs(r()), null);
});

test('isOverdue: timed past now, all-day only once the day is over', () => {
  const now = at('2026-10-22', '12:00');
  assert.equal(isOverdue(r({ dueDate: '2026-10-22', dueTime: '09:00' }), now), true);
  assert.equal(isOverdue(r({ dueDate: '2026-10-22', dueTime: '15:00' }), now), false);
  assert.equal(isOverdue(r({ dueDate: '2026-10-22' }), now), false);
  assert.equal(isOverdue(r({ dueDate: '2026-10-21' }), now), true);
  assert.equal(isOverdue(r(), now), false);
  assert.equal(isOverdue(r({ dueDate: '2026-10-21', done: true }), now), false);
});

test('groupForView today: overdue section then today, sorted by time then priority', () => {
  const list = [
    r({ id: 'late', dueDate: '2026-10-20' }),
    r({ id: 'pm', dueDate: '2026-10-22', dueTime: '14:00' }),
    r({ id: 'allday', dueDate: '2026-10-22' }),
    r({ id: 'am-high', dueDate: '2026-10-22', dueTime: '09:00', priority: 'high' }),
    r({ id: 'am-low', dueDate: '2026-10-22', dueTime: '09:00', priority: 'low' }),
    r({ id: 'tomorrow', dueDate: '2026-10-23' }),
    r({ id: 'nodate' }),
  ];
  const groups = groupForView('today', list, '2026-10-22');
  assert.deepEqual(groups.map(g => g.key), ['overdue', '2026-10-22']);
  assert.deepEqual(groups[0].items.map(i => i.id), ['late']);
  assert.deepEqual(groups[1].items.map(i => i.id), ['allday', 'am-high', 'am-low', 'pm']);
});

test('groupForView scheduled groups by day; anytime holds undated', () => {
  const list = [
    r({ id: 'a', dueDate: '2026-10-24' }),
    r({ id: 'b', dueDate: '2026-10-22' }),
    r({ id: 'c', dueDate: '2026-10-19' }),
    r({ id: 'd' }),
  ];
  const scheduled = groupForView('scheduled', list, '2026-10-22');
  assert.deepEqual(scheduled.map(g => g.key), ['overdue', '2026-10-22', '2026-10-24']);
  assert.equal(scheduled[1].label, 'Today');
  const anytime = groupForView('anytime', list, '2026-10-22');
  assert.deepEqual(anytime.map(g => g.items.map(i => i.id)), [['d']]);
  assert.deepEqual(groupForView('anytime', [], '2026-10-22'), []);
});

test('groupForView completed sorts newest first', () => {
  const list = [r({ id: 'old', done: true, completedAt: 1 }), r({ id: 'new', done: true, completedAt: 5 })];
  assert.deepEqual(groupForView('completed', list, '2026-10-22')[0].items.map(i => i.id), ['new', 'old']);
});

test('badgeCount counts overdue and due today only', () => {
  const now = at('2026-10-22', '12:00');
  const list = [
    r({ dueDate: '2026-10-21' }), r({ dueDate: '2026-10-22' }), r({ dueDate: '2026-10-23' }),
    r(), r({ dueDate: '2026-10-22', done: true }),
  ];
  assert.equal(badgeCount(list, now), 2);
});

test('remindersForDate shows overdue only when the date is today', () => {
  const now = at('2026-10-22', '12:00');
  const list = [r({ id: 'late', dueDate: '2026-10-20' }), r({ id: 'today', dueDate: '2026-10-22' }), r({ id: 'fri', dueDate: '2026-10-23' })];
  const today = remindersForDate(list, '2026-10-22', now);
  assert.deepEqual(today.overdue.map(i => i.id), ['late']);
  assert.deepEqual(today.due.map(i => i.id), ['today']);
  const friday = remindersForDate(list, '2026-10-23', now);
  assert.deepEqual(friday.overdue, []);
  assert.deepEqual(friday.due.map(i => i.id), ['fri']);
});

test('matchesSearch looks at title, note, and checklist', () => {
  const item = r({ title: 'Email prof', note: 'about the extension', checklist: [{ id: 1, text: 'Attach CV', done: false }] });
  assert.equal(matchesSearch(item, ''), true);
  assert.equal(matchesSearch(item, 'PROF'), true);
  assert.equal(matchesSearch(item, 'extension'), true);
  assert.equal(matchesSearch(item, 'cv'), true);
  assert.equal(matchesSearch(item, 'stripe'), false);
});

test('formatTime renders 12-hour clock', () => {
  assert.equal(formatTime('00:05'), '12:05 AM');
  assert.equal(formatTime('09:00'), '9:00 AM');
  assert.equal(formatTime('12:30'), '12:30 PM');
  assert.equal(formatTime('23:45'), '11:45 PM');
  assert.equal(formatTime(null), '');
});

test('nextAlertAt prefers a future snooze over the due time', () => {
  const item = r({ dueDate: '2026-10-22', dueTime: '09:00' });
  assert.equal(nextAlertAt(item), at('2026-10-22', '09:00'));
  assert.equal(nextAlertAt({ ...item, snoozedUntil: at('2026-10-22', '10:00') }), at('2026-10-22', '10:00'));
  assert.equal(nextAlertAt(r()), null);
});
