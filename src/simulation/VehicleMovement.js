// Vehicle movement engine.
//
// Advances every vehicle each simulation step with simple, deterministic
// longitudinal dynamics (no lane changes; one lane per vehicle for its life):
//
//  - Free flow:   accelerate toward the weather-adjusted target speed.
//  - Car-following: never close the gap to the vehicle ahead below minGap;
//                   brake early enough to stop within the available gap.
//  - Signal:      a regular vehicle that has not yet passed the stop line must
//                 stop there unless its light is green. Once past the stop line
//                 it is committed and clears the intersection.
//  - Emergency:   emergency vehicles do not stop for signals. They ride the
//                 lane line between the two lanes (lane 0.5), so they pass
//                 queued traffic. They still stop for the box access plan.
//  - Access plan: IntersectionManager may hold a vehicle out of the box (a
//                 conflicting vehicle is crossing, or another vehicle has the
//                 right of way) or tell it to creep so an emergency vehicle can
//                 pass.
//  - Status:      APPROACHING -> QUEUED (stopped) -> MOVING -> CROSSING (past
//                 the stop line) -> EXITED (off the far side).
//
// Hotspot bookkeeping: while a vehicle is stopped inside the hotspot zone its
// `dwell` grows; it resets as soon as the vehicle moves. The virtual sensors
// read `dwell`, and the adaptive controller uses it to release a green early.
//
// Waiting time accrues whenever a vehicle is stopped before the stop line.
// Collisions only need checking within the same (dir, lane); crossings between
// roads are handled by IntersectionManager.

import {
  LIGHT,
  VEHICLE,
  VEHICLE_STATUS,
  WEATHER,
  INTERSECTION,
} from '../utils/constants.js'
import {
  stopLineAlong,
  pastStopLine,
  clearedIntersection,
  progress,
  gapToStopLine,
  gapToBox,
  inHotspot,
} from '../utils/geometry.js'
import { planIntersectionAccess } from './IntersectionManager.js'

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

// Forward distance from a vehicle's centre to the stop line (positive = still
// before it).
function distanceToStopLine(dir, along) {
  return progress(dir, stopLineAlong(dir)) - progress(dir, along)
}

// Step all vehicles. Mutates vehicles in place. Returns { exited } with the
// vehicles that left this step (for metrics) and leaves EXITED ones flagged so
// the engine can remove them.
export function stepMovement(vehicles, { dt, lights, weatherKey, simTime = 0 }) {
  const weather = WEATHER[weatherKey] ?? WEATHER.clear
  const targetSpeed = VEHICLE.baseSpeed * weather.speedFactor
  const accel = VEHICLE.accel * weather.accelFactor
  // Longer stopping distances in bad weather = gentler braking.
  const brakeDecel = VEHICLE.decel / weather.stoppingFactor

  // Who may enter the box, and who must slow for an emergency vehicle.
  const plan = planIntersectionAccess(vehicles, lights, simTime)

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
      const access = plan.get(v.id)

      const light = lights[v.dir]
      const committed = pastStopLine(v.dir, v.along)
      let cruise = v.emergency ? targetSpeed * VEHICLE.emergencySpeedBonus : targetSpeed
      if (access?.creep) cruise = Math.min(cruise, INTERSECTION.yieldSpeed)

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

      // 2) Respect the signal (regular vehicles only) if not yet committed.
      if (!v.emergency && !committed && light !== LIGHT.GREEN) {
        // Stop at the stop line (leave the front bumper just before it).
        const distLine = gapToStopLine(v.dir, v.along, v.length)
        // On yellow, if too close to stop safely, allow crossing (dilemma zone).
        const braking = (v.speed * v.speed) / (2 * VEHICLE.decel) * weather.stoppingFactor
        const canStop = distLine >= braking
        if (light === LIGHT.RED || canStop) {
          maxForward = Math.min(maxForward, Math.max(0, distLine))
        }
      }

      // 3) Respect the box access plan. Before the stop line, hold at the stop
      //    line; past it, hold at the box edge.
      if (access?.hold) {
        const distHold = committed
          ? gapToBox(v.dir, v.along, v.length)
          : gapToStopLine(v.dir, v.along, v.length)
        maxForward = Math.min(maxForward, Math.max(0, distHold))
      }

      // Desired speed: the cruise speed, capped so we can still stop within
      // the room we have (smooth braking instead of stopping dead).
      let desired = cruise
      if (Number.isFinite(maxForward)) {
        desired = Math.min(desired, Math.sqrt(2 * brakeDecel * maxForward))
      }

      // Move current speed toward desired via accel/brake limits.
      if (desired > v.speed) {
        v.speed = Math.min(desired, v.speed + accel * dt)
      } else {
        v.speed = Math.max(desired, v.speed - brakeDecel * dt)
      }
      // No room to move at all: the vehicle is stationary.
      if (maxForward <= 1e-6 || v.speed < 0.5) v.speed = 0

      const forward = Math.min(v.speed * dt, maxForward)
      v.along = applyForward(v.dir, v.along, forward)
      v.targetSpeed = desired

      // Hotspot bookkeeping: dwell is the time continuously stopped in the zone.
      if (inHotspot(v)) {
        if (v.arrivalTime == null) v.arrivalTime = simTime
        v.dwell = v.speed === 0 ? v.dwell + dt : 0
      } else {
        v.dwell = 0
      }

      // Status + waiting-time bookkeeping.
      if (clearedIntersection(v.dir, v.along)) {
        if (v.status !== VEHICLE_STATUS.EXITED) {
          v.status = VEHICLE_STATUS.EXITED
          v.exitTime = null // engine stamps sim time
          exited.push(v)
        }
      } else if (pastStopLine(v.dir, v.along)) {
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
