// Lane-disciplined turns.
//
// US rules used here:
//   - Left turns only from lane 0 (the lane nearest the centre line).
//   - Right turns only from lane 1 (the outer lane).
//   - Straight from either lane.
//   - No turn on red. A turning vehicle waits behind the stop line with everyone
//     else until its approach is green.
//   - An unprotected left turn yields to oncoming traffic. If both sides are
//     turning left, the one that reached the line first goes and the other waits.
//   - A right turn does not cross oncoming traffic, but it must not enter the
//     outbound lane until there is a gap.
//
// The turn itself is a 90 degree change of direction at the corner where the
// entry lane meets the target lane. Position is continuous: the corner is the
// same point in both coordinate systems.

import { TURN, VEHICLE, VEHICLE_STATUS } from "../utils/constants.js"
import {
  laneCenter,
  progress,
  gapToStopLine,
  clearedIntersection,
} from "../utils/geometry.js"

const RIGHT = { north: "east", south: "west", west: "north", east: "south" }
const LEFT = { north: "west", south: "east", west: "south", east: "north" }
const ONCOMING = { north: "south", south: "north", west: "east", east: "west" }

const LEFT_YIELD_RANGE = 160

export function targetDirection(dir, turn) {
  if (turn === TURN.RIGHT) return RIGHT[dir]
  if (turn === TURN.LEFT) return LEFT[dir]
  return dir
}

export function turnPointAlong(v) {
  return laneCenter(targetDirection(v.dir, v.turn), v.lane)
}

export function distanceToTurnPoint(v) {
  return progress(v.dir, turnPointAlong(v)) - progress(v.dir, v.along)
}

function needsTurn(v) {
  return !v.emergency && !v.turned && v.turn && v.turn !== TURN.STRAIGHT
}

function blocksLeftTurn(turner, other) {
  if (other === turner || other.status === VEHICLE_STATUS.EXITED) return false
  if (other.dir !== ONCOMING[turner.dir]) return false
  if (clearedIntersection(other.dir, other.along)) return false
  if (gapToStopLine(other.dir, other.along, other.length) >= LEFT_YIELD_RANGE) return false
  // An opposing left turn that has already left the oncoming lane is clear.
  // One that has not turned yet is still crossing, so it has priority unless
  // it arrived second (otherwise the two left turns wait on each other).
  if (other.turn === TURN.LEFT && other.turned) return false
  if (other.turn === TURN.LEFT) {
    const mine = turner.arrivalTime ?? Infinity
    const theirs = other.arrivalTime ?? Infinity
    if (mine < theirs || (mine === theirs && turner.id < other.id)) return false
  }
  return true
}

function outboundGapClear(v, vehicles) {
  const dest = targetDirection(v.dir, v.turn)
  const at = laneCenter(v.dir, v.lane)
  for (const o of vehicles) {
    if (o === v || o.status === VEHICLE_STATUS.EXITED) continue
    if (o.dir !== dest || o.lane !== v.lane) continue
    const gap =
      Math.abs(progress(dest, o.along) - progress(dest, at)) -
      o.length / 2 -
      v.length / 2
    if (gap < VEHICLE.minGap) return false
  }
  return true
}

export function turnAllowed(v, vehicles) {
  if (!needsTurn(v)) return false
  if (v.turn === TURN.LEFT && vehicles.some((o) => blocksLeftTurn(v, o))) return false
  return outboundGapClear(v, vehicles)
}

export function turnHoldDistance(v, vehicles) {
  if (!needsTurn(v)) return null
  const toCorner = distanceToTurnPoint(v)
  if (v.turn === TURN.LEFT && !turnAllowed(v, vehicles)) {
    return gapToStopLine(v.dir, v.along, v.length)
  }
  return toCorner
}

export function applyTurn(v) {
  if (!needsTurn(v)) return false
  const newDir = targetDirection(v.dir, v.turn)
  const newAlong = laneCenter(v.dir, v.lane)
  v.dir = newDir
  v.along = newAlong
  v.turned = true
  return true
}
