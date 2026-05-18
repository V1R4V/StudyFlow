import { useMemo, useState } from 'react';
import { Container, Row, Col, Card, Form, Button, ButtonGroup } from 'react-bootstrap';
import { useStudyData } from '../context/StudyDataContext';
import {
  sessionMatchesSubject,
  getSessionMinutes,
  localDateString,
  shiftDateStr,
} from '../utils/sessions';

const RANGE_OPTIONS = [
  { value: 'day', label: 'Single day' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: 'ytd', label: 'Year to date' },
  { value: 'all', label: 'All time' },
];

const DOW_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function daysBetween(startStr, endStr) {
  const start = new Date(`${startStr}T00:00:00`).getTime();
  const end = new Date(`${endStr}T00:00:00`).getTime();
  return Math.max(1, Math.round((end - start) / MS_PER_DAY) + 1);
}

function rangeBoundaries(range, sessions, selectedDay) {
  const today = new Date();
  const endDate = localDateString(today);

  if (range === 'day') {
    const safeDay = selectedDay && selectedDay <= endDate ? selectedDay : endDate;
    return { startDate: safeDay, endDate: safeDay, days: 1 };
  }

  if (range === 'all') {
    if (sessions.length === 0) {
      return { startDate: endDate, endDate, days: 1 };
    }
    const earliest = sessions.reduce(
      (acc, s) => (s.date && s.date < acc ? s.date : acc),
      endDate
    );
    return { startDate: earliest, endDate, days: daysBetween(earliest, endDate) };
  }

  if (range === 'ytd') {
    const startDate = `${today.getFullYear()}-01-01`;
    return { startDate, endDate, days: daysBetween(startDate, endDate) };
  }

  const daysMap = { '7d': 7, '30d': 30, '90d': 90 };
  const days = daysMap[range] || 7;
  const startDate = shiftDateStr(endDate, -(days - 1));
  return { startDate, endDate, days };
}

function filterByRange(sessions, startDate, endDate) {
  return sessions.filter(s => s.date >= startDate && s.date <= endDate);
}

function formatHours(minutes) {
  return (minutes / 60).toFixed(1);
}

