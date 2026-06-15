import { NavLink, Route, Routes } from 'react-router-dom'
import PatientIntakeForm from './pages/PatientIntakeForm'
import PatientList from './pages/PatientList'
import EligibilityCheck from './pages/EligibilityCheck'
import AlertsDashboard from './pages/AlertsDashboard'
import ClinicalNotes from './pages/ClinicalNotes'
import CodingAssistant from './pages/CodingAssistant'
import Claims from './pages/Claims'
import DenialsDashboard from './pages/DenialsDashboard'

/* ── inline icons (no dependency) ── */
const Icon = {
  pulse: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>,
  grid: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></svg>,
  userPlus: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M19 8v6M22 11h-6" /></svg>,
  users: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>,
  file: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" /></svg>,
  clipboard: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" /><path d="M9 14l2 2 4-4" /></svg>,
}

function NavSection({ children }) {
  return <div className="nav-section">{children}</div>
}

export default function App() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><Icon.pulse width={20} height={20} /></div>
          <div className="brand-text">
            <b>RCM Platform</b>
            <span>AI Revenue Cycle</span>
          </div>
        </div>

        <nav>
          <NavSection>Brick 1 · Intake</NavSection>
          <NavLink to="/" end><Icon.grid /> Dashboard</NavLink>
          <NavLink to="/patients/new"><Icon.userPlus /> New Patient</NavLink>
          <NavLink to="/patients"><Icon.users /> Patient List</NavLink>

          <NavSection>Brick 2 · Clinical</NavSection>
          <div className="nav-hint">Notes &amp; coding open from each patient.</div>

          <NavSection>Brick 3 · Denials</NavSection>
          <NavLink to="/denials"><Icon.clipboard /> Denials Dashboard</NavLink>
          <div className="nav-hint">Claims open from each patient.</div>
        </nav>

        <div className="sidebar-footer">v0.1 · Local demo</div>
      </aside>

      <div className="content">
        <header className="topbar">
          <div className="topbar-title">
            AI-Driven Revenue Cycle Management
            <small>Intake · Clinical Coding · Denial Management</small>
          </div>
          <div className="topbar-right">
            <span className="pill"><span className="dot" /> AI Connected</span>
            <div className="avatar">SA</div>
          </div>
        </header>

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
    </div>
  )
}
