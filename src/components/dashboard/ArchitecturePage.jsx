import { Network, GitBranch, Workflow, Cpu } from 'lucide-react'
import Panel from '../common/Panel.jsx'

// System architecture page (prompt section 15). Presents the component diagram,
// data flow, simulation workflow, and controller decision workflow. Diagrams
// are shown as readable ASCII/box layouts so no extra runtime dependency is
// required; the same diagrams exist as Mermaid in the README.

export default function ArchitecturePage() {
  return (
    <div className="flex flex-col gap-5">
      <Panel title="Component Architecture" icon={Network}>
        <Diagram>{COMPONENT_DIAGRAM}</Diagram>
        <p className="text-sm text-muted mt-3">
          UI components never contain simulation logic. They read snapshots from the
          engine and dispatch operator actions back to it.
        </p>
      </Panel>

      <Panel title="Data Flow" icon={GitBranch}>
        <Diagram>{DATA_FLOW}</Diagram>
        <p className="text-sm text-muted mt-3">
          Unidirectional flow: generated vehicles move, virtual sensors read their
          state, the controller sets signal phases, and the signals feed back into
          vehicle movement. Metrics observe the whole loop.
        </p>
      </Panel>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Panel title="Simulation Step Workflow" icon={Workflow}>
          <Diagram>{SIM_WORKFLOW}</Diagram>
        </Panel>
        <Panel title="Adaptive Controller Decision" icon={Cpu}>
          <Diagram>{CONTROLLER_WORKFLOW}</Diagram>
        </Panel>
      </div>
    </div>
  )
}

function Diagram({ children }) {
  return (
    <pre className="bg-[#0d1218] border border-line rounded-lg p-4 text-[11px] leading-relaxed text-accent/90 overflow-x-auto font-mono">
      {children}
    </pre>
  )
}

const COMPONENT_DIAGRAM = `┌───────────────────────── React UI (components/) ─────────────────────────┐
│  SimulationPage   AnalyticsPage   ScenarioPage   ArchitecturePage          │
│      │                │                │                                   │
│  ControlPanel   LiveMetrics/Charts   ComparisonView                        │
└──────┼────────────────┼────────────────┼──────────────────────────────────┘
       │ actions        │ snapshot       │ run headless
       ▼                ▲                ▼
┌───────────────────────── useSimulation (hooks/) ─────────────────────────┐
└──────┼───────────────────────────────────────────────────────────────────┘
       ▼
┌────────────────────── SimulationEngine (simulation/) ─────────────────────┐
│  SimulationClock · VehicleGenerator · VehicleMovement · TrafficSensors     │
│  TrafficSignal                                                             │
│          │                                                                 │
│          ▼                                                                 │
│  controllers/  FixedTimeController · AdaptiveController · Emergency…        │
│  analytics/    MetricsCalculator · ComparisonEngine                        │
└────────────────────────────────────────────────────────────────────────────┘`

const DATA_FLOW = `VehicleGenerator ─▶ Vehicles ─▶ VehicleMovement ─▶ TrafficSensors
                                      ▲                    │
                                      │                    ▼
                               Signal lights ◀── TrafficSignal ◀── Controller
                                                                     (fixed /
                                                                      adaptive /
                                                                      emergency)
          MetricsCalculator observes vehicles, queues, and events.`

const SIM_WORKFLOW = `1. Generate arrivals (seeded RNG)
2. Advance signal timers (yellow / all-red)
3. Move vehicles under current lights
4. Read virtual sensors from vehicle state
5. Emergency priority? → safe preempt
   else fixed / adaptive decision
6. Record metrics + events
7. Remove exited vehicles`

const CONTROLLER_WORKFLOW = `in GREEN?
  ├─ no  → wait (signal handles
  │         yellow → all-red)
  └─ yes → waiting phase starved?
            ├─ yes → switch (anti-starvation)
            └─ no  → active approach clear?
                      ├─ yes → switch
                      └─ no  → opposing demand
                               ≥ active + margin?
                                 ├─ yes → switch
                                 └─ no  → green served?
                                           ├─ yes → switch
                                           └─ no  → extend green`
