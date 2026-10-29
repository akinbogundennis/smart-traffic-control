import { Info } from 'lucide-react'
import Panel from '../common/Panel.jsx'
import { TIMING, ADAPTIVE } from '../../utils/constants.js'

// About / project documentation page (prompt sections 15).

export default function AboutPage() {
  return (
    <div className="flex flex-col gap-5">
      <Panel title="About This Project" icon={Info}>
        <div className="prose-sm max-w-3xl text-sm text-ink/90 space-y-4">
          <p>
            <strong>Smart Traffic Light Control Simulation</strong> models an
            intelligent traffic management system at a four-lane highway
            intersection. It compares a traditional fixed-time signal controller
            against an adaptive, rule-based controller that responds to simulated
            sensor data, weather, and emergency vehicles.
          </p>

          <Section title="Problem statement">
            Fixed-timer signals change at preset intervals regardless of demand,
            creating avoidable delay when traffic is uneven. This simulation tests
            whether a rule-based adaptive controller can measurably reduce waiting
            time and queue length while preserving signal safety.
          </Section>

          <Section title="Objectives">
            <ul className="list-disc pl-5 space-y-1">
              <li>Model vehicle arrivals, movement, queues, and signal states.</li>
              <li>Implement fixed-time and adaptive controllers sharing one safe signal model.</li>
              <li>Account for weather in both movement and signal timing.</li>
              <li>Provide emergency vehicle priority without conflicting greens.</li>
              <li>Compare both controllers on identical, reproducible traffic.</li>
            </ul>
          </Section>

          <Section title="Rule-based adaptive algorithm">
            <p>Green time is computed from live sensor data:</p>
            <pre className="bg-[#0d1218] border border-line rounded p-3 text-xs font-mono text-accent/90">
greenTime = clamp(
  {ADAPTIVE.baseGreen} + {ADAPTIVE.queueWeight} × queueLength
         + {ADAPTIVE.waitWeight} × avgWait,
  {TIMING.minGreen}s, {TIMING.maxGreen}s
)
            </pre>
            <p>
              Hysteresis (a switch margin and a minimum green) prevents rapid
              flip-flopping, and an anti-starvation guard forces a switch if a phase
              has waited past {TIMING.maxWaitThreshold}s.
            </p>
          </Section>

          <Section title="Simulation assumptions & limitations">
            <ul className="list-disc pl-5 space-y-1">
              <li>Timings are configurable simulation assumptions, not validated traffic-engineering standards.</li>
              <li>Vehicles travel straight through; no turning movements or lane changes.</li>
              <li>Weather effects are simplified rules, not a real safety model.</li>
              <li>A single isolated intersection is modeled (no network coordination).</li>
            </ul>
          </Section>
        </div>
      </Panel>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div>
      <h3 className="text-base font-semibold mb-1.5">{title}</h3>
      <div className="text-muted">{children}</div>
    </div>
  )
}
