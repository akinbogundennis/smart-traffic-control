// Intersection access manager.
//
// Decides which vehicles may enter the intersection box right now, so vehicles
// on conflicting roads never occupy it at the same time. It runs once per
// simulation step and returns a plan that VehicleMovement obeys.
//
// Signals normally keep conflicting traffic apart. This layer covers the cases
// signals alone cannot:
//   - vehicles still crossing when the next phase turns green,
//   - emergency vehicles, which do not stop for signals,
//   - several vehicles from different roads contending at once.
//
// Rules, in order:
//   1. A vehicle never enters the box while a vehicle on the conflicting road
//      is still inside it.
//   2. Emergency vehicles have priority over all other traffic.
//   3. Otherwise the vehicle that reached the hotspot first goes first
//      (arrivals within one INTERSECTION.arrivalBucket count as simultaneous).
//   4. On a tie, yield to the vehicle on your right (drive-on-the-right).
//   5. Remaining ties go to the lower vehicle id.
//
// Contention is settled between roads, not between individual cars: the best
// candidate on each road is compared, and the winning road's candidates go
// while the other road's wait. This cannot deadlock, which a per-car "yield to
// the right" rule can (four cars arriving together form a cycle).
//
// Vehicles on the same road never conflict: straight-through paths in different
// lanes or opposite directions do not cross.
//
// Emergency vehicles also make other vehicles ahead of them on the same road
// slow to a crawl ("creep") so the emergency vehicle can pass alongside.

import { LIGHT, VEHICLE_STATUS, INTERSECTION, phaseOfDirection } from '../utils/constants.js'
import { progress, pastStopLine, inBox, inHotspot, gapToBox, clearedIntersection } from '../utils/geometry.js'

// The approach whose vehicles are on a given approach's RIGHT-hand side.
// North-entering traffic moves down, so its right is the west side, and so on.
export const RIGHT_OF = { north: 'west', south: 'east', west: 'south', east: 'north' }

const axisOf = (dir) => phaseOfDirection(dir)
const otherAxis = (axis) => (axis === 'NS' ? 'EW' : 'NS')
const bucket = (t) => Math.floor((t ?? Infinity) / INTERSECTION.arrivalBucket)

// Total order used to pick each road's best candidate.
function rank(a, b) {
  if (a.emergency !== b.emergency) return a.emergency ? -1 : 1
  const ba = bucket(a.arrivalTime)
  const bb = bucket(b.arrivalTime)
  if (ba !== bb) return ba - bb
  return a.id - b.id
}

// Does `a` have the right of way over `b`? (a and b are on conflicting roads.)
export function beats(a, b) {
  if (a.emergency !== b.emergency) return a.emergency
  const ba = bucket(a.arrivalTime)
  const bb = bucket(b.arrivalTime)
  if (ba !== bb) return ba < bb
  // Simultaneous: b yields to the vehicle on its right.
  if (RIGHT_OF[b.dir] === a.dir) return true
  if (RIGHT_OF[a.dir] === b.dir) return false
  return a.id < b.id
}

function isCandidate(v, lights) {
  if (v.emergency) {
    return gapToBox(v.dir, v.along, v.length) <= INTERSECTION.emergencyAlertRange
  }
  const committed = pastStopLine(v.dir, v.along)
  if (!committed && !inHotspot(v)) return false
  // A vehicle whose signal is red is not contending (the signal already holds
  // it); one past the stop line is committed regardless of the signal.
  return committed || lights[v.dir] !== LIGHT.RED
}

// Returns Map<vehicleId, { hold, creep, reason }>.
//   hold  - must not enter the box (stops at the stop line, or at the box edge
//           if already past the stop line)
//   creep - slow to INTERSECTION.yieldSpeed so an emergency vehicle can pass
export function planIntersectionAccess(vehicles, lights, simTime = 0) {
  const plan = new Map()
  const entryFor = (v) => {
    let e = plan.get(v.id)
    if (!e) {
      e = { hold: false, creep: false, reason: null }
      plan.set(v.id, e)
    }
    return e
  }

  const live = vehicles.filter((v) => v.status !== VEHICLE_STATUS.EXITED)

  // Per-lane order, to find vehicles inside the box and each lane's first
  // vehicle that has not entered yet (its "leader").
  const lanes = new Map()
  for (const v of live) {
    const key = `${v.dir}:${v.lane}`
    if (!lanes.has(key)) lanes.set(key, [])
    lanes.get(key).push(v)
  }

  const occupants = { NS: [], EW: [] }
  const leaders = []
  for (const group of lanes.values()) {
    group.sort((a, b) => progress(b.dir, b.along) - progress(a.dir, a.along))
    for (const v of group) {
      // Already through and driving away: not in the box and not waiting to enter.
      if (clearedIntersection(v.dir, v.along)) continue
      if (inBox(v.dir, v.along, v.length)) {
        occupants[axisOf(v.dir)].push(v)
      } else {
        leaders.push(v)
        break
      }
    }
  }

  // Candidates: leaders that are contending for the box right now.
  const candidates = leaders.filter((v) => isCandidate(v, lights))
  for (const c of candidates) {
    if (c.arrivalTime == null) c.arrivalTime = simTime
  }

  // Best candidate per road, then which road wins.
  const best = { NS: null, EW: null }
  for (const c of candidates) {
    const axis = axisOf(c.dir)
    if (!best[axis] || rank(c, best[axis]) < 0) best[axis] = c
  }
  let winnerAxis = null
  if (best.NS && best.EW) winnerAxis = beats(best.NS, best.EW) ? 'NS' : 'EW'

  for (const c of candidates) {
    const axis = axisOf(c.dir)
    const e = entryFor(c)
    if (occupants[otherAxis(axis)].length > 0) {
      e.hold = true
      e.reason = 'box occupied'
    } else if (winnerAxis && winnerAxis !== axis) {
      e.hold = true
      e.reason = best[winnerAxis].emergency ? 'yield to emergency' : 'yield (right of way)'
    }
  }

  // Cars ahead of an emergency vehicle on the same road slow down so it can
  // pass alongside in the lane-line corridor.
  for (const em of live) {
    if (!em.emergency) continue
    const emProgress = progress(em.dir, em.along)
    for (const v of live) {
      if (v.emergency || v.dir !== em.dir) continue
      if (inBox(v.dir, v.along, v.length)) continue
      const lead = progress(v.dir, v.along) - emProgress
      if (lead > 0 && lead <= INTERSECTION.yieldRange) {
        const e = entryFor(v)
        e.creep = true
        e.reason = e.reason ?? 'yield to emergency'
      }
    }
  }

  return plan
}
