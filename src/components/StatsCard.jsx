import { Card } from 'react-bootstrap';

export default function StatsCard(props) {
  return (
    <Card className="h-100 sf-card-kpi">
      <Card.Body>
        <div className="d-flex justify-content-between align-items-start mb-3">
          <span className="text-muted small" style={{ fontWeight: 600, letterSpacing: '0.02em' }}>
            {props.title}
          </span>
          <div
            className="sf-stats-icon"
            style={{
              background: props.iconBg || 'rgba(43, 74, 238, 0.1)',
              color: props.iconColor || 'var(--primary)',
            }}
            aria-hidden="true"
          >
            {props.icon}
          </div>
        </div>

        <div className="d-flex align-items-baseline gap-2 mb-1">
          <span className="sf-stats-value">{props.value}</span>
          {props.unit && (
            <span style={{ color: 'var(--text-light)', fontSize: '0.875rem', fontWeight: 500 }}>
              {props.unit}
            </span>
          )}
        </div>

        {props.subtitle && (
          <div
            style={{
              fontSize: '0.775rem',
              fontWeight: 500,
              color: props.subtitleColor || 'var(--muted-strong)',
              marginTop: '0.25rem',
            }}
          >
            {props.subtitle}
          </div>
        )}
      </Card.Body>
    </Card>
  );
}
