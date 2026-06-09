import { Link } from 'react-router-dom';

// Hume-style "open full view" affordance shown in a card's top-right corner.
// It's a real navigation control: each card points at the page where the user
// can drill into that data (e.g. Weekly Trend -> Statistics).
const IconExpand = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M9.5 3H13v3.5" />
    <path d="M13 3l-5 5" />
    <path d="M6.5 13H3V9.5" />
    <path d="M3 13l5-5" />
  </svg>
);

export default function CardExpand({ to, label = 'Open full view' }) {
  return (
    <Link to={to} className="sf-card-expand" aria-label={label} title={label}>
      <IconExpand />
    </Link>
  );
}
