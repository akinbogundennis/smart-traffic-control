// Scenario runner.
//
// Runs a scenario headlessly (no rendering) for a given controller mode, using
// the scenario's fixed inputs and seed so both modes see identical traffic.
// Returns the final metrics summary, enabling an apples-to-apples comparison
// (prompt sections 10 and 11).

import { createEngine, runFor, injectEmergency, snapshot } from '../simulation/SimulationEngine.js'
import { FIXED_DT } from '../utils/constants.js'

// Run one controller mode against a scenario. Honors scripted events (e.g. an
// emergency injection at a given time) by stepping in segments.
export function runScenarioMode(scenario, mode) {
  const engine = createEngine({ ...scenario.config, mode })

  const events = [...(scenario.events ?? [])].sort((a, b) => a.at - b.at)
  let last = 0
  for (const ev of events) {
    const segment = Math.max(0, ev.at - last)
    if (segment > 0) runFor(engine, segment)
    last = ev.at
    if (ev.type === 'emergency') injectEmergency(engine, ev.dir)
  }
  const remaining = Math.max(0, scenario.duration - last)
  if (remaining > 0) runFor(engine, remaining)

  const snap = snapshot(engine)
  return { mode, metrics: snap.metrics, history: snap.history }
}

// Run both fixed and adaptive against the scenario and return both results.
export function compareScenario(scenario) {
  const fixed = runScenarioMode(scenario, 'fixed')
  const adaptive = runScenarioMode(scenario, 'adaptive')
  return { scenario: scenario.id, fixed, adaptive }
}

export { FIXED_DT }
