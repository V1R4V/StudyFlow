import { Card } from 'react-bootstrap';

// Headline metric card, matches the Statistics page vocabulary
// (section label + big numeral + optional subline / delta) so KPI rows read
// consistently across the app.
export default function KpiCard({ label, value, unit, sub, delta }) {
  return (
    <Card className="h-100 sf-card-kpi">
      <Card.Body>
        <div className="sf-section-label mb-2">{label}</div>
        <div className="d-flex align-items-baseline flex-wrap gap-2">
          <div className="sf-stats-value">{value}</div>
          {unit && <span className="small text-muted">{unit}</span>}
        </div>
        <div className="d-flex align-items-center gap-2 mt-1" style={{ minHeight: 18 }}>
          {sub && <span className="small text-muted">{sub}</span>}
          {delta && (
            <span
              className="small fw-semibold text-nowrap flex-shrink-0"
              style={{ color: delta.positive ? 'var(--success-text)' : 'var(--danger-text)' }}
            >
              {delta.text}
            </span>
          )}
        </div>
      </Card.Body>
    </Card>
  );
}
