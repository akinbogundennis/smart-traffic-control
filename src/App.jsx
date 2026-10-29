import { useState } from 'react'
import {
  LayoutDashboard, BarChart3, FlaskConical, Network, Info, TrafficCone,
} from 'lucide-react'
import SimulationPage from './components/dashboard/SimulationPage.jsx'
import AnalyticsPage from './components/dashboard/AnalyticsPage.jsx'
import ScenarioPage from './components/dashboard/ScenarioPage.jsx'
import ArchitecturePage from './components/dashboard/ArchitecturePage.jsx'
import AboutPage from './components/dashboard/AboutPage.jsx'

// Top-level app shell with navigation across the five sections
// (prompt section 12).

const TABS = [
  { id: 'simulation', label: 'Simulation', icon: LayoutDashboard, Page: SimulationPage },
  { id: 'analytics', label: 'Analytics', icon: BarChart3, Page: AnalyticsPage },
  { id: 'scenarios', label: 'Scenario Testing', icon: FlaskConical, Page: ScenarioPage },
  { id: 'architecture', label: 'System Architecture', icon: Network, Page: ArchitecturePage },
  { id: 'about', label: 'About Project', icon: Info, Page: AboutPage },
]

export default function App() {
  const [tab, setTab] = useState('simulation')
  const ActivePage = TABS.find((t) => t.id === tab).Page

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-10 bg-panel/95 backdrop-blur border-b border-line">
        <div className="max-w-[1500px] mx-auto px-5 py-3 flex items-center gap-6 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-signal-green/15 border border-signal-green/40 flex items-center justify-center">
              <TrafficCone size={18} className="text-signal-green" />
            </div>
            <div>
              <div className="font-semibold leading-tight">Smart Traffic Control</div>
              <div className="text-[11px] text-muted leading-tight">
                Adaptive vs fixed-time signal simulation
              </div>
            </div>
          </div>

          <nav className="flex items-center gap-1 flex-wrap">
            {TABS.map((t) => (
              <button
                key={t.id}
                className={`nav-tab ${tab === t.id ? 'nav-tab-active' : ''}`}
                onClick={() => setTab(t.id)}
              >
                <t.icon size={15} />
                {t.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-[1500px] w-full mx-auto px-5 py-5">
        <ActivePage />
      </main>
    </div>
  )
}
