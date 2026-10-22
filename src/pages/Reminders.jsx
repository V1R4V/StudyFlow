import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Container, Button, Offcanvas, Spinner, Dropdown } from 'react-bootstrap';
import { useSearchParams } from 'react-router-dom';
import ReminderRow from '../components/ReminderRow';
import ReminderComposer from '../components/ReminderComposer';
import ReminderEditor from '../components/ReminderEditor';
import { IconBell, IconSearch, IconPlus, IconFilter, IconClose, IconCheck, IconArrowRight } from '../components/ReminderIcons';
import { useReminders } from '../context/RemindersContext';
import { useStudyData } from '../context/StudyDataContext';
import { groupForView, matchesSearch, subjectForReminder, subjectRefId, dayLabel, PRIORITY_OPTIONS } from '../utils/reminders';
import { localDateString } from '../utils/sessions';

const VIEWS = [
  { key: 'today', label: 'Today' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'anytime', label: 'Anytime' },
  { key: 'completed', label: 'Completed' },
];

const EMPTY = {
  today: ['Nothing due today', 'Enjoy the clear runway, or plan ahead in Scheduled.'],
  scheduled: ['Nothing scheduled', 'Give a reminder a date and it lands here, grouped by day.'],
  anytime: ['No undated reminders', 'Notes and someday ideas live here: anything without a date.'],
  completed: ['Nothing completed yet', 'Checked-off reminders collect here.'],
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

const notificationState = () => (typeof Notification === 'undefined' ? 'unsupported' : Notification.permission);

const isTyping = target => target?.closest?.('input, textarea, select, [contenteditable="true"]');

// Linear-style filtering: one Filter button; each active filter becomes a
// removable pill instead of a permanent wall of chips.
function FilterMenu({ subjects, reminders, filters, onChange }) {
  const count = (filters.subjectId ? 1 : 0) + (filters.priority ? 1 : 0);
  const openFor = predicate => reminders.filter(predicate).length;
  return (
    <Dropdown align="end" autoClose="outside">
      <Dropdown.Toggle as="button" type="button" className={`sf-rem-filter-btn${count ? ' is-active' : ''}`}>
        <IconFilter size={15} /> Filter{count > 0 && <span className="sf-rem-count">{count}</span>}
      </Dropdown.Toggle>
      <Dropdown.Menu className="sf-rem-menu sf-rem-filter-menu">
        <div className="sf-rem-menu-heading">Subject</div>
        <div className="sf-rem-menu-scroll">
          {subjects.map(subject => {
            const id = subjectRefId(subject);
            const selected = filters.subjectId === id;
            return (
              <button key={id} type="button" role="menuitemcheckbox" aria-checked={selected}
                className={`sf-rem-option${selected ? ' is-selected' : ''}`}
                onClick={() => onChange({ subjectId: selected ? null : id })}>
                <span className="sf-rem-option-label"><span className="sf-rem-dot" style={{ background: subject.color }} aria-hidden="true" /> {subject.name}</span>
                <span className="sf-rem-option-hint">{openFor(r => String(r.subjectId) === id) || ''}</span>
                <span className="sf-rem-option-check" aria-hidden="true">{selected && <IconCheck size={12} />}</span>
              </button>
            );
          })}
          {subjects.length === 0 && <div className="sf-rem-menu-empty">No subjects yet</div>}
        </div>
        <div className="sf-rem-menu-divider" />
        <div className="sf-rem-menu-heading">Priority</div>
        {PRIORITY_OPTIONS.filter(o => o.value !== 'none').map(option => {
          const selected = filters.priority === option.value;
          return (
            <button key={option.value} type="button" role="menuitemcheckbox" aria-checked={selected}
              className={`sf-rem-option${selected ? ' is-selected' : ''}`}
              onClick={() => onChange({ priority: selected ? null : option.value })}>
              <span className="sf-rem-option-label">
                <span className={`sf-rem-prio sf-rem-prio-${option.value} sf-rem-option-mark`}>{option.mark}</span>{option.label}
              </span>
              <span className="sf-rem-option-hint">{openFor(r => r.priority === option.value) || ''}</span>
              <span className="sf-rem-option-check" aria-hidden="true">{selected && <IconCheck size={12} />}</span>
            </button>
          );
        })}
        {count > 0 && (
          <>
            <div className="sf-rem-menu-divider" />
            <button type="button" className="sf-rem-option" onClick={() => onChange({ subjectId: null, priority: null })}>
              <span className="sf-rem-option-label">Clear filters</span>
            </button>
          </>
        )}
      </Dropdown.Menu>
    </Dropdown>
  );
}

function FilterPill({ label, children, onRemove }) {
  return (
    <span className="sf-rem-filter-pill">
      <span className="sf-rem-filter-pill-key">{label}</span>
      <span className="sf-rem-filter-pill-value">{children}</span>
      <button type="button" onClick={onRemove} aria-label={`Remove ${label.toLowerCase()} filter`}><IconClose size={11} /></button>
    </span>
  );
}

export default function Reminders() {
  const {
    reminders, completed, loading, now, addReminder, updateReminder, toggleDone, removeReminder,
    loadCompleted, completedLoaded, completedLoading, hasMoreCompleted, notify,
  } = useReminders();
  const { subjects } = useStudyData();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ subjectId: null, priority: null });
  const [composerOpen, setComposerOpen] = useState(false);
  const [seed, setSeed] = useState(null);
  const [permission, setPermission] = useState(notificationState);
  const searchRef = useRef(null);
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

  // N: new reminder · /: search · Esc: close details.
  useEffect(() => {
    function onKey(event) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === 'Escape' && selectedKey && !isTyping(event.target)) {
        setParam('r', null);
        return;
      }
      if (isTyping(event.target) || document.querySelector('.modal.show, .offcanvas.show')) return;
      if (event.key === 'n' || event.key === 'N') {
        event.preventDefault();
        if (view === 'completed') setParam('view', null);
        setComposerOpen(true);
      } else if (event.key === '/') {
        event.preventDefault();
        searchRef.current?.focus();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [selectedKey, setParam, view]);

  const filtered = useMemo(() => {
    const source = view === 'completed' ? completed : reminders;
    return source.filter(r => matchesSearch(r, search)
      && (!filters.subjectId || String(r.subjectId) === filters.subjectId)
      && (!filters.priority || r.priority === filters.priority));
  }, [view, completed, reminders, search, filters]);

  const groups = useMemo(() => groupForView(view, filtered, today), [view, filtered, today]);

  const overdue = reminders.filter(r => r.dueDate && r.dueDate < today);
  const dueToday = reminders.filter(r => r.dueDate === today).length;
  const counts = {
    today: overdue.length + dueToday,
    scheduled: reminders.filter(r => r.dueDate).length,
    anytime: reminders.filter(r => !r.dueDate).length,
  };
  const summary = reminders.length === 0
    ? 'All clear. Capture anything you need to remember.'
    : [
      overdue.length > 0 && `${overdue.length} overdue`,
      dueToday > 0 ? `${dueToday} due today` : 'Nothing else due today',
      `${reminders.length} open`,
    ].filter(Boolean).join(' · ');

  const selected = reminders.find(r => r.key === selectedKey) || completed.find(r => r.key === selectedKey) || null;
  const onUpdateSelected = useCallback(updates => updateReminder(selectedKey, updates), [updateReminder, selectedKey]);
  const filterSubject = subjects.find(s => subjectRefId(s) === filters.subjectId);
  const filterPriority = PRIORITY_OPTIONS.find(o => o.value === filters.priority);

  async function handleAdd(fields) {
    const key = await addReminder(fields);
    if (!key) return;
    notify({
      message: `Added to ${fields.dueDate ? dayLabel(fields.dueDate, today) : 'Anytime'}`,
      title: fields.title,
      actionLabel: 'Open',
      action: () => setParam('r', key),
    });
  }

  async function handleReschedule(key, dueDate) {
    const current = reminders.find(r => r.key === key);
    if (!current) return;
    const previous = { dueDate: current.dueDate, dueTime: current.dueTime, repeat: current.repeat, snoozedUntil: current.snoozedUntil };
    await updateReminder(key, dueDate
      ? { dueDate, snoozedUntil: null }
      : { dueDate: null, dueTime: null, repeat: 'none', snoozedUntil: null });
    notify({
      message: `Moved to ${dueDate ? dayLabel(dueDate, today) : 'Anytime'}`,
      title: current.title,
      actionLabel: 'Undo',
      action: () => updateReminder(key, previous),
    });
  }

  async function moveOverdueToToday() {
    const moved = [...overdue];
    await Promise.all(moved.map(r => updateReminder(r.key, { dueDate: today, snoozedUntil: null })));
    notify({
      message: `Moved ${moved.length} to today`,
      title: moved.map(r => r.title).join(', '),
      actionLabel: 'Undo',
      action: () => Promise.all(moved.map(r => updateReminder(r.key, { dueDate: r.dueDate, snoozedUntil: r.snoozedUntil }))),
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

  function startFromExample(text) {
    setSeed(prev => ({ id: (prev?.id ?? 0) + 1, text }));
    setComposerOpen(true);
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

  const filtering = Boolean(search || filters.subjectId || filters.priority);
  const [emptyTitle, emptyBody] = filtering ? ['No matches', 'Try a different search or filter.'] : EMPTY[view];
  const exampleSubject = subjects[0] ? ` #${subjects[0].name.replace(/\s+/g, '')}` : '';
  const examples = [
    `Quiz review tomorrow 3pm${exampleSubject} !!`,
    'Submit internship form fri 9am',
    'Call home every sunday 7pm',
  ];

  return (
    <Container fluid className="sf-page sf-reminders-page">
      <header className="sf-rem-header">
        <div className="min-w-0">
          <h1 className="mb-1">Reminders</h1>
          <p className="text-muted mb-0">{summary}</p>
        </div>
        <div className="sf-rem-header-actions">
          {permission === 'default' && (
            <button type="button" className="sf-rem-ghost-btn" onClick={requestAlerts} title="Get a desktop notification when a reminder is due">
              <IconBell size={15} /> Turn on alerts
            </button>
          )}
          <label className="sf-rem-search">
            <IconSearch size={15} />
            <input ref={searchRef} type="search" value={search} onChange={event => setSearch(event.target.value)}
              placeholder="Search" aria-label="Search reminders"
              onKeyDown={event => { if (event.key === 'Escape') { setSearch(''); event.currentTarget.blur(); } }} />
            {!search && <kbd className="sf-rem-kbd">/</kbd>}
          </label>
          <Button className="sf-action-button" onClick={() => { if (view === 'completed') setParam('view', null); setComposerOpen(true); }}>
            <IconPlus size={15} /> New reminder
          </Button>
        </div>
      </header>

      <div className="sf-rem-toolbar">
        <div className="btn-group sf-rem-views" role="tablist" aria-label="Reminder views">
          {VIEWS.map(v => (
            <button key={v.key} type="button" role="tab" aria-selected={view === v.key}
              className={`btn btn-sm sf-rem-view ${view === v.key ? 'btn-primary' : 'btn-outline-primary'}`}
              onClick={() => setParam('view', v.key === 'today' ? null : v.key)}>
              {v.label}
              {counts[v.key] > 0 && (
                <span className={`sf-rem-count${v.key === 'today' && overdue.length > 0 ? ' is-alert' : ''}`}>{counts[v.key]}</span>
              )}
            </button>
          ))}
        </div>
        <div className="sf-rem-filterbar">
          {filterSubject && (
            <FilterPill label="Subject" onRemove={() => setFilters(f => ({ ...f, subjectId: null }))}>
              <span className="sf-rem-dot" style={{ background: filterSubject.color }} aria-hidden="true" /> {filterSubject.name}
            </FilterPill>
          )}
          {filterPriority && (
            <FilterPill label="Priority" onRemove={() => setFilters(f => ({ ...f, priority: null }))}>
              <span className={`sf-rem-prio sf-rem-prio-${filterPriority.value}`}>{filterPriority.mark}</span> {filterPriority.label}
            </FilterPill>
          )}
          <FilterMenu subjects={subjects} reminders={reminders} filters={filters} onChange={changes => setFilters(f => ({ ...f, ...changes }))} />
        </div>
      </div>

      <div className={`sf-rem-layout${docked && selected ? ' has-panel' : ''}`}>
        <section className="sf-rem-list" aria-label={`${VIEWS.find(v => v.key === view).label} reminders`}>
          {view !== 'completed' && (
            <ReminderComposer
              open={composerOpen}
              onOpenChange={setComposerOpen}
              onAdd={handleAdd}
              subjects={subjects}
              defaults={{ dueDate: view === 'anytime' ? null : today, subjectId: filters.subjectId, priority: filters.priority || 'none' }}
              shortcut="N"
              seed={seed}
            />
          )}

          {loading ? (
            <div className="text-center py-5"><Spinner animation="border" size="sm" role="status"><span className="visually-hidden">Loading…</span></Spinner></div>
          ) : groups.length === 0 ? (
            <div className="sf-rem-empty">
              <span className="sf-rem-empty-icon"><IconBell size={22} /></span>
              <p className="sf-rem-empty-title">{emptyTitle}</p>
              <p className="sf-rem-empty-body">{emptyBody}</p>
              {reminders.length === 0 && !filtering && view !== 'completed' && (
                <div className="sf-rem-examples">
                  <span className="sf-rem-examples-label">Type naturally — try one:</span>
                  {examples.map(example => (
                    <button key={example} type="button" className="sf-rem-example" onClick={() => startFromExample(example)}>
                      {example} <IconArrowRight size={13} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : groups.map(group => (
            <section key={group.key} className="sf-rem-group" aria-label={group.label}>
              <h2 className={`sf-rem-group-label${group.key === 'overdue' ? ' is-overdue' : ''}`}>
                <span>{group.label}</span>
                <span className="sf-rem-group-count">{group.items.length}</span>
                {group.key === 'overdue' && (
                  <button type="button" className="sf-rem-group-action" onClick={moveOverdueToToday}>Move all to today</button>
                )}
              </h2>
              {group.items.map(reminder => (
                <ReminderRow
                  key={reminder.key}
                  reminder={reminder}
                  subject={subjectForReminder(subjects, reminder)}
                  now={now}
                  today={today}
                  showDate={group.key === 'overdue' || view === 'completed'}
                  selected={reminder.key === selectedKey}
                  onToggle={toggleDone}
                  onSelect={key => setParam('r', key === selectedKey ? null : key)}
                  onReschedule={handleReschedule}
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
        </section>

        {docked && selected && (
          <aside className="sf-rem-panel" aria-label="Reminder details">{editor}</aside>
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
