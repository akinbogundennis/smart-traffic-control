import { ScrollText } from 'lucide-react'
import Panel from '../common/Panel.jsx'

// Simulation event log (prompt section 12). Shows recent engine events like
// phase changes, hotspot early releases, adaptive decisions, and emergencies.

const KIND_COLOR = {
  signal: 'text-signal-green',
  adaptive: 'text-accent',
  hotspot: 'text-signal-yellow',
  emergency: 'text-danger',
  info: 'text-muted',
}

export default function EventLog({ snap }) {
  const events = snap?.events ?? []
  return (
    <Panel title="Event Log" icon={ScrollText} className="h-full">
      <div className="h-48 overflow-y-auto font-mono text-[11px] leading-relaxed">
        {events.length === 0 ? (
          <p className="text-muted">No events yet. Start the simulation.</p>
        ) : (
          events.map((e, i) => (
            <div key={i} className="flex gap-2">
              <span className="text-muted/70 shrink-0">{e.t.toFixed(1)}s</span>
              <span className={KIND_COLOR[e.kind] ?? 'text-ink'}>{e.text}</span>
            </div>
          ))
        )}
      </div>
    </Panel>
  )
}
