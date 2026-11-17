import { Activity } from 'lucide-react'
import Panel from '../common/Panel.jsx'
import StatCard from '../common/StatCard.jsx'
import { WEATHER } from '../../utils/constants.js'

// Live performance metrics + sensor readings (prompt section 3C and 4), including
// the hotspot sensor's per-approach dwell time and early-release counters.

export default function LiveMetrics({ snap }) {
  const m = snap?.metrics
  const phaseLabel = snap?.phaseKey === 'NS' ? 'North-South' : 'East-West'

  return (
    <Panel title="Live Metrics" icon={Activity} className="h-full overflow-y-auto">
      <div className="grid grid-cols-2 gap-2">
        <StatCard label="Vehicles generated" value={m?.generated ?? 0} />
        <StatCard label="Vehicles processed" value={m?.processed ?? 0} accent="text-accent" />
        <StatCard label="Avg waiting time" value={fmt(m?.avgWait)} unit="s" />
        <StatCard label="Current queue" value={m?.currentQueue ?? 0} unit="cars" />
        <StatCard label="Max queue" value={m?.peakQueue ?? 0} unit="cars" accent="text-signal-yellow" />
        <StatCard label="Avg queue" value={fmt(m?.avgQueue)} unit="cars" />
        <StatCard label="Throughput" value={fmt0(m?.throughput)} unit="/hr" accent="text-accent" />
        <StatCard label="Avg travel delay" value={fmt(m?.avgDelay)} unit="s" />
        <StatCard label="Emergencies" value={m?.emergencyProcessed ?? 0} unit="done" accent="text-danger" />
        <StatCard label="Emrg. stopped time" value={fmt(m?.avgEmergencyResponse)} unit="s" accent="text-danger" />
        <StatCard label="Hotspot releases" value={m?.hotspotReleases ?? 0} unit="greens" accent="text-signal-yellow" />
        <StatCard label="Idle green saved" value={fmt0(m?.hotspotGreenSaved)} unit="s" accent="text-signal-yellow" />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <Info label="Signal phase" value={phaseLabel} />
        <Info label="Current green" value={`${fmt(snap?.timeToTransition)}s left`} />
        <Info label="Weather" value={WEATHER[snap?.weatherKey]?.label ?? '-'} />
        <Info label="Sim time" value={`${fmt0(m?.elapsed)}s`} />
      </div>

      {snap?.readings && (
        <div className="mt-4">
          <div className="text-xs font-medium text-muted mb-2">Sensor readings per approach</div>
          <table className="w-full text-[10px]">
            <thead className="text-muted">
              <tr>
                <th className="text-left py-1">Dir</th>
                <th className="text-right">Cnt</th>
                <th className="text-right">Q</th>
                <th className="text-right">Arr/s</th>
                <th className="text-right">Wait</th>
                <th className="text-right">Occ</th>
                <th className="text-right text-signal-yellow">Hot</th>
                <th className="text-right text-signal-yellow">Dwell</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {['north', 'south', 'east', 'west'].map((d) => {
                const r = snap.readings[d]
                const waiting = (r.hotspotStopped ?? 0) > 0
                return (
                  <tr key={d} className="border-t border-line/60">
                    <td className="py-1 capitalize text-muted">{d}</td>
                    <td className="text-right">{r.count}</td>
                    <td className="text-right">{r.queueLength}</td>
                    <td className="text-right">{r.arrivalRate.toFixed(2)}</td>
                    <td className="text-right">{r.avgWait.toFixed(1)}</td>
                    <td className="text-right">{(r.occupancy * 100).toFixed(0)}%</td>
                    <td className="text-right">{r.hotspotCount ?? 0}</td>
                    <td className={`text-right ${waiting ? 'text-signal-yellow' : 'text-muted'}`}>
                      {waiting ? `${r.hotspotDwell.toFixed(1)}s` : '-'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <p className="hint">
            Hot = vehicles in the hotspot zone; Dwell = longest time one has sat
            stopped there. A waiting vehicle with an empty opposing approach
            triggers an early green release.
          </p>
        </div>
      )}
    </Panel>
  )
}

function Info({ label, value }) {
  return (
    <div className="bg-panel-2 border border-line rounded-lg px-3 py-2">
      <div className="text-muted text-[11px]">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  )
}

function fmt(n) {
  return Number.isFinite(n) ? n.toFixed(1) : '0.0'
}
function fmt0(n) {
  return Number.isFinite(n) ? Math.round(n).toString() : '0'
}
