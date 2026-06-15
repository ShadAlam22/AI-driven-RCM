import { NavLink, Route, Routes } from 'react-router-dom'
import PatientIntakeForm from './pages/PatientIntakeForm'
import PatientList from './pages/PatientList'
import EligibilityCheck from './pages/EligibilityCheck'
import AlertsDashboard from './pages/AlertsDashboard'
import ClinicalNotes from './pages/ClinicalNotes'
import CodingAssistant from './pages/CodingAssistant'
import Claims from './pages/Claims'
import DenialsDashboard from './pages/DenialsDashboard'

function SectionLabel({ children }) {
  return (
    <div style={{ padding: '12px 20px 4px', fontSize: 10, fontWeight: 700, color: '#5a7a9a', textTransform: 'uppercase', letterSpacing: '.5px' }}>
      {children}
    </div>
  )
}

export default function App() {
  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="logo">RCM Platform</div>
        <nav>
          <SectionLabel>Brick 1 · Intake</SectionLabel>
          <NavLink to="/" end>Alerts Dashboard</NavLink>
          <NavLink to="/patients/new">New Patient</NavLink>
          <NavLink to="/patients">Patient List</NavLink>
          <SectionLabel>Brick 2 · Clinical</SectionLabel>
          <div style={{ padding: '4px 20px 8px', fontSize: 12, color: '#7e93ab', lineHeight: 1.5 }}>
            Per-patient — open a patient from the{' '}
            <NavLink to="/patients" style={{ color: '#9fc0e8' }}>Patient List</NavLink>
            , then use <em>Notes &amp; Coding</em>.
          </div>
          <SectionLabel>Brick 3 · Denials</SectionLabel>
          <NavLink to="/denials">Denials Dashboard</NavLink>
          <div style={{ padding: '4px 20px 8px', fontSize: 12, color: '#7e93ab', lineHeight: 1.5 }}>
            Per-patient claims open from the{' '}
            <NavLink to="/patients" style={{ color: '#9fc0e8' }}>Patient List</NavLink>.
          </div>
        </nav>
      </aside>
      <main className="main">
        <Routes>
          <Route path="/" element={<AlertsDashboard />} />
          <Route path="/patients" element={<PatientList />} />
          <Route path="/patients/new" element={<PatientIntakeForm />} />
          <Route path="/patients/:id/eligibility" element={<EligibilityCheck />} />
          <Route path="/patients/:id/notes" element={<ClinicalNotes />} />
          <Route path="/patients/:id/notes/:noteId/coding" element={<CodingAssistant />} />
          <Route path="/patients/:id/claims" element={<Claims />} />
          <Route path="/denials" element={<DenialsDashboard />} />
        </Routes>
      </main>
    </div>
  )
}
