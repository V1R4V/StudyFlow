import { localDateString, shiftDateStr } from './sessions.js';

// Natural-language quick add: pulls a date, time, repeat, priority, and
// #subject out of a typed title, e.g. "Read ch. 4 tomorrow 3pm #DSA !!".
// Pure function, so the composer can re-run it on every keystroke and the
// returned token ranges can be highlighted in place.

const WEEKDAY_FULL = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const WEEKDAY_SHORT = { sun: 0, mon: 1, tue: 2, tues: 2, wed: 3, thu: 4, thur: 4, thurs: 4, fri: 5, sat: 6 };
const MONTH = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const FULL_DAYS = `(${WEEKDAY_FULL.join('|')})`;
const SHORT_DAYS = `(${Object.keys(WEEKDAY_SHORT).join('|')})`;
const ON = '(?:\\b(?:on|by|due)\\s+)?';

function weekdayIndex(word) {
  const w = word.toLowerCase();
  const full = WEEKDAY_FULL.indexOf(w);
  return full !== -1 ? full : WEEKDAY_SHORT[w];
}

function onOrAfter(today, weekday) {
  const diff = (weekday - new Date(`${today}T00:00:00`).getDay() + 7) % 7;
  return shiftDateStr(today, diff);
}

function monthDate(today, monthWord, day) {
  const month = MONTHS.indexOf(monthWord.toLowerCase().slice(0, 3));
  return calendarDate(today, month, Number(day));
}

// Builds this year's date, or next year's once it has passed. Rejects
// impossible dates like Feb 31.
function calendarDate(today, month, day) {
  for (const year of [Number(today.slice(0, 4)), Number(today.slice(0, 4)) + 1]) {
    const d = new Date(year, month, day);
    if (d.getMonth() !== month || d.getDate() !== day) return null;
    const value = localDateString(d);
    if (value >= today) return value;
  }
  return null;
}

function to24h(hour, minute, meridiem) {
  let h = Number(hour) % 12;
  if (meridiem.toLowerCase() === 'pm') h += 12;
  return h <= 23 && Number(minute) <= 59 ? `${String(h).padStart(2, '0')}:${String(minute).padStart(2, '0')}` : null;
}

// Each rule: kind, regex, and a reader returning the field values (or null
// to reject the match). Earlier rules win when matches overlap.
function rules(today, { looseWeekdays }) {
  return [
    { kind: 'repeat', re: new RegExp(`\\bevery\\s+(?:${FULL_DAYS}|${SHORT_DAYS})\\b`, 'gi'),
      read: m => ({ repeat: 'weekly', dueDate: onOrAfter(today, weekdayIndex(m[1] || m[2])) }) },
    { kind: 'repeat', re: /\b(?:every\s+day|daily)\b/gi, read: () => ({ repeat: 'daily' }) },
    { kind: 'repeat', re: /\b(?:every\s+weekday|weekdays)\b/gi, read: () => ({ repeat: 'weekdays' }) },
    { kind: 'repeat', re: /\b(?:every\s+week|weekly)\b/gi, read: () => ({ repeat: 'weekly' }) },
    { kind: 'repeat', re: /\b(?:every\s+month|monthly)\b/gi, read: () => ({ repeat: 'monthly' }) },

    { kind: 'date', re: new RegExp(`${ON}\\b${MONTH}\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`, 'gi'),
      read: m => ({ dueDate: monthDate(today, m[1], m[2]) }) },
    { kind: 'date', re: new RegExp(`${ON}\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+${MONTH}\\b`, 'gi'),
      read: m => ({ dueDate: monthDate(today, m[2], m[1]) }) },
    { kind: 'date', re: new RegExp(`${ON}\\b(\\d{1,2})\\/(\\d{1,2})\\b`, 'g'),
      read: m => ({ dueDate: calendarDate(today, Number(m[1]) - 1, Number(m[2])) }) },
    { kind: 'date', re: /\bin\s+(\d{1,2})\s+(days?|weeks?)\b/gi,
      read: m => ({ dueDate: shiftDateStr(today, Number(m[1]) * (m[2].toLowerCase().startsWith('week') ? 7 : 1)) }) },
    { kind: 'date', re: /\bnext\s+week\b/gi,
      read: () => ({ dueDate: onOrAfter(shiftDateStr(today, 1), 1) }) },
    { kind: 'date', re: /(?:\b(?:by|due)\s+)?\b(today|tonight|tomorrow|tmrw|tmr)\b/gi,
      read: m => {
        const word = m[1].toLowerCase();
        if (word === 'today') return { dueDate: today };
        if (word === 'tonight') return { dueDate: today, tonight: true };
        return { dueDate: shiftDateStr(today, 1) };
      } },
    { kind: 'date', re: new RegExp(`(?:\\b(?:on|by|due|next|this)\\s+)?\\b${FULL_DAYS}\\b`, 'gi'),
      read: m => ({ dueDate: onOrAfter(today, weekdayIndex(m[1])) }) },
    // Short names ("sun", "sat") are ordinary words, so they need a lead-in
    // ("on fri") unless the whole input is known to be a date phrase.
    { kind: 'date', re: new RegExp(looseWeekdays ? `\\b${SHORT_DAYS}\\b` : `\\b(?:on|by|due|next|this)\\s+${SHORT_DAYS}\\b`, 'gi'),
      read: m => ({ dueDate: onOrAfter(today, weekdayIndex(m[1])) }) },

    { kind: 'time', re: /(?:\bat\s+)?\b(\d{1,2})(?::([0-5]\d))?\s*(am|pm)\b/gi,
      read: m => ({ dueTime: to24h(m[1], m[2] || 0, m[3]) }) },
    { kind: 'time', re: /(?:\bat\s+)?\b([01]?\d|2[0-3]):([0-5]\d)\b/g,
      read: m => ({ dueTime: `${m[1].padStart(2, '0')}:${m[2]}` }) },
    { kind: 'time', re: /(?:\bat\s+)?\b(?:noon|midday)\b/gi, read: () => ({ dueTime: '12:00' }) },
    // "at 7" without am/pm: small numbers mean the evening.
    { kind: 'time', re: /\bat\s+(\d{1,2})\b(?![:/])/gi,
      read: m => {
        const h = Number(m[1]);
        if (h > 23) return null;
        return { dueTime: `${String(h <= 7 ? h + 12 : h).padStart(2, '0')}:00` };
      } },

    { kind: 'priority', re: /(?<=^|\s)(!{1,3})(?=\s|$)/g,
      read: m => ({ priority: ['low', 'medium', 'high'][m[1].length - 1] }) },
    { kind: 'priority', re: /\bp([1-3])\b/gi, read: m => ({ priority: ['high', 'medium', 'low'][Number(m[1]) - 1] }) },
    { kind: 'priority', re: /(?<=^|\s)!(high|medium|med|low)\b/gi,
      read: m => ({ priority: m[1].toLowerCase().startsWith('med') ? 'medium' : m[1].toLowerCase() }) },

    { kind: 'subject', re: /(?<=^|\s)#([^\s#]+)/g, read: (m, { subjects }) => {
      const subject = matchSubject(subjects, m[1]);
      return subject ? { subjectId: String(subject.firestoreId ?? subject.id), subjectName: subject.name } : null;
    } },
  ];
}

