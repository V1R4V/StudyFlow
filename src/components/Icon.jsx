const emojis = {
  clock: '⏱️',
  flame: '🔥',
  calendar: '📅',
  target: '🎯',
  seedling: '🌱',
  trash: '🗑️',
  edit: '✏️',
  download: '📥',
  upload: '📤',
  arrowRight: '➡️',
  check: '✅',
  play: '▶️',
  pause: '⏸️',
};

export default function Icon({ name, size = 18, className = '' }) {
  return (
    <span className={`sf-icon sf-emoji ${className}`} aria-hidden="true"
      style={{ fontSize: size, width: size, height: size }}>
      {emojis[name]}
    </span>
  );
}
