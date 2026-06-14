import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../api/client'

function ConfidenceBadge({ confidence }) {
  const colors = { high: 'badge-active', medium: 'badge-pending', low: 'badge-inactive' }
  return <span className={`badge ${colors[confidence] ?? 'badge-pending'}`}>{confidence}</span>
}

function SeverityBadge({ severity }) {
  return <span className={`badge badge-${severity}`}>{severity}</span>
}

export default function CodingAssistant() {
  const { id, noteId } = useParams()
  const navigate = useNavigate()

  const [note, setNote] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function loadNote() {
    api.getNote(id, noteId).then(setNote)
  }

  useEffect(() => { loadNote() }, [id, noteId])

  async function handleAnalyze() {
    setError('')
    setLoading(true)
    try {
      const updated = await api.analyzeNote(id, noteId)
      setNote(updated)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (!note) return <p className="empty">Loading…</p>

  const a = note.analysis

  return (
    <>
      <h1 className="page-title">AI Coding Assistant</h1>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <button className="btn btn-ghost" onClick={() => navigate(`/patients/${id}/notes`)}>
          ← Back to Notes
        </button>
        {!a && (
          <button className="btn btn-primary" onClick={handleAnalyze} disabled={loading}>
            {loading
              ? <><span className="spinner" /> Analyzing with Claude…</>
              : 'Run AI Coding Analysis'}
          </button>
        )}
        {a && (
          <button className="btn btn-ghost" onClick={handleAnalyze} disabled={loading}>
            {loading ? <><span className="spinner" /> Re-analyzing…</> : 'Re-run Analysis'}
          </button>
        )}
      </div>

      {error && (
        <div className="card" style={{ borderLeft: '4px solid var(--danger)' }}>
          <p className="error-msg">{error}</p>
        </div>
      )}

      {/* Original note */}
      <div className="card">
        <div className="card-title">
          Clinical Note
          <span style={{ fontWeight: 400, color: 'var(--muted)', fontSize: 12, marginLeft: 8 }}>
            {note.note_type.replace(/_/g, ' ')} · {note.author_role.replace(/_/g, ' ')}
            {note.analyzed_at && ` · Analyzed ${new Date(note.analyzed_at).toLocaleString()}`}
          </span>
        </div>
        <pre style={{ fontFamily: 'inherit', whiteSpace: 'pre-wrap', fontSize: 13, background: 'var(--bg)', padding: 12, borderRadius: 6, maxHeight: 250, overflow: 'auto' }}>
          {note.content}
        </pre>
      </div>

      {!a && !loading && (
        <div className="card">
          <p className="empty">Click "Run AI Coding Analysis" to extract CPT/ICD codes, detect documentation gaps, and flag denial risks.</p>
        </div>
      )}

      {a && (
        <>
          {/* AI summary */}
          <div className="card" style={{ borderLeft: '4px solid var(--primary)' }}>
            <div className="card-title">AI Summary</div>
            <p style={{ fontSize: 14 }}>{a.summary}</p>
            {a.copy_paste_detected && (
              <div style={{ marginTop: 12, padding: '10px 14px', background: '#fef3c7', borderRadius: 6, fontSize: 13 }}>
                <strong style={{ color: 'var(--warning)' }}>Copy-paste / templated content detected.</strong>
                {a.copy_paste_explanation && <span style={{ color: 'var(--text)', marginLeft: 6 }}>{a.copy_paste_explanation}</span>}
              </div>
            )}
          </div>

          {/* CPT codes */}
          <div className="card">
            <div className="card-title">Suggested CPT Codes ({a.cpt_codes.length})</div>
            {a.cpt_codes.length === 0 && <p className="empty">No CPT codes extracted.</p>}
            <table>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Description</th>
                  <th>Confidence</th>
                </tr>
              </thead>
              <tbody>
                {a.cpt_codes.map((c, i) => (
                  <tr key={i}>
                    <td><code style={{ fontWeight: 700 }}>{c.code}</code></td>
                    <td>{c.description}</td>
                    <td><ConfidenceBadge confidence={c.confidence} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ICD codes */}
          <div className="card">
            <div className="card-title">Suggested ICD-10 Codes ({a.icd_codes.length})</div>
            {a.icd_codes.length === 0 && <p className="empty">No ICD codes extracted.</p>}
            <table>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Description</th>
                  <th>Confidence</th>
                </tr>
              </thead>
              <tbody>
                {a.icd_codes.map((c, i) => (
                  <tr key={i}>
                    <td><code style={{ fontWeight: 700 }}>{c.code}</code></td>
                    <td>{c.description}</td>
                    <td><ConfidenceBadge confidence={c.confidence} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Missing documentation */}
          {a.missing_documentation.length > 0 && (
            <div className="card" style={{ borderLeft: '4px solid var(--warning)' }}>
              <div className="card-title">Missing Documentation ({a.missing_documentation.length})</div>
              {a.missing_documentation.map((m, i) => (
                <div key={i} style={{ marginBottom: 10, paddingBottom: 10, borderBottom: i < a.missing_documentation.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{m.item}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{m.reason}</div>
                </div>
              ))}
            </div>
          )}

          {/* Denial risks */}
          {a.denial_risks.length > 0 && (
            <div className="card">
              <div className="card-title">Denial Risk Flags ({a.denial_risks.length})</div>
              {a.denial_risks.map((r, i) => (
                <div key={i} className={`alert-card ${r.severity}`} style={{ margin: '0 0 10px' }}>
                  <div className="alert-card-header">
                    <SeverityBadge severity={r.severity} />
                    <span className="alert-card-title">{r.type.replace(/_/g, ' ')}</span>
                  </div>
                  <div className="alert-msg">{r.message}</div>
                  {r.recommendation && <div className="alert-rec">→ {r.recommendation}</div>}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </>
  )
}
