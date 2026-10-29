import { useState } from 'react'
import { useSimulation } from '../../hooks/useSimulation.js'
import IntersectionCanvas from '../intersection/IntersectionCanvas.jsx'
import ControlPanel from '../controls/ControlPanel.jsx'
import LiveMetrics from './LiveMetrics.jsx'
import EventLog from './EventLog.jsx'
import LiveCharts from '../analytics/LiveCharts.jsx'

// The main operations screen: controls (left), intersection (center),
// live metrics (right), charts + event log (bottom).

export default function SimulationPage() {
  const sim = useSimulation()
  const [showSensors, setShowSensors] = useState(true)

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 xl:grid-cols-[300px_minmax(0,1fr)_320px] gap-5 items-stretch">
        <ControlPanel
          config={sim.config}
          running={sim.running}
          speed={sim.speed}
          snap={sim.snap}
          showSensors={showSensors}
          onStart={sim.start}
          onPause={sim.pause}
          onReset={sim.reset}
          onSpeed={sim.setSimSpeed}
          onChange={sim.changeConfig}
          onEmergency={sim.triggerEmergency}
          onToggleSensors={setShowSensors}
        />

        <div className="bg-panel border border-line rounded-xl p-4 flex items-center justify-center">
          <div className="w-full max-w-[640px]">
            <IntersectionCanvas snap={sim.snap} showSensors={showSensors} />
          </div>
        </div>

        <LiveMetrics snap={sim.snap} />
      </div>

      <LiveCharts snap={sim.snap} />
      <EventLog snap={sim.snap} />
    </div>
  )
}