// "1h 23m" or "23m" — used for session durations.
function formatDurationMinutes(minutes) {
  const mins = Math.max(0, Math.round(minutes));
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatDurationSeconds(seconds) {
  const total = Math.max(0, Math.floor(seconds));
  if (total < 60) return `${total}s`;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return s > 0 ? `${h}h ${m}m ${s}s` : `${h}h ${m}m`;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function getSessionSeconds(session) {
  if (typeof session.durationSeconds === 'number') return session.durationSeconds;
  if (typeof session.duration === 'number') return session.duration * 60;
  return 0;
}

// "Apr 1" — chart labels and best-day pills.
function formatShortDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatPrettyDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

// Percent change vs previous period. Returns null when there's no real
// baseline to compare against — a loud "New" badge on every card during the
// user's first weeks is noise, not insight.
function computeDelta(current, prev) {
  if (prev <= 0) return null;
  const diff = Math.round(((current - prev) / prev) * 100);
  return {
    text: `${diff >= 0 ? '+' : ''}${diff}%`,
    positive: diff >= 0,
  };
}

function median(values) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

// Longest consecutive-day run across all sessions (not just the current
// range). Pairs naturally with current streak as a personal best.
function longestStreakDays(sessions) {
  if (sessions.length === 0) return 0;
  const dates = [...new Set(sessions.map(s => s.date))].sort();
  let longest = 1;
  let current = 1;
  for (let i = 1; i < dates.length; i++) {
    if (dates[i] === shiftDateStr(dates[i - 1], 1)) {
      current += 1;
      if (current > longest) longest = current;
    } else {
      current = 1;
    }
  }
  return longest;
}

// Weekday with the most minutes in the range. Returns label + total minutes,
// or null if there's no data. More actionable than "best calendar date".
function peakWeekday(sessions) {
  if (sessions.length === 0) return null;
  const totals = [0, 0, 0, 0, 0, 0, 0]; // Sun..Sat
  sessions.forEach(s => {
    if (!s.date) return;
    const dow = new Date(`${s.date}T00:00:00`).getDay();
    totals[dow] += getSessionMinutes(s);
  });
  let best = 0;
  for (let i = 1; i < 7; i++) {
    if (totals[i] > totals[best]) best = i;
  }
  if (totals[best] === 0) return null;
  const names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return { dow: best, minutes: totals[best], label: names[best] };
}

function currentStreakDays(sessions, todayStr) {
  if (sessions.length === 0) return 0;
  const uniqueDates = [...new Set(sessions.map(s => s.date))].sort().reverse();
  let cursor = todayStr;
  // Allow a streak that ended yesterday to still count when no session today.
  if (uniqueDates[0] !== todayStr) cursor = shiftDateStr(todayStr, -1);
  let streak = 0;
  for (const dateStr of uniqueDates) {
    if (dateStr === cursor) {
      streak += 1;
      cursor = shiftDateStr(cursor, -1);
    } else if (dateStr < cursor) {
      break;
    }
  }
  return streak;
}

// SVG donut. Items: { label, value, color }. Empty state when total is 0.
function DonutChart({ items, totalLabel, totalValue }) {
  const total = items.reduce((acc, i) => acc + i.value, 0);
  const cx = 100;
  const cy = 100;
  const radius = 78;
  const strokeWidth = 22;
  const circumference = 2 * Math.PI * radius;

  if (total === 0) {
    return (
      <div className="sf-donut-empty">
        <div className="sf-donut-empty-text">No data in range</div>
      </div>
    );
  }

  let offset = 0;
  return (
    <svg
      viewBox="0 0 200 200"
      width="200"
      height="200"
      role="img"
      aria-label="Time distribution by subject"
    >
      <circle
        cx={cx}
        cy={cy}
        r={radius}
        fill="none"
        stroke="var(--bg-light)"
        strokeWidth={strokeWidth}
      />
      {items.map((item, i) => {
        if (item.value === 0) return null;
        const fraction = item.value / total;
        const dash = fraction * circumference;
        const gap = circumference - dash;
        const segment = (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke={item.color}
            strokeWidth={strokeWidth}
            strokeDasharray={`${dash} ${gap}`}
            strokeDashoffset={-offset}
            transform={`rotate(-90 ${cx} ${cy})`}
            strokeLinecap="butt"
          />
        );
        offset += dash;
        return segment;
      })}
      <text
        x={cx}
        y={cy - 6}
        textAnchor="middle"
        fontSize="26"
        fontWeight="800"
        fill="var(--text-dark)"
        style={{ letterSpacing: '-0.04em' }}
      >
        {totalValue}
      </text>
      <text
        x={cx}
        y={cy + 18}
        textAnchor="middle"
        fontSize="10"
        fontWeight="600"
        fill="var(--text-light)"
        style={{ letterSpacing: '0.08em', textTransform: 'uppercase' }}
      >
        {totalLabel}
      </text>
    </svg>
  );
}

// Daily activity bars across `startDate..endDate` (inclusive).
// Label cadence scales so axes stay readable from 7d to multi-year ranges.
function DailyActivityChart({ sessions, startDate, days }) {
  const data = useMemo(() => {
    const start = new Date(`${startDate}T00:00:00`).getTime();
    const byDate = new Map();
    sessions.forEach(s => {
      byDate.set(s.date, (byDate.get(s.date) || 0) + getSessionMinutes(s));
    });
    const result = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(start + i * MS_PER_DAY);
      const dateStr = localDateString(d);
      result.push({
        date: dateStr,
        minutes: byDate.get(dateStr) || 0,
        day: d.getDate(),
        month: d.getMonth() + 1,
      });
    }
    return result;
  }, [sessions, startDate, days]);

  let labelEvery = 1;
  if (days > 14 && days <= 31) labelEvery = 3;
  else if (days > 31 && days <= 90) labelEvery = 7;
  else if (days > 90 && days <= 200) labelEvery = 14;
  else if (days > 200) labelEvery = Math.ceil(days / 14);

  const max = Math.max(...data.map(d => d.minutes), 60);
  const chartWidth = 800;
  const chartHeight = 160;
  const gap = days <= 14 ? 6 : days <= 31 ? 4 : days <= 90 ? 2 : 1;
  const barWidth = Math.max(1, (chartWidth - gap * (days - 1)) / days);
  const gridFractions = [0.25, 0.5, 0.75, 1];

  return (
    <svg
      viewBox={`0 0 ${chartWidth} ${chartHeight + 28}`}
      width="100%"
      role="img"
      aria-label={`Daily study minutes from ${startDate} for ${days} days`}
    >
      {gridFractions.map(p => (
        <line
          key={p}
          x1={0}
          x2={chartWidth}
          y1={chartHeight - chartHeight * p}
          y2={chartHeight - chartHeight * p}
          stroke="var(--border-color)"
          strokeWidth={0.5}
          strokeDasharray="2 4"
        />
      ))}
      {data.map((d, i) => {
        const h = max > 0 ? (d.minutes / max) * chartHeight : 0;
        const x = i * (barWidth + gap);
        const y = chartHeight - h;
        const isToday = i === days - 1;
        const showLabel = i === days - 1 || i === 0 || i % labelEvery === 0;
        return (
          <g key={i}>
            <title>{`${d.date}: ${formatDurationMinutes(d.minutes)}`}</title>
            <rect
              x={x}
              y={y}
              width={barWidth}
              height={Math.max(h, 2)}
              rx={Math.min(3, barWidth / 2)}
              fill="var(--primary)"
              opacity={d.minutes > 0 ? (isToday ? 1 : 0.7) : 0.15}
            />
            {showLabel && barWidth > 6 && (
              <text
                x={x + barWidth / 2}
                y={chartHeight + 18}
                textAnchor="middle"
                fontSize="10"
                fontWeight="600"
                fill="var(--text-light)"
              >
                {labelEvery >= 7 ? `${d.month}/${d.day}` : d.day}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// Total minutes per weekday across the filtered range.
function DayOfWeekChart({ sessions }) {
  const buckets = useMemo(() => {
    const raw = [0, 0, 0, 0, 0, 0, 0];
    sessions.forEach(s => {
      if (!s.date) return;
      const dow = new Date(`${s.date}T00:00:00`).getDay();
      raw[dow] += getSessionMinutes(s);
    });
    const order = [1, 2, 3, 4, 5, 6, 0];
    return order.map((idx, i) => ({
      label: DOW_LABELS[i],
      minutes: raw[idx],
    }));
  }, [sessions]);

  const max = Math.max(...buckets.map(b => b.minutes), 30);
  const chartWidth = 360;
  const chartHeight = 140;
  const gap = 14;
  const barWidth = (chartWidth - gap * 6) / 7;

  if (sessions.length === 0) {
    return <div className="text-muted text-center py-4">No sessions in range.</div>;
  }

  return (
    <svg
      viewBox={`0 0 ${chartWidth} ${chartHeight + 28}`}
      width="100%"
      role="img"
      aria-label="Study minutes by day of week"
    >
      {buckets.map((b, i) => {
        const h = max > 0 ? (b.minutes / max) * chartHeight : 0;
        const x = i * (barWidth + gap);
        const y = chartHeight - h;
        return (
          <g key={b.label}>
            <title>{`${b.label}: ${formatDurationMinutes(b.minutes)}`}</title>
            <rect
              x={x}
              y={y}
              width={barWidth}
              height={Math.max(h, 2)}
              rx={4}
              fill="var(--primary)"
              opacity={b.minutes > 0 ? 0.85 : 0.15}
            />
            <text
              x={x + barWidth / 2}
              y={chartHeight + 18}
              textAnchor="middle"
              fontSize="11"
              fontWeight="600"
              fill="var(--text-light)"
            >
              {b.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// GitHub-style contribution graph: 52 weeks × 7 days, intensity = minutes.
// Cells are clickable to drill into a single-day view.
function CalendarHeatmap({ sessions, todayStr, onPickDay }) {
  const weeksToShow = 52;
  const cellSize = 12;
  const cellGap = 3;
  const cellStride = cellSize + cellGap;
  const leftPad = 28;
  const topPad = 18;

  const { weeks, monthLabels, totalMinutes, activeDays } = useMemo(() => {
    const today = new Date(`${todayStr}T00:00:00`);
    // Anchor on Monday of the current week.
    const todayDow = today.getDay();
    const daysSinceMon = todayDow === 0 ? 6 : todayDow - 1;
    const thisWeekMon = new Date(today.getTime() - daysSinceMon * MS_PER_DAY);
    const firstMon = new Date(thisWeekMon.getTime() - (weeksToShow - 1) * 7 * MS_PER_DAY);

    const minutesByDate = new Map();
    sessions.forEach(s => {
      minutesByDate.set(s.date, (minutesByDate.get(s.date) || 0) + getSessionMinutes(s));
    });

    const weeksOut = [];
    for (let w = 0; w < weeksToShow; w++) {
      const week = [];
      for (let d = 0; d < 7; d++) {
        const date = new Date(firstMon.getTime() + (w * 7 + d) * MS_PER_DAY);
        const dateStr = localDateString(date);
        const isFuture = dateStr > todayStr;
        week.push({
          date: dateStr,
          minutes: isFuture ? null : minutesByDate.get(dateStr) || 0,
          isFuture,
          month: date.getMonth(),
        });
      }
      weeksOut.push(week);
    }

    // One month label per month, placed at the first week whose Monday lands
    // in that month after the previous label.
    const labels = [];
    let lastMonth = weeksOut[0]?.[0]?.month ?? -1;
    weeksOut.forEach((week, wIdx) => {
      const monMonth = week[0].month;
      if (wIdx > 0 && monMonth !== lastMonth) {
        labels.push({ x: leftPad + wIdx * cellStride, label: MONTH_LABELS[monMonth] });
        lastMonth = monMonth;
      }
    });

    let total = 0;
    let active = 0;
    minutesByDate.forEach(mins => {
      if (mins > 0) {
        total += mins;
        active += 1;
      }
    });

    return { weeks: weeksOut, monthLabels: labels, totalMinutes: total, activeDays: active };
  }, [sessions, todayStr]);

  const chartWidth = leftPad + weeksToShow * cellStride;
  const chartHeight = topPad + 7 * cellStride;

  // Intensity buckets — used to scale opacity on a single primary fill so
  // colors track the active theme automatically.
  function opacityFor(mins) {
    if (mins === null || mins <= 0) return 0;
    if (mins < 30) return 0.25;
    if (mins < 60) return 0.5;
    if (mins < 120) return 0.75;
    return 1;
  }

  const legendBuckets = [0, 15, 45, 90, 180];

  // Stable label row hints (every other day to keep the gutter narrow).
  const dayRowLabels = [
    { row: 0, label: 'Mon' },
    { row: 2, label: 'Wed' },
    { row: 4, label: 'Fri' },
  ];

  return (
    <div>
      <div style={{ overflowX: 'auto' }}>
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          width="100%"
          style={{ minWidth: 720 }}
          role="img"
          aria-label="Activity heatmap for the last 52 weeks"
        >
          {monthLabels.map((m, i) => (
            <text
              key={i}
              x={m.x}
              y={12}
              fontSize="10"
              fontWeight="600"
              fill="var(--text-light)"
            >
              {m.label}
            </text>
          ))}
          {dayRowLabels.map(d => (
            <text
              key={d.label}
              x={0}
              y={topPad + d.row * cellStride + cellSize - 2}
              fontSize="9"
              fontWeight="600"
              fill="var(--text-light)"
            >
              {d.label}
            </text>
          ))}
          {weeks.map((week, wIdx) =>
            week.map((day, dIdx) => {
              const x = leftPad + wIdx * cellStride;
              const y = topPad + dIdx * cellStride;
              const opacity = opacityFor(day.minutes);
              const isClickable = !day.isFuture;
              return (
                <g
                  key={`${wIdx}-${dIdx}`}
                  style={{ cursor: isClickable ? 'pointer' : 'default' }}
                  onClick={() => isClickable && onPickDay && onPickDay(day.date)}
                >
                  <title>
                    {day.isFuture
                      ? day.date
                      : `${day.date} · ${formatDurationMinutes(day.minutes)}`}
                  </title>
                  <rect
                    x={x}
                    y={y}
                    width={cellSize}
                    height={cellSize}
                    rx={2}
                    fill="var(--bg-light)"
                    stroke="var(--border-color)"
                    strokeWidth={0.5}
                  />
                  {opacity > 0 && (
                    <rect
                      x={x}
                      y={y}
                      width={cellSize}
                      height={cellSize}
                      rx={2}
                      fill="var(--primary)"
                      opacity={opacity}
                    />
                  )}
                </g>
              );
            })
          )}
        </svg>
      </div>
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mt-3 small text-muted">
        <span>
          {activeDays} active {activeDays === 1 ? 'day' : 'days'} ·{' '}
          {formatDurationMinutes(totalMinutes)} over the last 52 weeks
        </span>
        <div className="d-flex align-items-center gap-1">
          <span>Less</span>
          {legendBuckets.map(m => {
            const op = opacityFor(m);
            return (
              <span
                key={m}
                style={{
                  position: 'relative',
                  width: 12,
                  height: 12,
                  borderRadius: 2,
                  background: 'var(--bg-light)',
                  border: '1px solid var(--border-color)',
                  display: 'inline-block',
                }}
              >
                {op > 0 && (
                  <span
                    style={{
                      position: 'absolute',
                      inset: 0,
                      borderRadius: 2,
                      background: 'var(--primary)',
                      opacity: op,
                    }}
                  />
                )}
              </span>
            );
          })}
          <span>More</span>
        </div>
      </div>
    </div>
  );
}

// Per-session list used when range is a single day.
function DaySessionList({ sessions, subjects }) {
  if (sessions.length === 0) {
    return <div className="text-muted text-center py-4">No sessions on this day.</div>;
  }
  // Newest sessions first using the synthetic id (Date.now() in guest mode)
  // or fall back to insertion order when ids are Firestore strings.
  const sorted = [...sessions].sort((a, b) => {
    const ai = typeof a.id === 'number' ? a.id : 0;
    const bi = typeof b.id === 'number' ? b.id : 0;
    return bi - ai;
  });
  return (
    <div className="list-group list-group-flush">
      {sorted.map(s => {
        const subject = subjects.find(sub => sessionMatchesSubject(s, sub));
        const color = subject?.color || s.subjectColor || '#6b7280';
        const initial = (s.subjectName || '?')[0]?.toUpperCase() || '?';
        return (
          <div
            key={s.id}
            className="list-group-item d-flex justify-content-between align-items-center"
          >
            <div className="d-flex align-items-center gap-3">
              <div className="sf-subject-icon" style={{ background: color }}>
                {initial}
              </div>
              <div>
                <div className="fw-semibold">{s.subjectName}</div>
                {s.notes && (
                  <small className="text-muted">
                    {s.notes.slice(0, 60)}
                    {s.notes.length > 60 ? '…' : ''}
                  </small>
                )}
              </div>
            </div>
            <div className="text-end">
              <div className="fw-semibold">{formatDurationSeconds(getSessionSeconds(s))}</div>
              <small className="text-muted">Focus: {s.focusRating}/5</small>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function KpiCard({ label, value, sub, delta }) {
  return (
    <Card className="h-100">
      <Card.Body>
        <div className="sf-section-label mb-2">{label}</div>
        <div className="sf-stats-value">{value}</div>
        <div className="d-flex align-items-center gap-2 mt-1" style={{ minHeight: 18 }}>
          {sub && <span className="small text-muted">{sub}</span>}
          {delta && (
            <span
              className="small fw-semibold"
              style={{ color: delta.positive ? 'var(--success-text)' : 'var(--danger-text)' }}
            >
              {delta.text}
            </span>
          )}
        </div>
      </Card.Body>
    </Card>
  );
}

export default function Statistics() {
  const { subjects, sessions } = useStudyData();
  const todayStr = localDateString();
  const [range, setRange] = useState('30d');
  const [selectedDay, setSelectedDay] = useState(todayStr);

  const isDay = range === 'day';

  const { startDate, endDate, days } = useMemo(
    () => rangeBoundaries(range, sessions, selectedDay),
    [range, sessions, selectedDay]
  );
  const { prevStart, prevEnd } = useMemo(() => {
    const pEnd = shiftDateStr(startDate, -1);
    const pStart = shiftDateStr(pEnd, -(days - 1));
    return { prevStart: pStart, prevEnd: pEnd };
  }, [startDate, days]);

  const rangedSessions = useMemo(
    () => filterByRange(sessions, startDate, endDate),
    [sessions, startDate, endDate]
  );
  const prevSessions = useMemo(
    () => filterByRange(sessions, prevStart, prevEnd),
    [sessions, prevStart, prevEnd]
  );

  const breakdown = useMemo(() => {
    return subjects
      .map(s => {
        const subjSessions = rangedSessions.filter(sess => sessionMatchesSubject(sess, s));
        const minutes = subjSessions.reduce((acc, sess) => acc + getSessionMinutes(sess), 0);
        const avgFocus =
          subjSessions.length > 0
            ? (
                subjSessions.reduce((acc, sess) => acc + (sess.focusRating || 0), 0) /
                subjSessions.length
              ).toFixed(1)
            : '—';
        return { ...s, minutes, count: subjSessions.length, avgFocus };
      })
      .sort((a, b) => b.minutes - a.minutes);
  }, [subjects, rangedSessions]);

  const totalMinutes = rangedSessions.reduce((acc, s) => acc + getSessionMinutes(s), 0);
  const prevTotalMinutes = prevSessions.reduce((acc, s) => acc + getSessionMinutes(s), 0);

  const totalSessions = rangedSessions.length;
  const prevTotalSessions = prevSessions.length;

  const avgFocus =
    rangedSessions.length > 0
      ? rangedSessions.reduce((acc, s) => acc + (s.focusRating || 0), 0) / rangedSessions.length
      : 0;
  const prevAvgFocus =
    prevSessions.length > 0
      ? prevSessions.reduce((acc, s) => acc + (s.focusRating || 0), 0) / prevSessions.length
      : 0;

  const avgSessionMinutes = totalSessions > 0 ? totalMinutes / totalSessions : 0;
  const prevAvgSessionMinutes =
    prevTotalSessions > 0 ? prevTotalMinutes / prevTotalSessions : 0;

  const dailyTotals = useMemo(() => {
    const map = new Map();
    rangedSessions.forEach(s => {
      map.set(s.date, (map.get(s.date) || 0) + getSessionMinutes(s));
    });
    return map;
  }, [rangedSessions]);

  let bestDay = { date: '', minutes: 0 };
  dailyTotals.forEach((minutes, date) => {
    if (minutes > bestDay.minutes) bestDay = { date, minutes };
  });

  const longestSession = rangedSessions.reduce(
    (acc, s) => {
      const mins = getSessionMinutes(s);
      return mins > acc.minutes
        ? { minutes: mins, subjectName: s.subjectName, date: s.date }
        : acc;
    },
    { minutes: 0, subjectName: '', date: '' }
  );

  const streak = useMemo(() => currentStreakDays(sessions, todayStr), [sessions, todayStr]);

  const activeDays = dailyTotals.size;
  const activeDaysPct = days > 0 ? Math.round((activeDays / days) * 100) : 0;
  const prevDailyTotals = useMemo(() => {
    const map = new Map();
    prevSessions.forEach(s => {
      map.set(s.date, (map.get(s.date) || 0) + getSessionMinutes(s));
    });
    return map;
  }, [prevSessions]);
  const prevActiveDays = prevDailyTotals.size;
  const prevActiveDaysPct = days > 0 ? Math.round((prevActiveDays / days) * 100) : 0;

  // Real insight metrics — each maps to a single number the user can act on.
  const sessionMinutesArray = rangedSessions.map(getSessionMinutes);
  const medianSessionMins = median(sessionMinutesArray);
  const avgPerActiveDay = activeDays > 0 ? totalMinutes / activeDays : 0;
  const highFocusCount = rangedSessions.filter(s => (s.focusRating || 0) >= 4).length;
  // Deep Work Rate: share of sessions ≥ 60min — Cal Newport's threshold for
  // sustained focus. Tracks the *quality* of work, not just total hours.
  const deepSessions = rangedSessions.filter(s => getSessionMinutes(s) >= 60).length;
  const deepRate = totalSessions > 0 ? Math.round((deepSessions / totalSessions) * 100) : 0;
  const prevDeepSessions = prevSessions.filter(s => getSessionMinutes(s) >= 60).length;
  const prevDeepRate =
    prevTotalSessions > 0 ? Math.round((prevDeepSessions / prevTotalSessions) * 100) : 0;
  const longestStreak = useMemo(() => longestStreakDays(sessions), [sessions]);
  const peak = useMemo(() => peakWeekday(rangedSessions), [rangedSessions]);

  // For single-day mode: compare today vs the user's typical day over the
  // last 30 days. More motivating than "57% of the range".
  const last30AvgDailyMins = useMemo(() => {
    if (!isDay) return 0;
    const start = shiftDateStr(todayStr, -29);
    const recent = sessions.filter(s => s.date >= start && s.date <= todayStr);
    const total = recent.reduce((acc, s) => acc + getSessionMinutes(s), 0);
    return total / 30;
  }, [sessions, todayStr, isDay]);

  const focusBySubject = useMemo(() => {
    return breakdown
      .filter(b => b.count > 0)
      .slice()
      .sort((a, b) => Number(b.avgFocus) - Number(a.avgFocus));
  }, [breakdown]);

  const donutItems = breakdown.map(b => ({
    label: b.name,
    value: b.minutes,
    color: b.color,
  }));

  const totalHours = formatHours(totalMinutes);
  const totalMinutesDelta = computeDelta(totalMinutes, prevTotalMinutes);
  const totalSessionsDelta = computeDelta(totalSessions, prevTotalSessions);
  const avgFocusDelta = computeDelta(avgFocus, prevAvgFocus);
  const avgSessionDelta = computeDelta(avgSessionMinutes, prevAvgSessionMinutes);
  const consistencyDelta = computeDelta(activeDaysPct, prevActiveDaysPct);
  const deepRateDelta = computeDelta(deepRate, prevDeepRate);

  const rangeLabel = RANGE_OPTIONS.find(o => o.value === range)?.label || '';
  const isEmpty = sessions.length === 0;
  const rangeEmpty = !isEmpty && rangedSessions.length === 0;

  // Tab choice for the combined Activity card. Both views read from the same
  // ranged session set, so the toggle is free — no extra work, no reload.
  const [activityView, setActivityView] = useState('timeline');

  // Clicking a heatmap cell jumps to single-day view for that date.
  function handleHeatmapPick(date) {
    setSelectedDay(date);
    setRange('day');
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  const headerSub = isEmpty
    ? 'Start a session on the Dashboard to see stats here.'
    : isDay
    ? formatPrettyDate(selectedDay)
    : `${rangeLabel} · ${startDate} → ${endDate}`;

  return (
    <Container fluid className="sf-page">
      <div className="d-flex justify-content-between align-items-start flex-wrap gap-3 mb-4">
        <div>
          <h1 className="mb-1">Statistics</h1>
          <p className="text-muted mb-0">{headerSub}</p>
        </div>
        <div className="d-flex align-items-center gap-2 flex-wrap">
          {isDay && (
            <Form.Control
              type="date"
              size="sm"
              value={selectedDay}
              max={todayStr}
              onChange={e => {
                const val = e.target.value;
                if (val && val <= todayStr) setSelectedDay(val);
              }}
              style={{ width: 160 }}
              aria-label="Pick a day"
            />
          )}
          <Form.Select
            size="sm"
            value={range}
            onChange={e => setRange(e.target.value)}
            style={{ width: 180 }}
            aria-label="Statistics time range"
            disabled={isEmpty}
          >
            {RANGE_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Form.Select>
        </div>
      </div>

      {isEmpty ? (
        <Card>
          <Card.Body className="text-center py-5">
            <div className="sf-section-label mb-2">No data yet</div>
            <div className="text-muted">
              Track a few sessions and your trends, focus, and goal progress will appear here.
            </div>
          </Card.Body>
        </Card>
      ) : (
        <>
          <Row className="g-3 mb-3">
            <Col md={3} sm={6}>
              <KpiCard
                label={isDay ? 'Focus' : 'Total Time'}
                value={`${totalHours}h`}
                sub={
                  isDay
                    ? last30AvgDailyMins > 0
                      ? `30-day avg ${formatDurationMinutes(last30AvgDailyMins)}/day`
                      : 'no recent baseline'
                    : avgPerActiveDay > 0
                    ? `${formatDurationMinutes(avgPerActiveDay)} per active day`
                    : 'no sessions'
                }
                delta={totalMinutesDelta}
              />
            </Col>
            <Col md={3} sm={6}>
              <KpiCard
                label="Sessions"
                value={totalSessions}
                sub={
                  totalSessions > 0
                    ? `median ${formatDurationMinutes(medianSessionMins)}`
                    : 'no sessions'
                }
                delta={totalSessionsDelta}
              />
            </Col>
            <Col md={3} sm={6}>
              <KpiCard
                label="Avg Focus"
                value={
                  totalSessions > 0 ? (
                    <>
                      {avgFocus.toFixed(1)}
                      <span className="text-muted fs-6 fw-normal ms-1">/ 5</span>
                    </>
                  ) : (
                    '—'
                  )
                }
                sub={
                  totalSessions > 0
                    ? `${highFocusCount} of ${totalSessions} rated ≥ 4`
                    : 'no sessions'
                }
                delta={avgFocusDelta}
              />
            </Col>
            <Col md={3} sm={6}>
              <KpiCard
                label="Avg Session"
                value={totalSessions > 0 ? formatDurationMinutes(avgSessionMinutes) : '—'}
                sub={
                  longestSession.minutes > 0
                    ? `longest ${formatDurationMinutes(longestSession.minutes)}`
                    : 'per session'
                }
                delta={avgSessionDelta}
              />
            </Col>
          </Row>

          <Row className="g-3 mb-4">
            {!isDay ? (
              <>
                <Col md={3} sm={6}>
                  <KpiCard
                    label="Consistency"
                    value={`${activeDaysPct}%`}
                    sub={`${activeDays} of ${days} days active`}
                    delta={consistencyDelta}
                  />
                </Col>
                <Col md={3} sm={6}>
                  <KpiCard
                    label="Deep Work Rate"
                    value={`${deepRate}%`}
                    sub={
                      totalSessions > 0
                        ? `${deepSessions} of ${totalSessions} sessions ≥ 60m`
                        : 'no sessions'
                    }
                    delta={deepRateDelta}
                  />
                </Col>
                <Col md={3} sm={6}>
                  <KpiCard
                    label="Current Streak"
                    value={`${streak} ${streak === 1 ? 'day' : 'days'}`}
                    sub={
                      longestStreak > 0
                        ? `personal best: ${longestStreak} ${longestStreak === 1 ? 'day' : 'days'}`
                        : 'study today to start'
                    }
                  />
                </Col>
                <Col md={3} sm={6}>
                  <KpiCard
                    label="Peak Weekday"
                    value={peak ? peak.label.slice(0, 3) : '—'}
                    sub={
                      peak
                        ? `${formatDurationMinutes(peak.minutes)} on ${peak.label}s`
                        : 'no data'
                    }
                  />
                </Col>
              </>
            ) : (
              <>
                <Col md={3} sm={6}>
                  <KpiCard
                    label="vs Your Average"
                    value={
                      last30AvgDailyMins > 0
                        ? `${Math.round(((totalMinutes - last30AvgDailyMins) / last30AvgDailyMins) * 100) >= 0 ? '+' : ''}${Math.round(((totalMinutes - last30AvgDailyMins) / last30AvgDailyMins) * 100)}%`
                        : '—'
                    }
                    sub={
                      last30AvgDailyMins > 0
                        ? `${formatDurationMinutes(last30AvgDailyMins)} typical day`
                        : 'not enough history'
                    }
                  />
                </Col>
                <Col md={3} sm={6}>
                  <KpiCard
                    label="Deep Sessions"
                    value={deepSessions}
                    sub={
                      totalSessions > 0
                        ? `${deepRate}% of today's sessions`
                        : 'no sessions'
                    }
                  />
                </Col>
                <Col md={3} sm={6}>
                  <KpiCard
                    label="Current Streak"
                    value={`${streak} ${streak === 1 ? 'day' : 'days'}`}
                    sub={
                      longestStreak > 0
                        ? `personal best: ${longestStreak} ${longestStreak === 1 ? 'day' : 'days'}`
                        : 'study today to start'
                    }
                  />
                </Col>
                <Col md={3} sm={6}>
                  <KpiCard
                    label="Subjects Touched"
                    value={breakdown.filter(b => b.count > 0).length}
                    sub={
                      breakdown.filter(b => b.count > 0).length > 0
                        ? `of ${subjects.length} total`
                        : 'none on this day'
                    }
                  />
                </Col>
              </>
            )}
          </Row>

          {/* Distribution row */}
          <Row className="g-3 mb-4">
            <Col lg={5}>
              <Card className="h-100">
                <Card.Header>Time Distribution</Card.Header>
                <Card.Body className="d-flex flex-column align-items-center justify-content-center">
                  <DonutChart
                    items={donutItems}
                    totalLabel="Total Hours"
                    totalValue={`${totalHours}h`}
                  />
                  <div className="sf-donut-legend mt-3">
                    {breakdown.length === 0 && (
                      <div className="text-muted small">No subjects yet.</div>
                    )}
                    {breakdown.map(b => {
                      const pct =
                        totalMinutes > 0 ? Math.round((b.minutes / totalMinutes) * 100) : 0;
                      return (
                        <div key={b.id} className="sf-donut-legend-item">
                          <span
                            className="sf-donut-legend-dot"
                            style={{ background: b.color }}
                          />
                          <span className="sf-donut-legend-name">{b.name}</span>
                          <span className="sf-donut-legend-pct">{pct}%</span>
                        </div>
                      );
                    })}
                  </div>
                </Card.Body>
              </Card>
            </Col>

            <Col lg={7}>
              <Card className="h-100">
                <Card.Header>Subject Breakdown</Card.Header>
                <Card.Body>
                  {breakdown.length === 0 && (
                    <div className="text-muted text-center py-3">No subjects yet.</div>
                  )}
                  {breakdown.length > 0 && totalMinutes === 0 && (
                    <div className="text-muted text-center py-3">
                      No time logged in this range.
                    </div>
                  )}
                  {breakdown.map(b => {
                    const pct =
                      totalMinutes > 0 ? Math.round((b.minutes / totalMinutes) * 100) : 0;
                    return (
                      <div key={b.id} className="mb-3">
                        <div className="d-flex justify-content-between align-items-center mb-1">
                          <div className="d-flex align-items-center gap-2">
                            <span
                              style={{
                                width: 10,
                                height: 10,
                                borderRadius: '50%',
                                background: b.color,
                                display: 'inline-block',
                              }}
                            />
                            <span style={{ fontWeight: 600 }}>{b.name}</span>
                            <span className="text-muted small">
                              · {b.count} {b.count === 1 ? 'session' : 'sessions'} · focus{' '}
                              {b.avgFocus}
                            </span>
                          </div>
                          <span className="fw-semibold small">
                            {formatHours(b.minutes)}h{' '}
                            <span className="text-muted">({pct}%)</span>
                          </span>
                        </div>
                        <div className="progress" style={{ height: 8 }}>
                          <div
                            className="progress-bar"
                            style={{ width: `${pct}%`, background: b.color }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </Card.Body>
              </Card>
            </Col>
          </Row>

          {/* Combined activity card: timeline vs day-of-week toggle. Both
              views are driven by rangedSessions so range filtering "just
              works" for both. Single-day mode falls back to a session list. */}
          <Card className="mb-4">
            <Card.Header className="d-flex justify-content-between align-items-center flex-wrap gap-2">
              <div className="d-flex align-items-center gap-3 flex-wrap">
                <span>{isDay ? 'Sessions on this day' : 'Activity'}</span>
                {!isDay && (
                  <ButtonGroup size="sm" aria-label="Activity view">
                    <Button
                      variant={
                        activityView === 'timeline' ? 'primary' : 'outline-secondary'
                      }
                      onClick={() => setActivityView('timeline')}
                    >
                      Timeline
                    </Button>
                    <Button
                      variant={activityView === 'dow' ? 'primary' : 'outline-secondary'}
                      onClick={() => setActivityView('dow')}
                    >
                      By Day of Week
                    </Button>
                  </ButtonGroup>
                )}
              </div>
              <span className="small text-muted">
                {isDay
                  ? formatPrettyDate(selectedDay)
                  : activityView === 'timeline' && bestDay.minutes > 0
                  ? `Peak: ${formatShortDate(bestDay.date)} (${formatDurationMinutes(bestDay.minutes)})`
                  : activityView === 'dow' && peak
                  ? `Strongest: ${peak.label}`
                  : rangeLabel}
              </span>
            </Card.Header>
            <Card.Body>
              {isDay ? (
                <DaySessionList sessions={rangedSessions} subjects={subjects} />
              ) : rangeEmpty ? (
                <div className="text-muted text-center py-4">No sessions in this range.</div>
              ) : activityView === 'timeline' ? (
                <DailyActivityChart
                  sessions={rangedSessions}
                  startDate={startDate}
                  days={days}
                />
              ) : (
                <DayOfWeekChart sessions={rangedSessions} />
              )}
            </Card.Body>
          </Card>

          {/* Focus quality, full width now that day-of-week lives in the
              combined activity card. */}
          <Row className="g-3 mb-4">
            <Col lg={12}>
              <Card className="h-100">
                <Card.Header>Focus Quality</Card.Header>
                <Card.Body>
                  {focusBySubject.length === 0 ? (
                    <div className="text-muted text-center py-4">
                      No rated sessions in this range.
                    </div>
                  ) : (
                    focusBySubject.map(b => {
                      const focusPct = Math.round((Number(b.avgFocus) / 5) * 100);
                      return (
                        <div key={b.id} className="mb-3">
                          <div className="d-flex justify-content-between align-items-center mb-1">
                            <div className="d-flex align-items-center gap-2">
                              <span
                                style={{
                                  width: 10,
                                  height: 10,
                                  borderRadius: '50%',
                                  background: b.color,
                                  display: 'inline-block',
                                }}
                              />
                              <span style={{ fontWeight: 600 }}>{b.name}</span>
                              <span className="text-muted small">
                                · {b.count} {b.count === 1 ? 'session' : 'sessions'}
                              </span>
                            </div>
                            <span className="fw-semibold small">
                              {b.avgFocus} <span className="text-muted">/ 5</span>
                            </span>
                          </div>
                          <div className="progress" style={{ height: 8 }}>
                            <div
                              className="progress-bar"
                              style={{
                                width: `${focusPct}%`,
                                background: b.color,
                              }}
                            />
                          </div>
                        </div>
                      );
                    })
                  )}
                </Card.Body>
              </Card>
            </Col>
          </Row>

          {/* Always-on calendar heatmap. Independent of the range filter so it
              gives a long-horizon view; click any cell to jump to that day. */}
          <Card>
            <Card.Header className="d-flex justify-content-between align-items-center">
              <span>Activity Heatmap</span>
              <span className="small text-muted">Last 52 weeks · click a day to inspect</span>
            </Card.Header>
            <Card.Body>
              <CalendarHeatmap
                sessions={sessions}
                todayStr={todayStr}
                onPickDay={handleHeatmapPick}
              />
            </Card.Body>
          </Card>
        </>
      )}
    </Container>
  );
}
