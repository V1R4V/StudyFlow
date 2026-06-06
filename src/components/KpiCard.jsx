import { Card } from 'react-bootstrap';

// Headline metric card — matches the Statistics page vocabulary
// (section label + big numeral + optional subline / delta) so KPI rows read
// consistently across the app.
export default function KpiCard({ label, value, sub, delta }) {
  return (
    <Card className="h-100 sf-card-kpi">
      <Card.Body>
        <div className="sf-section-label mb-2">{label}</div>
        <div className="sf-stats-value">{value}</div>
        <div className="d-flex align-items-center gap-2 mt-1" style={{ minHeight: 18 }}>
          {sub && <span className="small text-muted">{sub}</span>}
          {delta && (
            <span
              className="small fw-semibold"
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
