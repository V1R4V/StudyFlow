import { useState } from 'react';
import { Card, Button } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';
import ReminderRow from './ReminderRow';
import ReminderComposer from './ReminderComposer';
import { IconBell } from './ReminderIcons';
import { useReminders } from '../context/RemindersContext';
import { useStudyData } from '../context/StudyDataContext';
import { remindersForDate, subjectForReminder, dayLabel } from '../utils/reminders';
import { localDateString } from '../utils/sessions';

const MAX_ROWS = 6;

export default function RemindersCard({ selectedDate }) {
  const { reminders, now, addReminder, toggleDone, notify } = useReminders();
  const [composerOpen, setComposerOpen] = useState(false);
  const { subjects } = useStudyData();
  const navigate = useNavigate();
  const today = localDateString(now);
  const isToday = selectedDate === today;
  const { overdue, due } = remindersForDate(reminders, selectedDate, now);
  const rows = [...overdue.map(r => ({ r, showDate: true })), ...due.map(r => ({ r, showDate: false }))];
  const hidden = Math.max(0, rows.length - MAX_ROWS);

  const label = dayLabel(selectedDate, today);
  const dayText = isToday ? 'today' : label === 'Yesterday' ? 'yesterday' : `on ${label}`;
  const summary = rows.length === 0
    ? `Nothing due ${dayText}`
    : [overdue.length > 0 && `${overdue.length} overdue`, `${due.length} due ${dayText}`].filter(Boolean).join(' · ');

  return (
    <Card className="h-100 sf-card-panel sf-rem-dash-card">
      <Card.Body className="sf-panel-body">
        <div className="d-flex justify-content-between align-items-start gap-2 mb-1">
          <h2 className="h5 mb-0">{isToday ? "Today's Reminders" : 'Reminders'}</h2>
          <Button as={Link} to="/app/reminders" variant="link" size="sm" className="p-0 text-nowrap">View all</Button>
        </div>
        <small className="text-muted">{summary}</small>

        {isToday && (
          <div className="mt-3">
            <ReminderComposer
              compact
              open={composerOpen}
              onOpenChange={setComposerOpen}
              subjects={subjects}
              defaults={{ dueDate: today }}
              onAdd={async fields => {
                const key = await addReminder(fields);
                if (key) {
                  notify({
                    message: `Added to ${fields.dueDate ? dayLabel(fields.dueDate, today) : 'Anytime'}`,
                    title: fields.title, actionLabel: 'Open',
                    action: () => navigate(`/app/reminders?r=${encodeURIComponent(key)}`),
                  });
                }
              }}
            />
          </div>
        )}

        <div className="flex-grow-1 mt-2">
          {rows.length === 0 ? (
            <div className="sf-rem-empty sf-rem-empty-compact">
              <span className="sf-rem-empty-icon"><IconBell size={20} /></span>
              <p className="small text-muted mb-0">{isToday ? 'Clear runway. Add one above when something comes up.' : 'No reminders on this day.'}</p>
            </div>
          ) : rows.slice(0, MAX_ROWS).map(({ r, showDate }) => (
            <ReminderRow
              key={r.key}
              reminder={r}
              subject={subjectForReminder(subjects, r)}
              now={now}
              today={today}
              showDate={showDate}
              compact
              onToggle={toggleDone}
              onSelect={key => navigate(`/app/reminders?r=${encodeURIComponent(key)}`)}
            />
          ))}
          {hidden > 0 && (
            <Link to="/app/reminders" className="small d-inline-block mt-2">+{hidden} more</Link>
          )}
        </div>
      </Card.Body>
    </Card>
  );
}
