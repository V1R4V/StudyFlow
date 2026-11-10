import Icon from './Icon';

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
        <Icon name="seedling" />
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
      <span className="sf-streak-emblem"><Icon name="flame" size={22} /></span>
      <span>
        <strong style={{ color: 'var(--text-dark)' }}>{props.streak}-day streak</strong>{' '}
        {props.streak === 1 ? 'going. Every streak starts here.' : 'strong. Keep it rolling.'}
      </span>
    </p>
  );
}
