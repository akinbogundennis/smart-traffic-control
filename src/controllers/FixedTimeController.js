// Fixed-time traffic controller.
//
// The traditional baseline: a predefined cycle with a constant green duration
// regardless of traffic. It still obeys the safety sequence (green -> yellow ->
// all-red) via the shared TrafficSignal, and processes vehicles with the same
// movement rules as the adaptive controller. It simply ignores queue length
// when choosing green durations (prompt section 6).

import { TIMING, opposingPhase } from '../utils/constants.js'
import { isInGreen, requestPhaseChange } from '../simulation/TrafficSignal.js'

export function createFixedController() {
  return { mode: 'fixed', greenDuration: TIMING.defaultGreen }
}

// Decide what to do this step. Returns an event description (or null). The
// controller only acts while the signal is in a stable green; transitions are
// handled by the signal itself.
export function fixedDecide(ctrl, signal, { weather }) {
  if (!isInGreen(signal)) return null

  // End the green once it has run for the fixed duration; alternate phases.
  if (signal.greenElapsed >= ctrl.greenDuration) {
    const next = opposingPhase(signal.phaseKey)
    requestPhaseChange(signal, next, ctrl.greenDuration, weather)
    return { type: 'phaseChange', phase: next, reason: 'fixed cycle', duration: ctrl.greenDuration }
  }
  return null
}
