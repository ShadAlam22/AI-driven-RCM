import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'

export default function PatientList() {
  const [patients, setPatients] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    api.listPatients().then(setPatients).finally(() => setLoading(false))
  }, [])

  return (
    <>
      <h1 className="page-title">Patients</h1>
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>DOB</th>
              <th>Payer</th>
              <th>Plan</th>
              <th>Member ID</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {!loading && patients.length === 0 && (
              <tr><td colSpan={6} className="empty">No patients yet — register one to get started.</td></tr>
            )}
            {patients.map((p) => (
              <tr key={p.id}>
                <td style={{ fontWeight: 600 }}>{p.first_name} {p.last_name}</td>
                <td>{p.date_of_birth}</td>
                <td>{p.insurance?.payer_name ?? '—'}</td>
                <td>{p.insurance?.plan_type ?? '—'}</td>
                <td style={{ fontFamily: 'monospace' }}>{p.insurance?.member_id ?? '—'}</td>
                <td>
                  <button
                    className="btn btn-ghost"
                    style={{ padding: '4px 12px' }}
                    onClick={() => navigate(`/patients/${p.id}/eligibility`)}
                  >
                    Eligibility & Alerts
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button className="btn btn-primary" onClick={() => navigate('/patients/new')}>
        + New Patient
      </button>
    </>
  )
}
