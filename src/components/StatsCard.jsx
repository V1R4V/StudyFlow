import { Card, OverlayTrigger, Popover } from 'react-bootstrap';

const IconInfo = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="8" cy="8" r="6.5" />
    <path d="M8 7v4" />
    <circle cx="8" cy="5" r="0.6" fill="currentColor" stroke="none" />
  </svg>
);

export default function StatsCard(props) {
  const titleNode = (
    <span className="text-muted small d-inline-flex align-items-center gap-1" style={{ fontWeight: 600, letterSpacing: '0.02em' }}>
      {props.title}
      {props.info && (
        <OverlayTrigger
          trigger={['hover', 'focus']}
          placement="top"
          overlay={
            <Popover className="sf-info-popover">
              {props.infoTitle && <Popover.Header as="h3">{props.infoTitle}</Popover.Header>}
              <Popover.Body>{props.info}</Popover.Body>
            </Popover>
          }
        >
          <button
            type="button"
            className="sf-info-btn"
            aria-label={`About ${props.title}`}
          >
            <IconInfo />
          </button>
        </OverlayTrigger>
      )}
    </span>
  );

  return (
    <Card className="h-100 sf-card-kpi">
      <Card.Body>
        <div className="d-flex justify-content-between align-items-start mb-3">
          {titleNode}
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
