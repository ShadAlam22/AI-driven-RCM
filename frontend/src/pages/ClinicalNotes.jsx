import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../api/client'

const NOTE_TYPES = [
  { value: 'progress_note', label: 'Progress Note' },
  { value: 'admission', label: 'Admission Note' },
  { value: 'discharge', label: 'Discharge Note' },
  { value: 'procedure', label: 'Procedure Note' },
  { value: 'nursing', label: 'Nursing Note' },
]

const AUTHOR_ROLES = [
  { value: 'physician', label: 'Physician' },
  { value: 'physician_assistant', label: 'Physician Assistant' },
  { value: 'medical_assistant', label: 'Medical Assistant' },
  { value: 'nurse', label: 'Nurse' },
]

const SAMPLE_NOTE = `Chief Complaint: Right knee pain, difficulty ambulating.

History of Present Illness:
Patient is a 65-year-old presenting with worsening right knee pain over the past 6 months. Pain is 7/10, worse with weight-bearing and stair climbing. Conservative management including NSAIDs and physical therapy has failed. X-ray confirms severe tricompartmental osteoarthritis with joint space narrowing.

Assessment & Plan:
- Primary osteoarthritis, right knee (M17.11)
- Patient is a candidate for total knee arthroplasty (CPT 27447)
- Pre-op clearance ordered; patient discussed risks and benefits and consented
- Procedure scheduled as outpatient`

export default function ClinicalNotes() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [patient, setPatient] = useState(null)
  const [notes, setNotes] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    note_type: 'progress_note',
    author_role: 'physician',
    content: '',
  })

  function set(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }))
  }

  function loadData() {
    Promise.all([api.getPatient(id), api.listNotes(id)]).then(([p, n]) => {
      setPatient(p)
      setNotes(n)
    })
  }

  useEffect(() => { loadData() }, [id])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await api.createNote(id, form)
      setForm({ note_type: 'progress_note', author_role: 'physician', content: '' })
      setShowForm(false)
      loadData()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (!patient) return <p className="empty">Loading…</p>

  return (
    <>
      <h1 className="page-title">
        {patient.first_name} {patient.last_name} — Clinical Notes
      </h1>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ Add Note'}
        </button>
        <button className="btn btn-ghost" onClick={() => navigate(`/patients/${id}/eligibility`)}>
          Eligibility & Alerts
        </button>
        <button className="btn btn-ghost" onClick={() => navigate(`/patients/${id}/claims`)}>
          Claims →
        </button>
        <button className="btn btn-ghost" onClick={() => navigate('/patients')}>
          ← Patients
        </button>
      </div>

      {showForm && (
        <div className="card">
          <div className="card-title">New Clinical Note</div>
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="form-group">
                <label>Note Type</label>
                <select value={form.note_type} onChange={set('note_type')}>
                  {NOTE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Author Role</label>
                <select value={form.author_role} onChange={set('author_role')}>
                  {AUTHOR_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <div className="form-group full">
                <label>Note Content *</label>
                <textarea
                  value={form.content}
                  onChange={set('content')}
                  required
                  rows={10}
                  placeholder="Enter clinical note text…"
                  style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', resize: 'vertical' }}
                />
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ marginTop: 6, padding: '4px 12px', fontSize: 12 }}
                  onClick={() => setForm((f) => ({ ...f, content: SAMPLE_NOTE }))}
                >
                  Load sample note
                </button>
              </div>
            </div>
            {error && <p className="error-msg" style={{ marginTop: 8 }}>{error}</p>}
            <div className="actions">
              <button className="btn btn-primary" type="submit" disabled={loading}>
                {loading ? <><span className="spinner" /> Saving…</> : 'Save Note'}
              </button>
            </div>
          </form>
        </div>
      )}

      {notes.length === 0 && !showForm && (
        <div className="card">
          <p className="empty">No clinical notes yet. Add the first note to enable AI coding analysis.</p>
        </div>
      )}

      {notes.map((note) => (
        <div key={note.id} className="card">
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
            <div style={{ flex: 1 }}>
              <span style={{ fontWeight: 600 }}>
                {NOTE_TYPES.find((t) => t.value === note.note_type)?.label ?? note.note_type}
              </span>
              <span style={{ color: 'var(--muted)', fontSize: 12, marginLeft: 10 }}>
                {AUTHOR_ROLES.find((r) => r.value === note.author_role)?.label ?? note.author_role}
                {' · '}{new Date(note.created_at).toLocaleString()}
              </span>
            </div>
            {note.analysis ? (
              <span className="badge badge-active" style={{ fontSize: 11 }}>Analyzed</span>
            ) : (
              <button
                className="btn btn-primary"
                style={{ padding: '4px 12px', fontSize: 12 }}
                onClick={() => navigate(`/patients/${id}/notes/${note.id}/coding`)}
              >
                AI Coding Analysis →
              </button>
            )}
          </div>

          <pre style={{ fontFamily: 'inherit', whiteSpace: 'pre-wrap', fontSize: 13, color: 'var(--text)', background: 'var(--bg)', padding: 12, borderRadius: 6, maxHeight: 200, overflow: 'auto' }}>
            {note.content}
          </pre>

          {note.analysis && (
            <button
              className="btn btn-ghost"
              style={{ marginTop: 10, padding: '4px 12px', fontSize: 12 }}
              onClick={() => navigate(`/patients/${id}/notes/${note.id}/coding`)}
            >
              View coding analysis →
            </button>
          )}
        </div>
      ))}
    </>
  )
}
