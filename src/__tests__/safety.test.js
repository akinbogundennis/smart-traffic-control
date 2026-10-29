// Safety tests: signal invariants that must always hold.

import { describe, it, expect } from 'vitest'
import { createEngine, runFor, snapshot } from '../simulation/SimulationEngine.js'
import { createSignal, lightMap, stepSignal, requestPhaseChange } from '../simulation/TrafficSignal.js'
import { LIGHT, STAGE, WEATHER, PHASES } from '../utils/constants.js'

describe('signal safety invariants', () => {
  it('never shows green to conflicting directions simultaneously', () => {
    const engine = createEngine({ mode: 'adaptive', volumeKey: 'rush', totalRate: 1.2, seed: 'safety-1' })
    // Step the whole simulation and check the light map at every snapshot.
    for (let t = 0; t < 300; t++) {
      runFor(engine, 1)
      const { lights } = snapshot(engine)
      const nsGreen = PHASES.NS.some((d) => lights[d] === LIGHT.GREEN || lights[d] === LIGHT.YELLOW)
      const ewGreen = PHASES.EW.some((d) => lights[d] === LIGHT.GREEN || lights[d] === LIGHT.YELLOW)
      expect(nsGreen && ewGreen).toBe(false)
    }
  })

  it('transitions follow green -> yellow -> all-red -> next green', () => {
    const weather = WEATHER.clear
    const signal = createSignal('NS')
    expect(signal.stage).toBe(STAGE.GREEN)

    // Request a change; must enter YELLOW first.
    requestPhaseChange(signal, 'EW', 20, weather)
    expect(signal.stage).toBe(STAGE.YELLOW)

    // Run the yellow out -> ALL_RED.
    stepSignal(signal, weather.yellow + 0.001, weather)
    expect(signal.stage).toBe(STAGE.ALL_RED)

    // During all-red, every direction is red.
    const allRedLights = lightMap(signal)
    expect(Object.values(allRedLights).every((l) => l === LIGHT.RED)).toBe(true)

    // Run the all-red out -> next GREEN on EW.
    stepSignal(signal, weather.allRed + 0.001, weather)
    expect(signal.stage).toBe(STAGE.GREEN)
    expect(signal.phaseKey).toBe('EW')
  })

  it('cannot interrupt a transition with another phase-change request', () => {
    const weather = WEATHER.clear
    const signal = createSignal('NS')
    expect(requestPhaseChange(signal, 'EW', 20, weather)).toBe(true)
    // Already in YELLOW now; a second request must be ignored.
    expect(requestPhaseChange(signal, 'NS', 20, weather)).toBe(false)
  })
})
