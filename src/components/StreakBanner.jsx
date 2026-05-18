const IconFlame = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ color: 'var(--warning)', verticalAlign: 'text-bottom' }}
    aria-hidden="true"
  >
    <path d="M12 2C12 2 13.5 5 12 7.5C14.5 6 16 8 14.5 10.5C16 9.5 17 11 16 13C16 16 13.5 18 10 18C6.5 18 4 16 4 13C4 10.5 5.5 9 7 8.5C7 10.5 8 11.5 9 12C8.5 10 9 7 12 2Z" />
  </svg>
);

export default function StreakBanner(props) {
  if (props.streak <= 0) {
    return (
      <p style={{ color: 'var(--muted-strong)', fontSize: '0.9rem' }} className="mb-0">
        Start a session today to begin your streak.
      </p>
    );
  }

  return (
    <p
      style={{
        color: 'var(--muted-strong)',
        fontSize: '0.9rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.35rem',
      }}
      className="mb-0"
    >
      <IconFlame />
      <strong style={{ color: 'var(--text-dark)' }}>{props.streak}-day streak</strong>
      <span>active. Don't break it.</span>
    </p>
  );
}
