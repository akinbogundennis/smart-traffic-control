// Engine-level tests: reproducibility, emergency safety, reset.

import { describe, it, expect } from 'vitest'
import { createEngine, runFor, snapshot, resetEngine, injectEmergency } from '../simulation/SimulationEngine.js'
import { runScenarioMode } from '../scenarios/ScenarioRunner.js'
import { getScenario } from '../scenarios/scenarioDefinitions.js'
import { LIGHT, PHASES, phaseOfDirection } from '../utils/constants.js'

describe('reproducibility', () => {
  it('identical seed + inputs produce identical arrivals and metrics', () => {
    const cfg = { mode: 'adaptive', volumeKey: 'normal', totalRate: 0.6, seed: 'repro-7' }
    const a = createEngine(cfg)
    const b = createEngine(cfg)
    runFor(a, 120)
    runFor(b, 120)
    const ma = snapshot(a).metrics
    const mb = snapshot(b).metrics
    expect(ma.generated).toBe(mb.generated)
    expect(ma.processed).toBe(mb.processed)
    expect(ma.avgWait).toBeCloseTo(mb.avgWait, 6)
  })

  it('comparison runs use identical traffic arrivals for both modes', () => {
    const scenario = getScenario('rush')
    const fixed = runScenarioMode(scenario, 'fixed')
    const adaptive = runScenarioMode(scenario, 'adaptive')
    // Same arrival schedule => same number of vehicles generated.
    expect(fixed.metrics.generated).toBe(adaptive.metrics.generated)
  })
})

describe('emergency priority safety', () => {
  it('never shows the emergency approach a conflicting green mid-transition', () => {
    const engine = createEngine({ mode: 'adaptive', volumeKey: 'normal', totalRate: 0.5, seed: 'em-1' })
    runFor(engine, 10)
    injectEmergency(engine, 'east')
    const emPhase = phaseOfDirection('east')
    for (let i = 0; i < 60; i++) {
      runFor(engine, 0.5)
      const { lights } = snapshot(engine)
      const nsActive = PHASES.NS.some((d) => lights[d] !== LIGHT.RED)
      const ewActive = PHASES.EW.some((d) => lights[d] !== LIGHT.RED)
      // The two phase groups are never both active.
      expect(nsActive && ewActive).toBe(false)
    }
    // Eventually the emergency phase should get green.
    let served = false
    for (let i = 0; i < 120 && !served; i++) {
      runFor(engine, 0.5)
      const { lights } = snapshot(engine)
      if (PHASES[emPhase].every((d) => lights[d] === LIGHT.GREEN)) served = true
    }
    expect(served).toBe(true)
  })
})

describe('reset restores initial state', () => {
  it('reset returns sim time, vehicles, and metrics to zero', () => {
    const engine = createEngine({ mode: 'adaptive', volumeKey: 'rush', totalRate: 1.0, seed: 'reset-1' })
    runFor(engine, 60)
    expect(snapshot(engine).metrics.generated).toBeGreaterThan(0)
    resetEngine(engine)
    const s = snapshot(engine)
    expect(s.simTime).toBe(0)
    expect(s.vehicles.length).toBe(0)
    expect(s.metrics.generated).toBe(0)
    expect(s.metrics.processed).toBe(0)
  })
})
