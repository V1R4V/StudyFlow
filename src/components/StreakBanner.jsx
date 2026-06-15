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
        <span role="img" aria-label="seedling">🌱</span>
        <span>One session today starts your streak.</span>
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
      <span>{props.streak === 1 ? 'going. Every streak starts here.' : 'strong. Keep it rolling.'}</span>
    </p>
  );
}
