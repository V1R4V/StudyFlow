import test from 'node:test';
import assert from 'node:assert/strict';
import { parseQuickAdd, parseDatePhrase } from '../src/utils/reminderParse.js';

// Thursday, Oct 22 2026, 10:00 local.
const now = new Date('2026-10-22T10:00:00').getTime();
const subjects = [
  { id: 1, firestoreId: 'dsa', name: 'DSA' },
  { id: 2, firestoreId: 'jobs', name: 'Job apps' },
  { id: 3, firestoreId: 'conn', name: 'Job Connetions' },
  { id: 4, firestoreId: 'cs564', name: 'CS564' },
];
const parse = text => parseQuickAdd(text, { now, subjects });

test('plain text passes through untouched', () => {
  const r = parse('Email the professor');
  assert.equal(r.title, 'Email the professor');
  assert.deepEqual(r.fields, {});
  assert.deepEqual(r.tokens, []);
});

test('relative days and connector words are stripped from the title', () => {
  assert.deepEqual(parse('Read chapter 4 tomorrow').fields, { dueDate: '2026-10-23' });
  assert.equal(parse('Read chapter 4 tomorrow').title, 'Read chapter 4');
  assert.deepEqual(parse('Submit form today').fields, { dueDate: '2026-10-22' });
  assert.deepEqual(parse('Pay rent in 3 days').fields, { dueDate: '2026-10-25' });
  assert.deepEqual(parse('Plan sprint next week').fields, { dueDate: '2026-10-26' });
  assert.equal(parse('Call mom on friday').title, 'Call mom');
  assert.deepEqual(parse('Call mom on friday').fields, { dueDate: '2026-10-23' });
});

test('weekday names: full names always, short names only after on/next/by', () => {
  assert.deepEqual(parse('Gym monday').fields, { dueDate: '2026-10-26' });
  assert.deepEqual(parse('Gym on mon').fields, { dueDate: '2026-10-26' });
  assert.deepEqual(parse('Buy sun cream').fields, {});
  assert.deepEqual(parse('Study for SAT exam').fields, {});
  assert.deepEqual(parse('Review thursday').fields, { dueDate: '2026-10-22' });
});

test('month dates roll to next year once passed', () => {
  assert.deepEqual(parse('Exam oct 30').fields, { dueDate: '2026-10-30' });
  assert.deepEqual(parse('Exam 5 nov').fields, { dueDate: '2026-11-05' });
  assert.deepEqual(parse('Renew passport jan 3rd').fields, { dueDate: '2027-01-03' });
  assert.deepEqual(parse('Deadline 11/14').fields, { dueDate: '2026-11-14' });
});

test('times, with a date or alone', () => {
  assert.deepEqual(parse('Standup tomorrow at 9am').fields, { dueDate: '2026-10-23', dueTime: '09:00' });
  assert.deepEqual(parse('Call 3:30pm').fields, { dueDate: '2026-10-22', dueTime: '15:30' });
  assert.deepEqual(parse('Lunch noon').fields, { dueDate: '2026-10-22', dueTime: '12:00' });
  assert.deepEqual(parse('Wake 8am').fields, { dueDate: '2026-10-23', dueTime: '08:00' }); // already passed today
  assert.deepEqual(parse('Sync at 14:00').fields, { dueDate: '2026-10-22', dueTime: '14:00' });
  assert.deepEqual(parse('Dinner tonight').fields, { dueDate: '2026-10-22', dueTime: '20:00' });
  assert.equal(parse('Standup tomorrow at 9am').title, 'Standup');
});

test('priority from !, p1-p3, and !word', () => {
  assert.equal(parse('Fix bug !!!').fields.priority, 'high');
  assert.equal(parse('Fix bug !!').fields.priority, 'medium');
  assert.equal(parse('Fix bug !').fields.priority, 'low');
  assert.equal(parse('Fix bug p1').fields.priority, 'high');
  assert.equal(parse('Fix bug !low').fields.priority, 'low');
  assert.equal(parse('Fix bug !!!').title, 'Fix bug');
  assert.equal(parse('Wow!').fields.priority, undefined);
});

test('#subject matches an exact or unique prefix, ignoring spaces and case', () => {
  assert.equal(parse('Leetcode #dsa').fields.subjectId, 'dsa');
  assert.equal(parse('Leetcode #DSA').title, 'Leetcode');
  assert.equal(parse('Apply #jobapps').fields.subjectId, 'jobs');
  assert.equal(parse('Ping #jobc').fields.subjectId, 'conn');
  assert.equal(parse('Ambiguous #job').fields.subjectId, undefined);
  assert.equal(parse('Project #cs5').fields.subjectId, 'cs564');
  assert.equal(parse('Tag #nothing').fields.subjectId, undefined);
});

