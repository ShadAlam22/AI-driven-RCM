import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../api/client'

const SETTINGS = ['outpatient', 'inpatient']

const CPT_SAMPLES = [
  { code: '99213', label: '99213 – Office visit, low complexity' },
  { code: '99215', label: '99215 – Office visit, high complexity' },
  { code: '27447', label: '27447 – Total knee arthroplasty (inpatient)' },
  { code: '93306', label: '93306 – Echocardiography' },
  { code: '71046', label: '71046 – Chest X-Ray' },
]

function SeverityBadge({ severity }) {
  return <span className={`badge badge-${severity}`}>{severity}</span>
}

function EligibilityBadge({ status }) {
  return <span className={`badge badge-${status}`}>{status}</span>
}

export default function EligibilityCheck() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [patient, setPatient] = useState(null)
  const [checks, setChecks] = useState([])
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    cpt_code: '99213',
    description: '',
    setting: 'outpatient',
    diagnosis: '',
  })

  function set(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }))
  }

  function loadData() {
    Promise.all([
      api.getPatient(id),
      api.listEligibilityChecks(id),
      api.listAlerts(id),
    ]).then(([p, c, a]) => {
      setPatient(p)
      setChecks(c)
      setAlerts(a)
    })
  }

  useEffect(() => { loadData() }, [id])

  async function handleCheck(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await api.runEligibilityCheck(id, form)
      loadData()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleResolve(alertId) {
    await api.resolveAlert(id, alertId)
    loadData()
  }

  if (!patient) return <p className="empty">Loading…</p>

  const ins = patient.insurance

  return (
    <>
      <h1 className="page-title">{patient.first_name} {patient.last_name}</h1>

      {/* Patient info strip */}
      <div className="card" style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
        <div><span style={{ color: 'var(--muted)', fontSize: 12 }}>DOB</span><br />{patient.date_of_birth}</div>
        {ins && <>
          <div><span style={{ color: 'var(--muted)', fontSize: 12 }}>Payer</span><br />{ins.payer_name}</div>
          <div><span style={{ color: 'var(--muted)', fontSize: 12 }}>Plan</span><br />{ins.plan_type}</div>
          <div><span style={{ color: 'var(--muted)', fontSize: 12 }}>Member ID</span><br /><code>{ins.member_id}</code></div>
        </>}
        {!ins && <p style={{ color: 'var(--danger)' }}>No insurance on file</p>}
      </div>

      {/* Run eligibility check */}
      <div className="card">
        <div className="card-title">Run Eligibility & AI Review</div>
        <form onSubmit={handleCheck}>
          <div className="form-grid">
            <div className="form-group">
              <label>CPT Code *</label>
              <select value={form.cpt_code} onChange={set('cpt_code')}>
                {CPT_SAMPLES.map((c) => (
                  <option key={c.code} value={c.code}>{c.label}</option>
                ))}
                <option value="custom">Custom…</option>
              </select>
            </div>
            {form.cpt_code === 'custom' && (
              <div className="form-group">
                <label>Custom CPT</label>
                <input value={form.description} onChange={set('description')} placeholder="Enter CPT code" />
              </div>
            )}
            <div className="form-group">
              <label>Care Setting *</label>
              <select value={form.setting} onChange={set('setting')}>
                {SETTINGS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-group full">
              <label>Primary Diagnosis (ICD / free text)</label>
              <input value={form.diagnosis} onChange={set('diagnosis')} placeholder="e.g. M17.11 – Primary osteoarthritis, right knee" />
            </div>
          </div>
          {error && <p className="error-msg" style={{ marginTop: 12 }}>{error}</p>}
          <div className="actions">
            <button className="btn btn-primary" type="submit" disabled={loading || !ins}>
              {loading ? <><span className="spinner" /> Running AI review…</> : 'Run Eligibility Check + AI Analysis'}
            </button>
          </div>
        </form>
      </div>

      {/* AI Alerts */}
      {alerts.length > 0 && (
        <div className="card">
          <div className="card-title">AI-Generated Alerts ({alerts.filter(a => !a.resolved).length} open)</div>
          {alerts.map((a) => (
            <div key={a.id} className={`alert-card ${a.severity} ${a.resolved ? 'resolved' : ''}`}>
              <div className="alert-card-header">
                <SeverityBadge severity={a.severity} />
                <span className="alert-card-title">{a.type.replace(/_/g, ' ')}</span>
                {!a.resolved && (
                  <button className="btn btn-ghost" style={{ padding: '2px 10px', fontSize: 12 }} onClick={() => handleResolve(a.id)}>
                    Resolve
                  </button>
                )}
              </div>
              <div className="alert-msg">{a.message}</div>
              {a.recommendation && <div className="alert-rec">→ {a.recommendation}</div>}
            </div>
          ))}
        </div>
      )}

      {/* Eligibility history */}
      {checks.length > 0 && (
        <div className="card">
          <div className="card-title">Eligibility Check History</div>
          {checks.map((c) => (
            <div key={c.id} style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <EligibilityBadge status={c.status} />
                <span style={{ color: 'var(--muted)', fontSize: 12 }}>{new Date(c.checked_at).toLocaleString()}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>
                Coverage ends: {c.payer_response.coverage_end} · Copay: ${c.payer_response.copay_usd}
              </div>
              <div style={{ fontSize: 12 }}>{c.payer_response.note}</div>
              {c.ai_summary && (
                <div style={{ marginTop: 8, padding: '8px 12px', background: 'var(--bg)', borderRadius: 6, fontSize: 12 }}>
                  <strong>AI summary:</strong> {c.ai_summary}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="actions">
        <button className="btn btn-primary" onClick={() => navigate(`/patients/${id}/notes`)}>
          Clinical Notes & Coding →
        </button>
        <button className="btn btn-ghost" onClick={() => navigate(`/patients/${id}/claims`)}>
          Claims →
        </button>
        <button className="btn btn-ghost" onClick={() => navigate('/patients')}>← Back to patients</button>
      </div>
    </>
  )
}
