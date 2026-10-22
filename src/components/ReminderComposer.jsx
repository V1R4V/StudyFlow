import { useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Button, Form } from 'react-bootstrap';
import ReminderPills from './ReminderPills';
import { parseQuickAdd, subjectSuggestions } from '../utils/reminderParse';
import { subjectRefId } from '../utils/reminders';
import { IconPlus, IconNote } from './ReminderIcons';

const KEEP_OPEN_KEY = 'studyflow-composer-keep-open';
const ZERO_WIDTH_SPACE = String.fromCharCode(0x200b);
const FIELD_KIND = { dueDate: 'date', dueTime: 'time', subjectId: 'subject', priority: 'priority', repeat: 'repeat' };

function readKeepOpen() {
  try { return localStorage.getItem(KEEP_OPEN_KEY) === '1'; } catch { return false; }
}

// "#que" right before the caret, if any.
function hashQuery(text, caret) {
  const match = /(?:^|\s)#([^\s#]*)$/.exec(text.slice(0, caret));
  return match ? { query: match[1], start: caret - match[1].length - 1 } : null;
}

// Renders the title with parsed phrases highlighted. It sits exactly under a
// transparent textarea, so the text you type appears marked up in place.
function Highlights({ text, tokens }) {
  const parts = [];
  let cursor = 0;
  tokens.forEach(t => {
    if (t.start > cursor) parts.push(text.slice(cursor, t.start));
    parts.push(<mark key={t.start} className={`sf-rem-token sf-rem-token-${t.kind}`}>{text.slice(t.start, t.end)}</mark>);
    cursor = t.end;
  });
  // Zero-width space keeps a trailing space measurable in the mirror.
  parts.push(`${text.slice(cursor)}${ZERO_WIDTH_SPACE}`);
  return <div className="sf-rem-nl-mirror" aria-hidden="true">{parts}</div>;
}

const emptyDraft = () => ({ text: '', note: '', manual: {}, skipKinds: [] });

