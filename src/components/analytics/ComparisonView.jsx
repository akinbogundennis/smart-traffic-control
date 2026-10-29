import { useState } from 'react'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
import { GitCompare, Play } from 'lucide-react'
import Panel from '../common/Panel.jsx'
import { SCENARIOS } from '../../scenarios/scenarioDefinitions.js'
import { compareScenario } from '../../scenarios/ScenarioRunner.js'
import { buildComparison } from '../../analytics/ComparisonEngine.js'

// Runs BOTH controllers against the same scenario (identical seed/inputs) and
// shows the metric comparison table and overlaid time-series charts. Results
// are computed live from headless simulation runs - never hardcoded.

export default function ComparisonView() {
  const [scenarioId, setScenarioId] = useState(SCENARIOS[0].id)
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)

  const run = () => {
    setBusy(true)
    // Defer so the UI can show the busy state before the (sync) run.
    setTimeout(() => {
      const scenario = SCENARIOS.find((s) => s.id === scenarioId)
      const r = compareScenario(scenario)
      setResult(r)
      setBusy(false)
    }, 20)
  }

  const comparison = result
    ? buildComparison(result.fixed.metrics, result.adaptive.metrics)
    : null

  // Merge the two histories by timestamp for overlaid charts.
  const merged = result ? mergeHistories(result.fixed.history, result.adaptive.history) : []

  return (
    <div className="flex flex-col gap-5">
      <Panel title="Controller Comparison" icon={GitCompare}>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <div className="text-xs text-muted mb-1.5">Scenario</div>
            <select
              className="input w-64"
              value={scenarioId}
              onChange={(e) => setScenarioId(e.target.value)}
            >
              {SCENARIOS.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <button className="btn-primary" onClick={run} disabled={busy}>
            <Play size={15} /> {busy ? 'Running…' : 'Run both controllers'}
          </button>
        </div>
        <p className="hint max-w-2xl">
          Both controllers run headlessly against the exact same traffic arrivals,
          weather, duration, and random seed, so the comparison is fair. Adaptive
          may not always win - results are reported as measured.
        </p>
      </Panel>

      {comparison && (
        <Panel title="Results">
          <table className="w-full text-sm">
            <thead className="text-muted text-xs">
              <tr className="border-b border-line">
                <th className="text-left py-2">Metric</th>
                <th className="text-right">Fixed-Time</th>
                <th className="text-right">Adaptive</th>
                <th className="text-right">Improvement</th>
              </tr>
            </thead>
            <tbody>
              {comparison.map((row) => (
                <tr key={row.key} className="border-b border-line/50">
                  <td className="py-2">{row.label}</td>
                  <td className="text-right font-mono">{fmt(row.fixedValue)} {row.unit}</td>
                  <td className="text-right font-mono">{fmt(row.adaptiveValue)} {row.unit}</td>
                  <td className="text-right font-mono">{improvementCell(row.improvement)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}

      {merged.length > 0 && (
        <Panel title="Fixed vs Adaptive over time">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <CompareChart data={merged} keyA="waitFixed" keyB="waitAdaptive" title="Average waiting time (s)" />
            <CompareChart data={merged} keyA="queueFixed" keyB="queueAdaptive" title="Queue length (cars)" />
          </div>
        </Panel>
      )}
    </div>
  )
}

function CompareChart({ data, keyA, keyB, title }) {
  return (
    <div>
      <div className="text-xs text-muted mb-2">{title}</div>
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid stroke="#2d3a4a" strokeDasharray="3 3" />
            <XAxis dataKey="t" stroke="#93a1b3" fontSize={10} unit="s" />
            <YAxis stroke="#93a1b3" fontSize={10} />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line name="Fixed" type="monotone" dataKey={keyA} stroke="#ff8a5b" strokeWidth={2} dot={false} isAnimationActive={false} />
            <Line name="Adaptive" type="monotone" dataKey={keyB} stroke="#3ddc84" strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function mergeHistories(fixed, adaptive) {
  const map = new Map()
  for (const p of fixed) map.set(p.t, { t: p.t, waitFixed: p.avgWait, queueFixed: p.queue })
  for (const p of adaptive) {
    const e = map.get(p.t) ?? { t: p.t }
    e.waitAdaptive = p.avgWait
    e.queueAdaptive = p.queue
    map.set(p.t, e)
  }
  return [...map.values()].sort((a, b) => a.t - b.t)
}

function improvementCell(imp) {
  if (imp == null) return <span className="text-muted">n/a</span>
  const better = imp > 0.05
  const worse = imp < -0.05
  const color = better ? 'text-signal-green' : worse ? 'text-danger' : 'text-muted'
  const sign = imp > 0 ? '+' : ''
  return <span className={color}>{sign}{imp.toFixed(1)}%</span>
}

function fmt(n) {
  return Number.isFinite(n) ? n.toFixed(1) : '0.0'
}

const tooltipStyle = {
  background: '#1b2430',
  border: '1px solid #2d3a4a',
  borderRadius: 8,
  fontSize: 12,
  color: '#e6ecf3',
}
