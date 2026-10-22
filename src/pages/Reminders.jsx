import { useCallback, useEffect, useMemo, useState } from 'react';
import { Container, Card, Button, Offcanvas, Spinner } from 'react-bootstrap';
import { useSearchParams } from 'react-router-dom';
import ReminderRow from '../components/ReminderRow';
import ReminderQuickAdd from '../components/ReminderQuickAdd';
import ReminderEditor from '../components/ReminderEditor';
import { IconBell, IconSearch } from '../components/ReminderIcons';
import { useReminders } from '../context/RemindersContext';
import { useStudyData } from '../context/StudyDataContext';
import { groupForView, matchesSearch, subjectForReminder, subjectRefId } from '../utils/reminders';
import { localDateString } from '../utils/sessions';

const VIEWS = [
  { key: 'today', label: 'Today' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'anytime', label: 'Anytime' },
  { key: 'completed', label: 'Completed' },
];

const EMPTY = {
  today: ['Nothing due today.', 'Add something above, or look ahead in Scheduled.'],
  scheduled: ['Nothing scheduled.', 'Give a reminder a date and it shows up here, grouped by day.'],
  anytime: ['No undated reminders.', 'Notes and someday tasks live here: anything without a date.'],
  completed: ['Nothing completed yet.', 'Checked-off reminders collect here.'],
};