const normalize = value => String(value).toLowerCase().replace(/[^a-z0-9]/g, '');

// Exact match first, then a prefix shared by exactly one subject.
export function matchSubject(subjects, query) {
  const q = normalize(query);
  if (!q) return null;
  const list = subjects || [];
  const exact = list.filter(s => normalize(s.name) === q);
  if (exact.length === 1) return exact[0];
  const prefix = list.filter(s => normalize(s.name).startsWith(q));
  return prefix.length === 1 ? prefix[0] : null;
}

export function subjectSuggestions(subjects, query) {
  const q = normalize(query);
  return (subjects || []).filter(s => normalize(s.name).includes(q)).slice(0, 6);
}

function scan(text, { now = Date.now(), subjects = [], looseWeekdays = false, skipKinds = [] } = {}) {
  const today = localDateString(now);
  const tokens = [];
  const fields = {};
  // skipKinds: kinds the user cleared by hand, so those words stay in the title.
  const taken = new Set(skipKinds);

  for (const rule of rules(today, { looseWeekdays })) {
    if (taken.has(rule.kind)) continue;
    for (const m of text.matchAll(rule.re)) {
      const start = m.index;
      const end = start + m[0].length;
      if (tokens.some(t => start < t.end && end > t.start)) continue;
      const values = rule.read(m, { subjects });
      if (!values || Object.values(values).some(v => v === null)) continue;
      tokens.push({ start, end, kind: rule.kind });
      Object.assign(fields, values);
      taken.add(rule.kind);
      break;
    }
  }

  // A date-less time means the next time that clock time comes around;
  // a repeat with no date starts today (next weekday for "weekdays").
  if (fields.tonight) {
    delete fields.tonight;
    if (!fields.dueTime) fields.dueTime = '20:00';
  }
  if (fields.repeat && !fields.dueDate) {
    let start = today;
    if (fields.repeat === 'weekdays') {
      while ([0, 6].includes(new Date(`${start}T00:00:00`).getDay())) start = shiftDateStr(start, 1);
    }
    fields.dueDate = start;
  }
  if (fields.dueTime && !fields.dueDate) {
    fields.dueDate = new Date(`${today}T${fields.dueTime}:00`).getTime() > now ? today : shiftDateStr(today, 1);
  }
  delete fields.subjectName;

  tokens.sort((a, b) => a.start - b.start);
  let stripped = '';
  let cursor = 0;
  tokens.forEach(t => { stripped += `${text.slice(cursor, t.start)} `; cursor = t.end; });
  stripped = (stripped + text.slice(cursor)).replace(/\s+/g, ' ').trim();
  return { stripped, fields, tokens };
}

export function parseQuickAdd(text, options) {
  const { stripped, fields, tokens } = scan(text || '', options);
  // Never leave a reminder with no title: if every word was a token,
  // treat the whole input as the title.
  if (!stripped) return { title: (text || '').trim(), fields: {}, tokens: [] };
  return { title: stripped, fields, tokens };
}

// For the date menu's "type a date" box: the whole input must be a date
// and/or time ("fri 3pm", "nov 2"), otherwise null.
export function parseDatePhrase(text, { now = Date.now() } = {}) {
  const { stripped, fields } = scan((text || '').trim(), { now, looseWeekdays: true });
  if (stripped || !fields.dueDate) return null;
  return { dueDate: fields.dueDate, dueTime: fields.dueTime ?? null };
}
