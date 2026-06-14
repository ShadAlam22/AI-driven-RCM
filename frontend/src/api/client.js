const BASE = '/api'

async function request(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  }
  if (body !== undefined) opts.body = JSON.stringify(body)
  const res = await fetch(`${BASE}${path}`, opts)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || JSON.stringify(err))
  }
  return res.json()
}

export const api = {
  // Patients
  createPatient: (data) => request('POST', '/patients', data),
  listPatients: () => request('GET', '/patients'),
  getPatient: (id) => request('GET', `/patients/${id}`),

  // Eligibility
  runEligibilityCheck: (patientId, data) =>
    request('POST', `/patients/${patientId}/eligibility`, data),
  listEligibilityChecks: (patientId) =>
    request('GET', `/patients/${patientId}/eligibility`),

  // Prior auth
  createPriorAuth: (patientId, data) =>
    request('POST', `/patients/${patientId}/prior-auth`, data),
  listPriorAuths: (patientId) =>
    request('GET', `/patients/${patientId}/prior-auth`),
  updatePriorAuthStatus: (patientId, paId, data) =>
    request('PATCH', `/patients/${patientId}/prior-auth/${paId}`, data),

  // Alerts
  listAlerts: (patientId, resolved) => {
    const qs = resolved !== undefined ? `?resolved=${resolved}` : ''
    return request('GET', `/patients/${patientId}/alerts${qs}`)
  },
  resolveAlert: (patientId, alertId) =>
    request('PATCH', `/patients/${patientId}/alerts/${alertId}/resolve`),

  // Clinical notes (Brick 2)
  createNote: (patientId, data) =>
    request('POST', `/patients/${patientId}/notes`, data),
  listNotes: (patientId) =>
    request('GET', `/patients/${patientId}/notes`),
  getNote: (patientId, noteId) =>
    request('GET', `/patients/${patientId}/notes/${noteId}`),
  analyzeNote: (patientId, noteId) =>
    request('POST', `/patients/${patientId}/notes/${noteId}/analyze`),

  // Claims & denials (Brick 3)
  createClaim: (patientId, data) =>
    request('POST', `/patients/${patientId}/claims`, data),
  listPatientClaims: (patientId) =>
    request('GET', `/patients/${patientId}/claims`),
  listAllClaims: () => request('GET', '/claims'),
  getClaim: (claimId) => request('GET', `/claims/${claimId}`),
  submitClaim: (claimId) => request('POST', `/claims/${claimId}/submit`),
  acceptClaim: (claimId) => request('POST', `/claims/${claimId}/accept`),
  denyClaim: (claimId, data) => request('POST', `/claims/${claimId}/deny`, data),
  assessClaimRisk: (claimId) => request('POST', `/claims/${claimId}/assess-risk`),

  listDenials: () => request('GET', '/denials'),
  denialDashboard: () => request('GET', '/denials/dashboard'),
}
