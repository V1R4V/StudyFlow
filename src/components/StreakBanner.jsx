export default function StreakBanner(props) {
  if (props.streak <= 0) {
    return (
      <p
        style={{
          color: 'var(--muted-strong)',
          fontSize: '0.9rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
        }}
        className="mb-0"
      >
        <span role="img" aria-label="sleeping">😴</span>
        <span>Start a session today to begin your streak.</span>
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
        gap: '0.5rem',
      }}
      className="mb-0"
    >
      <span role="img" aria-label="streak on fire" style={{ fontSize: '1.1rem' }}>🔥</span>
      <strong style={{ color: 'var(--text-dark)' }}>{props.streak}-day streak</strong>
      <span>active. Don't break it.</span>
    </p>
  );
}
