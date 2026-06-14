import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'

const PLAN_TYPES = ['HMO', 'PPO', 'EPO', 'MEDICARE', 'MEDICAID']

export default function PatientIntakeForm() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    date_of_birth: '',
    phone: '',
    email: '',
    payer_name: '',
    member_id: '',
    plan_type: 'PPO',
  })

  function set(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const payload = {
        first_name: form.first_name,
        last_name: form.last_name,
        date_of_birth: form.date_of_birth,
        phone: form.phone || null,
        email: form.email || null,
        insurance: form.payer_name
          ? {
              payer_name: form.payer_name,
              member_id: form.member_id,
              plan_type: form.plan_type,
            }
          : null,
      }
      const patient = await api.createPatient(payload)
      navigate(`/patients/${patient.id}/eligibility`)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <h1 className="page-title">New Patient Intake</h1>

      <form onSubmit={handleSubmit}>
        <div className="card">
          <div className="card-title">Personal Information</div>
          <div className="form-grid">
            <div className="form-group">
              <label>First Name *</label>
              <input value={form.first_name} onChange={set('first_name')} required />
            </div>
            <div className="form-group">
              <label>Last Name *</label>
              <input value={form.last_name} onChange={set('last_name')} required />
            </div>
            <div className="form-group">
              <label>Date of Birth *</label>
              <input type="date" value={form.date_of_birth} onChange={set('date_of_birth')} required />
            </div>
            <div className="form-group">
              <label>Phone</label>
              <input value={form.phone} onChange={set('phone')} placeholder="555-000-0000" />
            </div>
            <div className="form-group full">
              <label>Email</label>
              <input type="email" value={form.email} onChange={set('email')} placeholder="patient@email.com" />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-title">Insurance Information</div>
          <div className="form-grid">
            <div className="form-group">
              <label>Payer Name *</label>
              <input value={form.payer_name} onChange={set('payer_name')} placeholder="e.g. Blue Cross Blue Shield" required />
            </div>
            <div className="form-group">
              <label>Member ID *</label>
              <input value={form.member_id} onChange={set('member_id')} placeholder="e.g. BCB123456780" required />
            </div>
            <div className="form-group">
              <label>Plan Type *</label>
              <select value={form.plan_type} onChange={set('plan_type')}>
                {PLAN_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 12 }}>
            Tip: member IDs ending in an even digit return active coverage; odd digit returns inactive (demo behavior).
          </p>
        </div>

        {error && <p className="error-msg">{error}</p>}

        <div className="actions">
          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? <><span className="spinner" /> Saving…</> : 'Register & Run Eligibility Check →'}
          </button>
          <button className="btn btn-ghost" type="button" onClick={() => navigate('/patients')}>
            Cancel
          </button>
        </div>
      </form>
    </>
  )
}
