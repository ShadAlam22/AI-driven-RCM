import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../api/client'

const SETTINGS = ['outpatient', 'inpatient']

const STATUS_BADGE = {
  draft: 'badge-pending',
  submitted: 'badge-pending',
  resubmitted: 'badge-pending',
  accepted: 'badge-active',
  denied: 'badge-inactive',
}

const SAMPLE_DENIALS = [
  'Claim denied: prior authorization was not obtained for procedure. Authorization is required for this service under the member\'s plan (CARC 197).',
  'Denied — service billed as outpatient but procedure is designated inpatient-only per payer policy. Setting mismatch.',
  'Denied for lack of medical necessity. Submitted documentation does not support the level of service billed (CARC 50).',
]

function SeverityBadge({ severity }) {
  return <span className={`badge badge-${severity}`}>{severity}</span>
}

export default function Claims() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [patient, setPatient] = useState(null)
  const [claims, setClaims] = useState([])
  const [selected, setSelected] = useState(null)
  const [risk, setRisk] = useState(null)
  const [denyText, setDenyText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    cpt_code: '27447',
    icd_code: 'M17.11',
    setting: 'outpatient',
    charge_amount: 18500,
  })

  function set(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }))
  }

  function loadData() {
    Promise.all([api.getPatient(id), api.listPatientClaims(id)]).then(([p, c]) => {
      setPatient(p)
      setClaims(c)
      if (selected) {
        const updated = c.find((cl) => cl.id === selected.id)
        setSelected(updated || null)
      }
    })
  }

  useEffect(() => { loadData() }, [id])

  async function handleCreate(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const claim = await api.createClaim(id, {
        ...form,
        charge_amount: parseFloat(form.charge_amount) || 0,
      })
      setSelected(claim)
      setRisk(null)
      loadData()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  function selectClaim(claim) {
    setSelected(claim)
    setRisk(null)
    setDenyText('')
    setError('')
  }

  async function act(fn) {
    setError('')
    setBusy(true)
    try {
      await fn()
      loadData()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleAssessRisk() {
    setError('')
    setBusy(true)
    try {
      const result = await api.assessClaimRisk(selected.id)
      setRisk(result)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (!patient) return <p className="empty">Loading…</p>

  return (
    <>
      <h1 className="page-title">{patient.first_name} {patient.last_name} — Claims</h1>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <button className="btn btn-ghost" onClick={() => navigate(`/patients/${id}/notes`)}>Clinical Notes</button>
        <button className="btn btn-ghost" onClick={() => navigate(`/patients/${id}/eligibility`)}>Eligibility & Alerts</button>
        <button className="btn btn-ghost" onClick={() => navigate('/denials')}>Denials Dashboard →</button>
      </div>

      {/* Create claim */}
      <div className="card">
        <div className="card-title">New Claim</div>
        <form onSubmit={handleCreate}>
          <div className="form-grid">
            <div className="form-group">
              <label>CPT Code *</label>
              <input value={form.cpt_code} onChange={set('cpt_code')} required />
            </div>
            <div className="form-group">
              <label>ICD-10 Code</label>
              <input value={form.icd_code} onChange={set('icd_code')} />
            </div>
            <div className="form-group">
              <label>Care Setting *</label>
              <select value={form.setting} onChange={set('setting')}>
                {SETTINGS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Charge Amount (USD)</label>
              <input type="number" step="0.01" value={form.charge_amount} onChange={set('charge_amount')} />
            </div>
          </div>
          <div className="actions">
            <button className="btn btn-primary" type="submit" disabled={busy}>Create Claim</button>
            <span style={{ fontSize: 12, color: 'var(--muted)', alignSelf: 'center' }}>
              Payer: {patient.insurance?.payer_name ?? 'no insurance on file'}
            </span>
          </div>
        </form>
      </div>

      {error && <p className="error-msg">{error}</p>}

      {/* Claims list */}
      <div className="card">
        <div className="card-title">Claims ({claims.length})</div>
        <table>
          <thead>
            <tr><th>ID</th><th>CPT</th><th>ICD</th><th>Setting</th><th>Charge</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {claims.length === 0 && <tr><td colSpan={7} className="empty">No claims yet.</td></tr>}
            {claims.map((c) => (
              <tr key={c.id} style={{ background: selected?.id === c.id ? 'var(--bg)' : undefined }}>
                <td>#{c.id}</td>
                <td><code>{c.cpt_code}</code></td>
                <td><code>{c.icd_code || '—'}</code></td>
                <td>{c.setting}</td>
                <td>${c.charge_amount.toLocaleString()}</td>
                <td><span className={`badge ${STATUS_BADGE[c.status]}`}>{c.status}</span></td>
                <td><button className="btn btn-ghost" style={{ padding: '4px 12px' }} onClick={() => selectClaim(c)}>Manage</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Selected claim panel */}
      {selected && (
        <div className="card" style={{ borderLeft: '4px solid var(--primary)' }}>
          <div className="card-title">
            Claim #{selected.id} · <code>{selected.cpt_code}</code> · {selected.setting} ·{' '}
            <span className={`badge ${STATUS_BADGE[selected.status]}`}>{selected.status}</span>
          </div>

          {/* Learning loop: assess risk */}
          <div className="section-label">Pre-Submission Denial Risk (Learning Loop)</div>
          <button className="btn btn-primary" onClick={handleAssessRisk} disabled={busy}>
            {busy ? <><span className="spinner" /> Assessing…</> : 'Assess Denial Risk'}
          </button>

          {risk && (
            <div style={{ marginTop: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>Overall risk:</span>
                <SeverityBadge severity={risk.assessment.risk_level} />
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                  {risk.historical_denials_considered} similar past denial(s) considered
                </span>
              </div>
              <p style={{ fontSize: 13, marginBottom: 10 }}>{risk.assessment.summary}</p>
              {risk.assessment.warnings.map((w, i) => (
                <div key={i} className={`alert-card ${w.severity}`} style={{ margin: '0 0 10px' }}>
                  <div className="alert-card-header">
                    <SeverityBadge severity={w.severity} />
                  </div>
                  <div className="alert-msg">{w.message}</div>
                  {w.recommendation && <div className="alert-rec">→ {w.recommendation}</div>}
                </div>
              ))}
            </div>
          )}

          {/* Lifecycle actions */}
          <div className="section-label">Claim Actions</div>
          <div className="actions" style={{ marginTop: 0 }}>
            {(selected.status === 'draft' || selected.status === 'denied') && (
              <button className="btn btn-primary" onClick={() => act(() => api.submitClaim(selected.id))} disabled={busy}>
                {selected.status === 'denied' ? 'Resubmit Claim' : 'Submit Claim'}
              </button>
            )}
            {(selected.status === 'submitted' || selected.status === 'resubmitted') && (
              <button className="btn btn-ghost" onClick={() => act(() => api.acceptClaim(selected.id))} disabled={busy}>
                Simulate Payer Acceptance
              </button>
            )}
          </div>

          {/* Simulate denial */}
          {(selected.status === 'submitted' || selected.status === 'resubmitted') && (
            <div style={{ marginTop: 16 }}>
              <div className="section-label">Simulate Payer Denial</div>
              <textarea
                value={denyText}
                onChange={(e) => setDenyText(e.target.value)}
                rows={3}
                placeholder="Paste the payer's denial / remittance text…"
                style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', resize: 'vertical' }}
              />
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '8px 0' }}>
                {SAMPLE_DENIALS.map((s, i) => (
                  <button key={i} type="button" className="btn btn-ghost" style={{ padding: '3px 10px', fontSize: 11 }} onClick={() => setDenyText(s)}>
                    Sample {i + 1}
                  </button>
                ))}
              </div>
              <button
                className="btn btn-danger"
                disabled={busy || !denyText.trim()}
                onClick={() => act(async () => { await api.denyClaim(selected.id, { raw_reason: denyText }); setDenyText('') })}
              >
                {busy ? <><span className="spinner" /> Parsing denial…</> : 'Record Denial (AI Parse)'}
              </button>
            </div>
          )}

          {/* Denials on this claim */}
          {selected.denials?.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div className="section-label">Denials on This Claim</div>
              {selected.denials.map((d) => (
                <div key={d.id} className="alert-card high" style={{ margin: '0 0 10px' }}>
                  <div className="alert-card-header">
                    <span className="badge badge-inactive">{d.category.replace(/_/g, ' ')}</span>
                    {d.preventable && <span className="badge badge-pending">preventable</span>}
                  </div>
                  <div className="alert-msg"><strong>Root cause:</strong> {d.root_cause || '—'}</div>
                  {d.recommendation && <div className="alert-rec">→ {d.recommendation}</div>}
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>Raw: {d.raw_reason}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  )
}
