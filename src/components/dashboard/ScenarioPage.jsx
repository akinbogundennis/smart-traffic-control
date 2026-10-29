import { useState } from 'react'
import { FlaskConical, Play, RotateCcw } from 'lucide-react'
import Panel from '../common/Panel.jsx'
import { SCENARIOS } from '../../scenarios/scenarioDefinitions.js'
import { compareScenario } from '../../scenarios/ScenarioRunner.js'
import { buildComparison } from '../../analytics/ComparisonEngine.js'

// Scenario testing page (prompt section 11). Each predefined scenario can be
// run (both controllers), reset, and its comparison results viewed.

export default function ScenarioPage() {
  const [results, setResults] = useState({})
  const [busyId, setBusyId] = useState(null)

  const runScenario = (scenario) => {
    setBusyId(scenario.id)
    setTimeout(() => {
      const r = compareScenario(scenario)
      setResults((prev) => ({ ...prev, [scenario.id]: r }))
      setBusyId(null)
    }, 20)
  }

  const resetScenario = (id) => {
    setResults((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }

  return (
    <div className="flex flex-col gap-5">
      <Panel title="Scenario Testing" icon={FlaskConical}>
        <p className="text-sm text-muted max-w-3xl">
          Five predefined scenarios exercise normal flow, congestion, low volume,
          adverse weather, and emergency priority. Running a scenario executes both
          the fixed-time and adaptive controllers against identical traffic and
          reports the measured comparison.
        </p>
      </Panel>

      {SCENARIOS.map((s) => {
        const r = results[s.id]
        const comparison = r ? buildComparison(r.fixed.metrics, r.adaptive.metrics) : null
        return (
          <Panel key={s.id} title={s.name}>
            <p className="text-sm text-muted mb-3">{s.description}</p>
            <div className="flex flex-wrap gap-4 text-xs text-muted mb-3">
              <Tag>Weather: {s.config.weatherKey}</Tag>
              <Tag>Volume: {s.config.volumeKey}</Tag>
              <Tag>Duration: {s.duration}s</Tag>
              <Tag>Seed: {s.config.seed}</Tag>
              {s.events?.length ? <Tag>Scripted events: {s.events.length}</Tag> : null}
            </div>
            <div className="flex gap-2 mb-4">
              <button className="btn-primary" onClick={() => runScenario(s)} disabled={busyId === s.id}>
                <Play size={14} /> {busyId === s.id ? 'Running…' : 'Run & compare'}
              </button>
              {r && (
                <button className="btn" onClick={() => resetScenario(s.id)}>
                  <RotateCcw size={14} /> Reset
                </button>
              )}
            </div>

            {comparison && (
              <table className="w-full text-sm">
                <thead className="text-muted text-xs">
                  <tr className="border-b border-line">
                    <th className="text-left py-2">Metric</th>
                    <th className="text-right">Fixed</th>
                    <th className="text-right">Adaptive</th>
                    <th className="text-right">Improvement</th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.map((row) => (
                    <tr key={row.key} className="border-b border-line/50">
                      <td className="py-1.5">{row.label}</td>
                      <td className="text-right font-mono">{fmt(row.fixedValue)}</td>
                      <td className="text-right font-mono">{fmt(row.adaptiveValue)}</td>
                      <td className="text-right font-mono">{improvementCell(row.improvement)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>
        )
      })}
    </div>
  )
}

function Tag({ children }) {
  return <span className="bg-panel-2 border border-line rounded px-2 py-1 capitalize">{children}</span>
}

function improvementCell(imp) {
  if (imp == null) return <span className="text-muted">n/a</span>
  const color = imp > 0.05 ? 'text-signal-green' : imp < -0.05 ? 'text-danger' : 'text-muted'
  const sign = imp > 0 ? '+' : ''
  return <span className={color}>{sign}{imp.toFixed(1)}%</span>
}

function fmt(n) {
  return Number.isFinite(n) ? n.toFixed(1) : '0.0'
}