function useMediaQuery(queryString) {
  const [matches, setMatches] = useState(() => window.matchMedia(queryString).matches);
  useEffect(() => {
    const media = window.matchMedia(queryString);
    const onChange = () => setMatches(media.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [queryString]);
  return matches;
}

function notificationState() {
  return typeof Notification === 'undefined' ? 'unsupported' : Notification.permission;
}

export default function Reminders() {
  const {
    reminders, completed, loading, now, addReminder, updateReminder, toggleDone, removeReminder,
    loadCompleted, completedLoaded, completedLoading, hasMoreCompleted,
  } = useReminders();
  const { subjects } = useStudyData();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [subjectFilter, setSubjectFilter] = useState(null);
  const [permission, setPermission] = useState(notificationState);
  const docked = useMediaQuery('(min-width: 1200px)');
  const phone = useMediaQuery('(max-width: 767px)');

  const view = VIEWS.some(v => v.key === params.get('view')) ? params.get('view') : 'today';
  const selectedKey = params.get('r');
  const today = localDateString(now);

  const setParam = useCallback((key, value) => {
    setParams(prev => {
      const next = new URLSearchParams(prev);
      if (value) next.set(key, value);
      else next.delete(key);
      return next;
    }, { replace: true });
  }, [setParams]);

  useEffect(() => {
    if (view === 'completed' && !completedLoaded) loadCompleted({ reset: true });
  }, [view, completedLoaded, loadCompleted]);

  useEffect(() => {
    function onKey(event) {
      if (event.key !== 'Escape' || !selectedKey) return;
      document.activeElement?.blur?.();
      setParam('r', null);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [selectedKey, setParam]);

  const filtered = useMemo(() => {
    const source = view === 'completed' ? completed : reminders;
    return source.filter(r => matchesSearch(r, search) && (!subjectFilter || String(r.subjectId) === subjectFilter));
  }, [view, completed, reminders, search, subjectFilter]);

  const groups = useMemo(() => groupForView(view, filtered, today), [view, filtered, today]);

  const counts = useMemo(() => ({
    today: groupForView('today', reminders, today).reduce((sum, g) => sum + g.items.length, 0),
    scheduled: reminders.filter(r => r.dueDate).length,
    anytime: reminders.filter(r => !r.dueDate).length,
  }), [reminders, today]);
  const overdueCount = reminders.filter(r => r.dueDate && r.dueDate < today).length;

  const selected = reminders.find(r => r.key === selectedKey) || completed.find(r => r.key === selectedKey) || null;
  const onUpdateSelected = useCallback(updates => updateReminder(selectedKey, updates), [updateReminder, selectedKey]);

  async function handleQuickAdd(title) {
    await addReminder({
      title,
      dueDate: view === 'today' || view === 'scheduled' ? today : null,
      subjectId: subjectFilter,
    });
  }

  async function handleDelete(key) {
    setParam('r', null);
    await removeReminder(key);
  }

  async function requestAlerts() {
    if (typeof Notification === 'undefined') return;
    setPermission(await Notification.requestPermission());
  }

  const editor = selected && (
    <ReminderEditor
      key={selected.key}
      reminder={selected}
      subjects={subjects}
      onUpdate={onUpdateSelected}
      onToggle={toggleDone}
      onDelete={handleDelete}
      onClose={() => setParam('r', null)}
    />
  );

  const emptyText = search || subjectFilter ? ['No matches.', 'Try a different search or subject.'] : EMPTY[view];

  return (
    <Container fluid className="sf-page sf-reminders-page">
      <div className="sf-page-header d-flex justify-content-between align-items-start flex-wrap gap-3 mb-4 pb-3">
        <div>
          <h1 className="mb-1">Reminders</h1>
          <p className="text-muted mb-0">
            {overdueCount > 0 ? `${overdueCount} overdue · ` : ''}{counts.today - overdueCount} due today · {reminders.length} open
          </p>
        </div>
        <div className="d-flex align-items-center gap-2 flex-wrap">
          {permission === 'default' && (
            <Button variant="outline-primary" size="sm" className="sf-action-button" onClick={requestAlerts}>
              <IconBell size={15} /> Enable desktop alerts
            </Button>
          )}
          <label className="sf-rem-search">
            <IconSearch size={15} />
            <input type="search" value={search} onChange={event => setSearch(event.target.value)}
              placeholder="Search reminders" aria-label="Search reminders" />
          </label>
        </div>
      </div>

      <div className="sf-rem-toolbar mb-3">
        <div className="btn-group sf-rem-views" role="tablist" aria-label="Reminder views">
          {VIEWS.map(v => (
            <button key={v.key} type="button" role="tab" aria-selected={view === v.key}
              className={`btn btn-sm sf-rem-view ${view === v.key ? 'btn-primary' : 'btn-outline-primary'}`}
              onClick={() => setParam('view', v.key === 'today' ? null : v.key)}>
              {v.label}
              {counts[v.key] > 0 && (
                <span className={`sf-rem-count${v.key === 'today' && overdueCount > 0 ? ' is-alert' : ''}`}>{counts[v.key]}</span>
              )}
            </button>
          ))}
        </div>
        {subjects.length > 0 && (
          <div className="sf-rem-subjects" aria-label="Filter by subject">
            <button type="button" className={`sf-rem-chip${!subjectFilter ? ' is-active' : ''}`}
              aria-pressed={!subjectFilter} onClick={() => setSubjectFilter(null)}>All</button>
            {subjects.map(subject => {
              const id = subjectRefId(subject);
              return (
                <button key={id} type="button" className={`sf-rem-chip${subjectFilter === id ? ' is-active' : ''}`}
                  aria-pressed={subjectFilter === id} onClick={() => setSubjectFilter(subjectFilter === id ? null : id)}>
                  <span className="sf-rem-dot" style={{ background: subject.color }} aria-hidden="true" />
                  {subject.name}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className={`sf-rem-layout${docked ? ' is-docked' : ''}`}>
        <Card className="sf-card-panel sf-rem-list-card">
          <Card.Body>
            {view !== 'completed' && (
              <ReminderQuickAdd
                onAdd={handleQuickAdd}
                placeholder={view === 'anytime' ? 'Add a note or someday reminder' : 'Add a reminder for today'}
                hint="Enter"
              />
            )}

            {loading ? (
              <div className="text-center py-5"><Spinner animation="border" size="sm" role="status"><span className="visually-hidden">Loading…</span></Spinner></div>
            ) : groups.length === 0 ? (
              <div className="sf-rem-empty">
                <span className="sf-rem-empty-icon"><IconBell size={22} /></span>
                <p className="fw-semibold mb-1">{emptyText[0]}</p>
                <p className="small text-muted mb-0">{emptyText[1]}</p>
              </div>
            ) : groups.map(group => (
              <section key={group.key} className="sf-rem-group" aria-label={group.label}>
                <h2 className={`sf-rem-group-label${group.key === 'overdue' ? ' is-overdue' : ''}`}>
                  {group.label}<span>{group.items.length}</span>
                </h2>
                {group.items.map(reminder => (
                  <ReminderRow
                    key={reminder.key}
                    reminder={reminder}
                    subject={subjectForReminder(subjects, reminder)}
                    now={now}
                    today={today}
                    showDate={group.key === 'overdue'}
                    selected={reminder.key === selectedKey}
                    onToggle={toggleDone}
                    onSelect={key => setParam('r', key === selectedKey ? null : key)}
                  />
                ))}
              </section>
            ))}

            {view === 'completed' && hasMoreCompleted && (
              <div className="text-center mt-3">
                <Button variant="outline-secondary" size="sm" disabled={completedLoading} onClick={() => loadCompleted()}>
                  {completedLoading ? 'Loading…' : 'Load more'}
                </Button>
              </div>
            )}
          </Card.Body>
        </Card>

        {docked && (
          <Card className="sf-card-panel sf-rem-detail-card">
            <Card.Body>
              {editor || (
                <div className="sf-rem-empty sf-rem-detail-empty">
                  <span className="sf-rem-empty-icon"><IconBell size={22} /></span>
                  <p className="fw-semibold mb-1">Select a reminder</p>
                  <p className="small text-muted mb-0">Dates, repeat, checklist and notes open here.</p>
                </div>
              )}
            </Card.Body>
          </Card>
        )}
      </div>

      {!docked && (
        <Offcanvas show={Boolean(selected)} onHide={() => setParam('r', null)} placement={phone ? 'bottom' : 'end'}
          className={`sf-rem-offcanvas${phone ? ' is-sheet' : ''}`} aria-label="Reminder details">
          <Offcanvas.Body>{editor}</Offcanvas.Body>
        </Offcanvas>
      )}
    </Container>
  );
}
