// Vehicle movement engine.
//
// Advances every vehicle each simulation step with simple, deterministic
// longitudinal dynamics (no lane changes; one lane per vehicle for its life):
//
//  - Free flow:   accelerate toward the weather-adjusted target speed.
//  - Car-following: never close the gap to the vehicle ahead below minGap;
//                   decelerate to avoid overlap (prevents collisions).
//  - Signal:      if the light is not green and the vehicle has not yet passed
//                 the stop line, it must stop at the stop line. Once past the
//                 stop line it is committed and clears the intersection.
//  - Status:      APPROACHING -> QUEUED (stopped at red) -> MOVING ->
//                 CROSSING (in the box) -> EXITED (off the far side).
//
// Waiting time accrues whenever a vehicle is effectively stopped before the
// stop line. All motion is along the approach's travel axis; lane offset is
// fixed, so collisions only need to be checked within the same (dir, lane).

import {
  LIGHT,
  VEHICLE,
  VEHICLE_STATUS,
  WEATHER,
} from '../utils/constants.js'
import {
  stopLineAlong,
  pastStopLine,
  clearedIntersection,
  travelAxis,
} from '../utils/geometry.js'

// Signed "forward" progress for a direction: larger `prog` = further along the
// path toward and past the centre. Normalizes the four directions so the
// following/stopping math is identical for all of them.
function progress(dir, along) {
  switch (dir) {
    case 'north': // moves +y
    case 'west': // moves +x
      return along
    case 'south': // moves -y
    case 'east': // moves -x
      return -along
    default:
      return along
  }
}

// Convert a forward distance back into an `along` delta for the direction.
function applyForward(dir, along, forwardDelta) {
  switch (dir) {
    case 'north':
    case 'west':
      return along + forwardDelta
    case 'south':
    case 'east':
      return along - forwardDelta
    default:
      return along + forwardDelta
  }
}

// Forward distance from a vehicle to the stop line (positive = still before it).
function distanceToStopLine(dir, along) {
  return progress(dir, stopLineAlong(dir)) - progress(dir, along)
}

// Step all vehicles. Mutates vehicles in place. Returns { exited } with the
// vehicles that left this step (for metrics) and leaves EXITED ones flagged so
// the engine can remove them.
export function stepMovement(vehicles, { dt, lights, weatherKey }) {
  const weather = WEATHER[weatherKey] ?? WEATHER.clear
  const targetSpeed = VEHICLE.baseSpeed * weather.speedFactor
  const accel = VEHICLE.accel * weather.accelFactor
  const decel = VEHICLE.decel

  // Group vehicles by (dir, lane) and sort by forward progress descending so
  // the leader (closest to the intersection) is first. Car-following then just
  // looks at the vehicle immediately ahead.
  const lanes = new Map()
  for (const v of vehicles) {
    if (v.status === VEHICLE_STATUS.EXITED) continue
    const key = `${v.dir}:${v.lane}`
    if (!lanes.has(key)) lanes.set(key, [])
    lanes.get(key).push(v)
  }

  const exited = []

  for (const [, group] of lanes) {
    group.sort((a, b) => progress(b.dir, b.along) - progress(a.dir, a.along))

    for (let i = 0; i < group.length; i++) {
      const v = group[i]
      const ahead = i > 0 ? group[i - 1] : null

      const light = lights[v.dir]
      const committed = pastStopLine(v.dir, v.along)
      const emphasisSpeed = v.emergency ? targetSpeed * VEHICLE.emergencySpeedBonus : targetSpeed

      // Determine the max forward distance the vehicle may travel this step.
      let maxForward = Infinity

      // 1) Respect the vehicle ahead (keep minGap between bumpers).
      if (ahead) {
        const gap =
          progress(v.dir, ahead.along) -
          progress(v.dir, v.along) -
          (ahead.length / 2 + v.length / 2) -
          VEHICLE.minGap
        maxForward = Math.min(maxForward, Math.max(0, gap))
      }

      // 2) Respect the signal if not yet committed to crossing.
      if (!committed && light !== LIGHT.GREEN) {
        // Stop at the stop line (leave the front bumper just before it).
        const distLine = distanceToStopLine(v.dir, v.along) - v.length / 2
        // On yellow, if too close to stop safely, allow crossing (dilemma zone).
        const braking = (v.speed * v.speed) / (2 * decel) * weather.stoppingFactor
        const canStop = distLine >= braking
        if (light === LIGHT.RED || canStop) {
          maxForward = Math.min(maxForward, Math.max(0, distLine))
        }
      }

      // Desired speed: slow down if we're constrained, else accelerate to target.
      let desired = emphasisSpeed
      if (maxForward < emphasisSpeed * dt) {
        // Need to limit speed so we don't overshoot the allowed distance.
        desired = Math.max(0, maxForward / dt)
      }

      // Smoothly move current speed toward desired via accel/decel limits.
      if (desired > v.speed) {
        v.speed = Math.min(desired, v.speed + accel * dt)
      } else {
        v.speed = Math.max(desired, v.speed - decel * dt)
      }
      if (v.speed < 0.5) v.speed = 0

      const forward = Math.min(v.speed * dt, maxForward)
      v.along = applyForward(v.dir, v.along, forward)
      v.targetSpeed = desired

      // Status + waiting-time bookkeeping.
      if (clearedIntersection(v.dir, v.along)) {
        if (v.status !== VEHICLE_STATUS.EXITED) {
          v.status = VEHICLE_STATUS.EXITED
          v.exitTime = null // engine stamps sim time
          exited.push(v)
        }
      } else if (committed) {
        v.status = VEHICLE_STATUS.CROSSING
      } else if (v.speed === 0) {
        v.status = VEHICLE_STATUS.QUEUED
        v.waitTime += dt
      } else {
        v.status = VEHICLE_STATUS.MOVING
      }
    }
  }

  return { exited }
}

// Export helpers for sensors/tests.
export { progress, distanceToStopLine }
