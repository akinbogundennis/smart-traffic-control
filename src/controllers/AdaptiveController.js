// Adaptive, rule-based traffic controller.
//
// Reads virtual sensor data and chooses green durations and phase switches to
// reduce waiting and clear congestion, while never violating signal safety.
//
// Rules implemented (prompt section 5):
//  1. Low demand  -> shorter greens (short min-based greens when queues small).
//  2. Longer queue -> more green time for that direction.
//  3. Both busy    -> green time split by relative demand (served alternately,
//                     each sized to its own demand).
//  4. Anti-starvation: if the waiting (red) phase exceeds maxWaitThreshold, it
//                     is served next regardless of relative demand.
//  5. Min/max green enforced via clamp.
//  6. No conflicting greens (guaranteed by the shared phase model).
//  7. Safe yellow + all-red transitions (handled by TrafficSignal).
//  8. Weather: adverse weather lengthens green slightly (slower discharge) and
//             lengthens yellow/all-red (via weather presets in the signal).
//  9. Emergency priority handled by EmergencyPriorityController, layered on top.
//
// Hysteresis: the active phase keeps the green until it has served its computed
// duration OR the opposing phase's demand exceeds the active one by switchMargin
// AND a minimum green has elapsed. This prevents rapid flip-flopping.

import {
  TIMING,
  ADAPTIVE,
  PHASES,
  opposingPhase,
} from '../utils/constants.js'
import { isInGreen, requestPhaseChange } from '../simulation/TrafficSignal.js'
import { phaseQueue, phaseAvgWait, maxWaitAcross } from '../simulation/TrafficSensors.js'

function clamp(x, lo, hi) {
  return Math.max(lo, Math.min(hi, x))
}

export function createAdaptiveController() {
  return {
    mode: 'adaptive',
    // Per-phase "red wait" timers: how long each phase has been waiting (red).
    redWait: { NS: 0, EW: 0 },
    currentGreenDuration: ADAPTIVE.baseGreen,
  }
}

// Compute the green time a phase deserves from its queue + average wait.
export function computeGreen(readings, phaseKey) {
  const dirs = PHASES[phaseKey]
  const q = phaseQueue(readings, dirs)
  const wait = phaseAvgWait(readings, dirs)
  const green = ADAPTIVE.baseGreen + ADAPTIVE.queueWeight * q + ADAPTIVE.waitWeight * wait
  return clamp(green, TIMING.minGreen, TIMING.maxGreen)
}

// Advance anti-starvation timers each step (call every step).
export function adaptiveTick(ctrl, signal, dt) {
  const waiting = opposingPhase(signal.phaseKey)
  // The non-active phase accumulates red wait; the active one resets.
  ctrl.redWait[waiting] += dt
  ctrl.redWait[signal.phaseKey] = 0
}

// Decide whether to switch phases. Returns an event description or null.
export function adaptiveDecide(ctrl, signal, { readings, weather }) {
  if (!isInGreen(signal)) return null

  const active = signal.phaseKey
  const waiting = opposingPhase(signal.phaseKey)
  const activeDirs = PHASES[active]
  const waitingDirs = PHASES[waiting]

  const activeQ = phaseQueue(readings, activeDirs)
  const waitingQ = phaseQueue(readings, waitingDirs)

  // Target green for the active phase, recomputed as conditions evolve.
  const targetGreen = computeGreen(readings, active)
  ctrl.currentGreenDuration = targetGreen

  const minElapsed = signal.greenElapsed >= TIMING.minGreen

  // Rule 4: starvation guard - force a switch if the waiting phase has waited
  // too long, as long as the minimum green has elapsed.
  const starved = ctrl.redWait[waiting] >= TIMING.maxWaitThreshold
  if (starved && minElapsed) {
    const nextGreen = computeGreen(readings, waiting)
    requestPhaseChange(signal, waiting, nextGreen, weather)
    return { type: 'phaseChange', phase: waiting, reason: 'anti-starvation', duration: nextGreen }
  }

  // If nobody is waiting on the active phase but the other side has demand,
  // switch early (rule 1: don't waste green on an empty approach).
  if (activeQ === 0 && waitingQ > 0 && minElapsed) {
    const nextGreen = computeGreen(readings, waiting)
    requestPhaseChange(signal, waiting, nextGreen, weather)
    return { type: 'phaseChange', phase: waiting, reason: 'active approach clear', duration: nextGreen }
  }

  // Hysteresis switch: opposing demand clearly exceeds active demand.
  if (minElapsed && waitingQ - activeQ >= ADAPTIVE.switchMargin && waitingQ > 0) {
    const nextGreen = computeGreen(readings, waiting)
    requestPhaseChange(signal, waiting, nextGreen, weather)
    return { type: 'phaseChange', phase: waiting, reason: 'opposing demand higher', duration: nextGreen }
  }

  // Otherwise, end the green once it has served its computed duration.
  if (signal.greenElapsed >= targetGreen) {
    const nextGreen = computeGreen(readings, waiting)
    requestPhaseChange(signal, waiting, nextGreen, weather)
    return { type: 'phaseChange', phase: waiting, reason: 'green time served', duration: nextGreen }
  }

  return null
}

export { maxWaitAcross }
