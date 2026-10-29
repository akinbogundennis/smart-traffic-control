// Emergency vehicle priority controller.
//
// Layers on top of whichever base controller (fixed or adaptive) is active.
// When an emergency vehicle is present, it tries to give that vehicle's
// approach a green AS SOON AS SAFE, without ever creating a conflicting green
// (prompt section 8).
//
// Safe handling:
//  - If the emergency approach already has green, do nothing (let it pass).
//  - Otherwise, request a phase change to the emergency phase. The shared
//    TrafficSignal guarantees the switch still runs through yellow + all-red,
//    so the emergency never crosses a conflicting green.
//  - A minimum green on the current phase is still respected to avoid unsafe
//    truncation; the request is issued and the signal transitions when able.
//
// Response time is measured from when the emergency is injected to when its
// approach receives green.

import { phaseOfDirection, TIMING } from '../utils/constants.js'
import { isInGreen, requestPhaseChange } from '../simulation/TrafficSignal.js'

export function createEmergencyController() {
  return {
    active: null, // { dir, phase, requestedAt, grantedAt }
    processed: 0, // count of emergencies fully handled
    responseTimes: [], // seconds from request to green, per event
  }
}

// Inject an emergency request for a direction.
export function injectEmergency(ctrl, dir, simTime) {
  // Ignore if one is already in progress for the same phase.
  const phase = phaseOfDirection(dir)
  if (ctrl.active && ctrl.active.phase === phase) return false
  ctrl.active = { dir, phase, requestedAt: simTime, grantedAt: null }
  return true
}

// Called each step. Returns an event description or null. `basePreempted` is
// set true when we issue a phase-change request so the base controller knows
// to stand down this step.
export function emergencyDecide(ctrl, signal, { simTime, weather }) {
  if (!ctrl.active) return { preempt: false, event: null }

  const { phase } = ctrl.active

  // Already serving the emergency phase with green?
  if (signal.phaseKey === phase && isInGreen(signal)) {
    if (ctrl.active.grantedAt == null) {
      ctrl.active.grantedAt = simTime
      ctrl.responseTimes.push(simTime - ctrl.active.requestedAt)
      return {
        preempt: true,
        event: { type: 'emergencyGranted', dir: ctrl.active.dir, responseTime: simTime - ctrl.active.requestedAt },
      }
    }
    return { preempt: true, event: null }
  }

  // Not yet on the emergency phase. Request a safe transition if we're in a
  // stable green and the minimum green has elapsed (keeps the switch safe).
  if (isInGreen(signal) && signal.greenElapsed >= Math.min(TIMING.minGreen, 4)) {
    const requested = requestPhaseChange(signal, phase, TIMING.defaultGreen, weather)
    if (requested) {
      return {
        preempt: true,
        event: { type: 'emergencyPreempt', dir: ctrl.active.dir },
      }
    }
  }

  // Transition already in progress or waiting for min green: hold base control.
  return { preempt: true, event: null }
}

// Clear the emergency once its vehicle has left the intersection. The engine
// calls this when no emergency vehicle remains on that approach.
export function clearEmergency(ctrl) {
  if (ctrl.active && ctrl.active.grantedAt != null) {
    ctrl.processed += 1
  }
  ctrl.active = null
}

export function avgResponseTime(ctrl) {
  if (ctrl.responseTimes.length === 0) return 0
  return ctrl.responseTimes.reduce((s, t) => s + t, 0) / ctrl.responseTimes.length
}