// Collapsed: a quiet "Add reminder" row. Open: a natural-language title
// ("Quiz tomorrow 3pm #CS564 !!"), optional notes, and the property pills.
// `seed` ({ id, text }) pre-fills the title, e.g. from an example in the empty state.
export default function ReminderComposer({ open, onOpenChange, onAdd, subjects, defaults, compact = false, label = 'Add reminder', shortcut, seed }) {
  const titleId = useId();
  const textareaRef = useRef(null);
  const [draft, setDraft] = useState(emptyDraft);
  const [caret, setCaret] = useState(0);
  const [activeSuggestion, setActiveSuggestion] = useState(0);
  const [keepOpen, setKeepOpen] = useState(readKeepOpen);
  const [saving, setSaving] = useState(false);
  const [seedId, setSeedId] = useState(seed?.id);

  if (seed && seed.id !== seedId) {
    setSeedId(seed.id);
    setDraft({ ...emptyDraft(), text: seed.text });
    setCaret(seed.text.length);
  }

  const parsed = useMemo(
    () => parseQuickAdd(draft.text, { subjects, skipKinds: draft.skipKinds }),
    [draft.text, draft.skipKinds, subjects],
  );
  const value = {
    dueDate: null, dueTime: null, subjectId: null, priority: 'none', repeat: 'none',
    ...defaults, ...parsed.fields, ...draft.manual,
  };
  const hash = open ? hashQuery(draft.text, caret) : null;
  const suggestions = hash ? subjectSuggestions(subjects, hash.query) : [];

  // Grow the title with its content so the highlight layer never scrolls.
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [draft.text, open]);

  if (!open) {
    return (
      <button type="button" className={`sf-rem-add-row${compact ? ' is-compact' : ''}`} onClick={() => onOpenChange(true)}>
        <span className="sf-rem-add-icon" aria-hidden="true"><IconPlus size={14} /></span>
        <span>{label}</span>
        {shortcut && <kbd className="sf-rem-kbd">{shortcut}</kbd>}
      </button>
    );
  }

  const update = changes => setDraft(prev => ({ ...prev, ...changes }));

  function changeProps(changes) {
    setDraft(prev => {
      const skip = new Set(prev.skipKinds);
      Object.entries(changes).forEach(([field, next]) => {
        const kind = FIELD_KIND[field];
        const cleared = next === null || next === 'none';
        // Clearing a value that came from the text keeps those words as title.
        if (cleared && parsed.tokens.some(t => t.kind === kind)) skip.add(kind);
      });
      return { ...prev, manual: { ...prev.manual, ...changes }, skipKinds: [...skip] };
    });
  }

  function pickSubject(subject) {
    const text = `${draft.text.slice(0, hash.start)}${draft.text.slice(caret)}`.replace(/\s{2,}/g, ' ');
    setDraft(prev => ({ ...prev, text, manual: { ...prev.manual, subjectId: subjectRefId(subject) } }));
    setCaret(hash.start);
    setActiveSuggestion(0);
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(hash.start, hash.start);
    });
  }

  async function submit(event) {
    event?.preventDefault();
    if (!parsed.title || saving) return;
    setSaving(true);
    await onAdd({ ...value, title: parsed.title, note: draft.note.trim() });
    setSaving(false);
    setDraft(emptyDraft());
    setCaret(0);
    if (keepOpen) textareaRef.current?.focus();
    else onOpenChange(false);
  }

  function onTitleKeyDown(event) {
    if (suggestions.length > 0) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const step = event.key === 'ArrowDown' ? 1 : -1;
        setActiveSuggestion(i => (i + step + suggestions.length) % suggestions.length);
        return;
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault();
        pickSubject(suggestions[Math.min(activeSuggestion, suggestions.length - 1)]);
        return;
      }
    }
    if (event.key === 'Enter') submit(event);
  }

  function onFormKeyDown(event) {
    const inMenu = event.target.closest('.dropdown-menu') || event.target.getAttribute('aria-expanded') === 'true';
    if (event.key === 'Escape' && !inMenu) {
      event.stopPropagation();
      if (hash) setCaret(0);
      else onOpenChange(false);
    }
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) submit(event);
  }

  function toggleKeepOpen(next) {
    setKeepOpen(next);
    try { localStorage.setItem(KEEP_OPEN_KEY, next ? '1' : '0'); } catch { /* private mode */ }
  }

  const example = subjects[0] ? `#${subjects[0].name.replace(/\s+/g, '')}` : '!!';

  return (
    <form className={`sf-rem-composer${compact ? ' is-compact' : ''}`} onSubmit={submit} onKeyDown={onFormKeyDown}>
      <div className="sf-rem-nl">
        <Highlights text={draft.text} tokens={parsed.tokens} />
        <textarea
          id={titleId}
          ref={textareaRef}
          className="sf-rem-nl-input"
          rows={1}
          value={draft.text}
          maxLength={200}
          autoFocus
          spellCheck={false}
          placeholder={compact ? 'Remind me to…' : `Remind me to… try “Quiz tomorrow 3pm ${example} !!”`}
          aria-label="Reminder. Dates, times, #subject and ! priority are recognized as you type."
          aria-autocomplete="list"
          aria-expanded={suggestions.length > 0}
          onChange={event => { update({ text: event.target.value.replace(/\n/g, ' ') }); setCaret(event.target.selectionStart); setActiveSuggestion(0); }}
          onSelect={event => setCaret(event.target.selectionStart)}
          onKeyDown={onTitleKeyDown}
        />
        {suggestions.length > 0 && (
          <div className="sf-rem-suggest" role="listbox" aria-label="Subjects">
            {suggestions.map((s, i) => (
              <button key={subjectRefId(s)} type="button" role="option" aria-selected={i === activeSuggestion}
                className={`sf-rem-option${i === activeSuggestion ? ' is-active' : ''}`}
                onMouseDown={event => { event.preventDefault(); pickSubject(s); }}>
                <span className="sf-rem-option-label"><span className="sf-rem-dot" style={{ background: s.color }} aria-hidden="true" /> {s.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {!compact && (
        <label className="sf-rem-composer-note">
          <IconNote size={14} />
          <textarea value={draft.note} onChange={event => update({ note: event.target.value })}
            placeholder="Notes" rows={1} maxLength={5000} aria-label="Notes" />
        </label>
      )}

      <ReminderPills value={value} onChange={changeProps} subjects={subjects} parsedKinds={parsed.tokens.map(t => t.kind)} />

      <div className="sf-rem-composer-foot">
        {!compact && (
          <Form.Check type="switch" id={`${titleId}-keep`} className="sf-rem-keep" label="Keep open"
            checked={keepOpen} onChange={event => toggleKeepOpen(event.target.checked)} />
        )}
        <div className="d-flex gap-2 ms-auto">
          <Button variant="outline-secondary" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" variant="primary" size="sm" disabled={!parsed.title || saving}>Add reminder</Button>
        </div>
      </div>
    </form>
  );
}
