// Simulation clock.
//
// Converts irregular real-time animation frames into a stream of fixed-size
// simulation steps. This keeps the physics deterministic regardless of frame
// rate or chosen simulation speed (1x / 2x / 5x), so results stay comparable
// (prompt section 9: "consistent simulation clock and time-step updates so
// simulation speed changes do not distort results").

import { FIXED_DT } from '../utils/constants.js'

export function createClock() {
  return {
    simTime: 0, // total simulated seconds elapsed
    accumulator: 0, // leftover real-scaled time awaiting a full step
  }
}

// Given `realDelta` seconds since the last frame and the current `speed`
// multiplier, return how many fixed steps to run. Each step advances the world
// by FIXED_DT simulated seconds. Caps steps to avoid a "spiral of death" if the
// tab was backgrounded.
export function advance(clock, realDelta, speed) {
  clock.accumulator += realDelta * speed
  let steps = 0
  const maxSteps = 240 // safety cap per frame
  while (clock.accumulator >= FIXED_DT && steps < maxSteps) {
    clock.accumulator -= FIXED_DT
    clock.simTime += FIXED_DT
    steps += 1
  }
  // Drop any excess if we hit the cap (prevents runaway catch-up).
  if (steps >= maxSteps) clock.accumulator = 0
  return steps
}

export function resetClock(clock) {
  clock.simTime = 0
  clock.accumulator = 0
}
