import { useState } from 'react';
import { IconPlus } from './ReminderIcons';

export default function ReminderQuickAdd({ onAdd, placeholder = 'Add a reminder', hint }) {
  const [title, setTitle] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    setTitle('');
    await onAdd(trimmed);
  }

  return (
    <form className="sf-rem-quickadd" onSubmit={handleSubmit}>
      <span className="sf-rem-quickadd-icon" aria-hidden="true"><IconPlus size={16} /></span>
      <input
        type="text"
        value={title}
        onChange={event => setTitle(event.target.value)}
        placeholder={placeholder}
        maxLength={200}
        aria-label={placeholder}
      />
      {hint && <span className="sf-rem-quickadd-hint">{hint}</span>}
    </form>
  );
}
