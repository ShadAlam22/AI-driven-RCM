import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'

function SeverityBadge({ severity }) {
  return <span className={`badge badge-${severity}`}>{severity}</span>
}

export default function AlertsDashboard() {
  const [patients, setPatients] = useState([])
  const [allAlerts, setAllAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    api.listPatients().then(async (ps) => {
      setPatients(ps)
      const alertArrays = await Promise.all(
        ps.map((p) => api.listAlerts(p.id, false))
      )
      const flat = alertArrays
        .flatMap((arr, i) => arr.map((a) => ({ ...a, patient: ps[i] })))
        .sort((a, b) => {
          const order = { high: 0, medium: 1, low: 2 }
          return order[a.severity] - order[b.severity]
        })
      setAllAlerts(flat)
    }).finally(() => setLoading(false))
  }, [])

  const high = allAlerts.filter((a) => a.severity === 'high').length
  const medium = allAlerts.filter((a) => a.severity === 'medium').length

  return (
    <>
      {/* Hero */}
      <div className="hero">
        <h1>Welcome to your RCM command center</h1>
        <p>
          AI-driven revenue cycle management — pre-checking eligibility, structuring clinical notes,
          and learning from denials to get providers paid accurately and on time.
        </p>
        <div className="hero-actions">
          <button className="btn btn-primary" onClick={() => navigate('/patients/new')}>+ Register Patient</button>
          <button className="btn btn-ghost" onClick={() => navigate('/patients')}>View Patients</button>
          <button className="btn btn-ghost" onClick={() => navigate('/denials')}>Denials Dashboard</button>
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Total Patients', value: patients.length, color: 'var(--primary)' },
          { label: 'Open Alerts', value: allAlerts.length, color: 'var(--text)' },
          { label: 'High Severity', value: high, color: 'var(--danger)' },
          { label: 'Medium Severity', value: medium, color: 'var(--warning)' },
        ].map((s) => (
          <div key={s.label} className="stat-card">
            <span className="stat-accent" style={{ background: s.color }} />
            <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      <h2 className="section-label" style={{ marginTop: 4 }}>Open AI Alerts</h2>

      {loading && <p className="empty">Loading…</p>}

      {!loading && allAlerts.length === 0 && (
        <div className="card">
          <p className="empty">No open alerts. Register patients and run eligibility checks to see AI-generated flags here.</p>
          <div style={{ textAlign: 'center', marginTop: 12 }}>
            <button className="btn btn-primary" onClick={() => navigate('/patients/new')}>
              + New Patient
            </button>
          </div>
        </div>
      )}

      {allAlerts.map((a) => (
        <div key={a.id} className={`alert-card ${a.severity}`}>
          <div className="alert-card-header">
            <SeverityBadge severity={a.severity} />
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>
              {a.patient.first_name} {a.patient.last_name}
            </span>
            <span className="alert-card-title">{a.type.replace(/_/g, ' ')}</span>
            <button
              className="btn btn-ghost"
              style={{ padding: '2px 10px', fontSize: 12 }}
              onClick={() => navigate(`/patients/${a.patient_id}/eligibility`)}
            >
              View Patient
            </button>
          </div>
          <div className="alert-msg">{a.message}</div>
          {a.recommendation && <div className="alert-rec">→ {a.recommendation}</div>}
        </div>
      ))}
    </>
  )
}
