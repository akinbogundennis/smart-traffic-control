// Traffic signal state machine.
//
// Owns the current signal phase and enforces the safety sequence that BOTH
// controllers must obey:
//
//   GREEN (phase A) -> YELLOW (phase A) -> ALL_RED -> GREEN (phase B) -> ...
//
// Invariants:
//  - Only one phase group (NS or EW) is ever green or yellow; the other is red.
//  - Every green ends with yellow then an all-red clearance before the next
//    green starts. Conflicting greens are therefore impossible (NFR-01, NFR-02).
//
// The signal does NOT decide how long a green should last - a controller tells
// it when to begin ending the current phase and what the next green's duration
// should be. The signal just runs the safe transition mechanics.

import { LIGHT, STAGE, PHASES } from '../utils/constants.js'

export function createSignal(startPhase = 'NS') {
  return {
    phaseKey: startPhase,
    stage: STAGE.GREEN,
    stageTimeLeft: 0, // seconds left in yellow/all-red; green is ended by controller
    greenElapsed: 0, // how long the current green has been active
    nextPhaseKey: null, // phase to start after the pending all-red
    pendingGreenDuration: 0, // requested green duration for the next phase
  }
}

// Resolve the light shown to each direction given the current signal state.
export function lightMap(signal) {
  const map = { north: LIGHT.RED, south: LIGHT.RED, east: LIGHT.RED, west: LIGHT.RED }
  if (signal.stage === STAGE.ALL_RED) return map
  const active = signal.stage === STAGE.GREEN ? LIGHT.GREEN : LIGHT.YELLOW
  for (const dir of PHASES[signal.phaseKey]) map[dir] = active
  return map
}

// Begin ending the current green: enter YELLOW, then ALL_RED, then switch to
// `nextPhaseKey` with the given green duration. Safe to call only while GREEN;
// ignored otherwise so a transition can't be interrupted mid-clearance.
export function requestPhaseChange(signal, nextPhaseKey, greenDuration, weather) {
  if (signal.stage !== STAGE.GREEN) return false
  signal.stage = STAGE.YELLOW
  signal.stageTimeLeft = weather.yellow
  signal.nextPhaseKey = nextPhaseKey
  signal.pendingGreenDuration = greenDuration
  return true
}

// Extend the current green (adaptive controllers call this to keep serving a
// busy approach). No-op unless currently green.
export function extendGreen(signal) {
  // Green has no countdown of its own; the controller decides when to end it.
  // This exists for clarity/logging symmetry.
  return signal.stage === STAGE.GREEN
}

// Advance the signal by dt seconds. Returns an event string when a stage
// boundary is crossed (for the event log), else null.
export function stepSignal(signal, dt, weather) {
  if (signal.stage === STAGE.GREEN) {
    signal.greenElapsed += dt
    return null
  }

  signal.stageTimeLeft -= dt
  if (signal.stageTimeLeft > 0) return null

  if (signal.stage === STAGE.YELLOW) {
    signal.stage = STAGE.ALL_RED
    signal.stageTimeLeft = weather.allRed
    return 'allRed'
  }

  // ALL_RED finished -> start the next green.
  signal.phaseKey = signal.nextPhaseKey
  signal.stage = STAGE.GREEN
  signal.greenElapsed = 0
  signal.stageTimeLeft = 0
  signal.nextPhaseKey = null
  const dur = signal.pendingGreenDuration
  signal.pendingGreenDuration = 0
  return { event: 'greenStart', phase: signal.phaseKey, duration: dur }
}

// Is the signal idle in a stable green (safe point for a controller to decide)?
export function isInGreen(signal) {
  return signal.stage === STAGE.GREEN
}

// Is a transition currently in progress (yellow or all-red)?
export function isTransitioning(signal) {
  return signal.stage !== STAGE.GREEN
}