test('repeat phrases set a date when none is given', () => {
  assert.deepEqual(parse('Stretch every day').fields, { repeat: 'daily', dueDate: '2026-10-22' });
  assert.deepEqual(parse('Standup weekdays 9am').fields, { repeat: 'weekdays', dueDate: '2026-10-22', dueTime: '09:00' });
  assert.deepEqual(parse('Review notes every monday').fields, { repeat: 'weekly', dueDate: '2026-10-26' });
  assert.deepEqual(parse('Rent monthly oct 30').fields, { repeat: 'monthly', dueDate: '2026-10-30' });
});

test('everything together, tokens in order with kinds', () => {
  const r = parse('Read ch. 4 tomorrow 3pm #DSA !!');
  assert.equal(r.title, 'Read ch. 4');
  assert.deepEqual(r.fields, { dueDate: '2026-10-23', dueTime: '15:00', subjectId: 'dsa', priority: 'medium' });
  assert.deepEqual(r.tokens.map(t => t.kind), ['date', 'time', 'subject', 'priority']);
  const text = 'Read ch. 4 tomorrow 3pm #DSA !!';
  assert.equal(text.slice(r.tokens[0].start, r.tokens[0].end), 'tomorrow');
});

test('a title made only of tokens keeps the original text', () => {
  assert.equal(parse('tomorrow').title, 'tomorrow');
});

test('parseDatePhrase reads a whole phrase or returns null', () => {
  assert.deepEqual(parseDatePhrase('fri 3pm', { now }), { dueDate: '2026-10-23', dueTime: '15:00' });
  assert.deepEqual(parseDatePhrase('3pm', { now }), { dueDate: '2026-10-22', dueTime: '15:00' });
  assert.deepEqual(parseDatePhrase('nov 2', { now }), { dueDate: '2026-11-02', dueTime: null });
  assert.equal(parseDatePhrase('banana', { now }), null);
  assert.equal(parseDatePhrase('', { now }), null);
});

test('skipKinds leaves those words in the title', () => {
  const r = parseQuickAdd('Plan trip tomorrow !!', { now, subjects, skipKinds: ['date'] });
  assert.equal(r.title, 'Plan trip tomorrow');
  assert.deepEqual(r.fields, { priority: 'medium' });
});

test('#subject works with any user’s subject names', () => {
  const theirs = [
    { id: 1, firestoreId: 'ds', name: 'Data Structures' },
    { id: 2, firestoreId: 'dsc', name: 'Data Science' },
    { id: 3, firestoreId: 'math', name: 'Mathématiques' },
    { id: 4, firestoreId: 'hindi', name: 'हिंदी' },
    { id: 5, firestoreId: 'react', name: 'React|OOPS|AppliedAI (skill building)' },
    { id: 6, firestoreId: 'algo', name: 'algo_2' },
  ];
  const p = text => parseQuickAdd(text, { now, subjects: theirs });
  assert.equal(p('Trees #datastructures').fields.subjectId, 'ds');
  assert.equal(p('Trees #datastruct').fields.subjectId, 'ds');
  assert.equal(p('Trees #DataStructures').fields.subjectId, 'ds');
  assert.equal(p('Ambiguous #data').fields.subjectId, undefined);
  assert.equal(p('Ambiguous #data').title, 'Ambiguous #data');
  assert.equal(p('Proofs #mathematiques').fields.subjectId, 'math');
  assert.equal(p('Proofs #mathé').fields.subjectId, 'math');
  assert.equal(p('Essay #हिंदी').fields.subjectId, 'hindi');
  assert.equal(p('Hooks #react').fields.subjectId, 'react');
  assert.equal(p('DP #algo2').fields.subjectId, 'algo');
  assert.equal(p('Fix issue #42').title, 'Fix issue #42');
  assert.equal(parseQuickAdd('Trees #dsa', { now, subjects: [] }).title, 'Trees #dsa');
});

test('more ways of writing a time', () => {
  assert.equal(parse('Call 3 pm').fields.dueTime, '15:00');
  assert.equal(parse('Call 3PM').fields.dueTime, '15:00');
  assert.equal(parse('Call 3.30pm').fields.dueTime, '15:30');
  assert.equal(parse('Call 12am tomorrow').fields.dueTime, '00:00');
  assert.equal(parse('Call 12pm').fields.dueTime, '12:00');
  assert.equal(parse('Call 23:15').fields.dueTime, '23:15');
  assert.equal(parse('Room 4 at 25').fields.dueTime, undefined);
});
