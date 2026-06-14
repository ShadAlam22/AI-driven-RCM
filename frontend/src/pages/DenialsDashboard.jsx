import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'

const CATEGORY_LABELS = {
  missing_prior_auth: 'Missing Prior Auth',
  medical_necessity: 'Medical Necessity',
  coding_error: 'Coding Error',
  eligibility: 'Eligibility',
  duplicate_claim: 'Duplicate Claim',
  setting_mismatch: 'Setting Mismatch',
  missing_documentation: 'Missing Documentation',
  timely_filing: 'Timely Filing',
  other: 'Other',
}

export default function DenialsDashboard() {
  const [dashboard, setDashboard] = useState(null)
  const [denials, setDenials] = useState([])
  const navigate = useNavigate()

  useEffect(() => {
    api.denialDashboard().then(setDashboard)
    api.listDenials().then(setDenials)
  }, [])

  if (!dashboard) return <p className="empty">Loading…</p>

  const maxCount = Math.max(1, ...dashboard.patterns.map((p) => p.count))

  return (
    <>
      <h1 className="page-title">Denial Management & Learning Loop</h1>

      {/* Summary */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Total Claims', value: dashboard.total_claims, color: 'var(--primary)' },
          { label: 'Total Denials', value: dashboard.total_denials, color: 'var(--danger)' },
          { label: 'Denial Rate', value: `${(dashboard.denial_rate * 100).toFixed(1)}%`, color: 'var(--warning)' },
          {
            label: 'Preventable',
            value: dashboard.patterns.reduce((s, p) => s + p.preventable_count, 0),
            color: 'var(--success)',
          },
        ].map((s) => (
          <div key={s.label} className="card" style={{ flex: 1, textAlign: 'center', marginBottom: 0 }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Pattern breakdown */}
      <div className="card">
        <div className="card-title">Denial Patterns by Category</div>
        {dashboard.patterns.length === 0 && (
          <p className="empty">No denials recorded yet. Create and deny claims to build the denial knowledge base.</p>
        )}
        {dashboard.patterns.map((p) => (
          <div key={p.category} style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
              <span style={{ fontWeight: 600 }}>{CATEGORY_LABELS[p.category] ?? p.category}</span>
              <span style={{ color: 'var(--muted)' }}>
                {p.count} denial{p.count !== 1 ? 's' : ''} · {p.preventable_count} preventable
              </span>
            </div>
            <div style={{ background: 'var(--bg)', borderRadius: 4, height: 22, overflow: 'hidden' }}>
              <div style={{
                width: `${(p.count / maxCount) * 100}%`,
                height: '100%',
                background: 'var(--danger)',
                borderRadius: 4,
                transition: 'width .3s',
              }} />
            </div>
          </div>
        ))}
      </div>

      {/* Denial log */}
      <div className="card">
        <div className="card-title">Denial Knowledge Base ({denials.length})</div>
        <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14 }}>
          Every parsed denial feeds the learning loop — future claims with matching CPT / payer / setting are
          checked against these patterns before submission.
        </p>
        {denials.length === 0 && <p className="empty">No denials recorded.</p>}
        {denials.map((d) => (
          <div key={d.id} className="alert-card high" style={{ margin: '0 0 10px' }}>
            <div className="alert-card-header">
              <span className="badge badge-inactive">{CATEGORY_LABELS[d.category] ?? d.category}</span>
              {d.preventable && <span className="badge badge-pending">preventable</span>}
              <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 'auto' }}>
                Claim #{d.claim_id} · {new Date(d.created_at).toLocaleDateString()}
              </span>
            </div>
            <div className="alert-msg"><strong>Root cause:</strong> {d.root_cause || '—'}</div>
            {d.recommendation && <div className="alert-rec">→ {d.recommendation}</div>}
          </div>
        ))}
      </div>

      <button className="btn btn-ghost" onClick={() => navigate('/patients')}>← Back to patients</button>
    </>
  )
}
