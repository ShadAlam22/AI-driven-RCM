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
      <h1 className="page-title">Alerts Dashboard</h1>

      {/* Summary strip */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Total Patients', value: patients.length, color: 'var(--primary)' },
          { label: 'Open Alerts', value: allAlerts.length, color: 'var(--text)' },
          { label: 'High Severity', value: high, color: 'var(--danger)' },
          { label: 'Medium Severity', value: medium, color: 'var(--warning)' },
        ].map((s) => (
          <div key={s.label} className="card" style={{ flex: 1, textAlign: 'center', marginBottom: 0 }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

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
