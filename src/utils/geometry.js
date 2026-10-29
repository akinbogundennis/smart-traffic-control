// Intersection geometry.
//
// Defines the world coordinate layout of the intersection in a top-down view:
// where each approach's inbound lanes are, where the stop line sits, and the
// straight path a vehicle follows from spawn, to the stop line, across the box,
// and out the far side.
//
// Convention: drive on the RIGHT. World is a square of size WORLD. Origin is
// top-left; +x is right, +y is down. Centre of the intersection is (C, C).
//
// Both the renderer and the movement engine import from here so the visuals
// and the physics always agree.

import { LANES_PER_APPROACH } from './constants.js'

export const WORLD = 700 // world is WORLD x WORLD px
export const C = WORLD / 2 // centre
export const LANE_W = 30 // lane width
// Full road = inbound lanes + outbound lanes = 2 * LANES_PER_APPROACH lanes.
export const ROAD_W = LANE_W * LANES_PER_APPROACH * 2
export const HALF_ROAD = ROAD_W / 2

// Distance of the intersection box edge from centre.
export const STOP = HALF_ROAD

// The visible white stop line is drawn just outside the box edge, with a
// crosswalk beyond it. Vehicles must halt BEHIND the stop line (and the
// crosswalk), so the logical stop line used by the movement engine sits this
// many pixels further out from centre than the box edge. This matches the
// stop-line + crosswalk graphics in drawScene (≈ 4px line + ~24px crosswalk).
export const STOP_SETBACK = 30

// Distance from centre at which a vehicle's front bumper must stop.
export const STOP_LINE = STOP + STOP_SETBACK

// For drive-on-the-right, the inbound lanes of an approach are on the right
// side of the road as you face the intersection:
//   north (moving down):  inbound lanes are x in [C, C+HALF_ROAD]
//   south (moving up):    inbound lanes are x in [C-HALF_ROAD, C]
//   west  (moving right): inbound lanes are y in [C, C+HALF_ROAD]
//   east  (moving left):  inbound lanes are y in [C-HALF_ROAD, C]
//
// laneCenter(dir, laneIndex) returns the fixed cross-axis coordinate of the
// centre of inbound lane `laneIndex` (0 = nearest the centre line).
//
// Drive-on-the-RIGHT (US) convention: a vehicle uses the lanes on the right
// side of its direction of travel.
//   north (moving down,  +y): right is -x -> inbound lanes at C - offset
//   south (moving up,    -y): right is +x -> inbound lanes at C + offset
//   west  (moving right, +x): right is +y -> inbound lanes at C + offset
//   east  (moving left,  -x): right is -y -> inbound lanes at C - offset
export function laneCenter(dir, laneIndex) {
  const offset = LANE_W * (laneIndex + 0.5)
  switch (dir) {
    case 'north':
      return C - offset // x, inbound lanes on the west half
    case 'south':
      return C + offset // x, inbound lanes on the east half
    case 'west':
      return C + offset // y, inbound lanes on the south half
    case 'east':
      return C - offset // y, inbound lanes on the north half
    default:
      return C
  }
}

// Unit travel vector for each approach (direction the vehicle moves).
export const HEADING = {
  north: { x: 0, y: 1 }, // enters top, moves down
  south: { x: 0, y: -1 }, // enters bottom, moves up
  west: { x: 1, y: 0 }, // enters left, moves right
  east: { x: -1, y: 0 }, // enters right, moves left
}

// The axis a vehicle travels along: 'y' for north/south, 'x' for east/west.
export function travelAxis(dir) {
  return dir === 'north' || dir === 'south' ? 'y' : 'x'
}

// Spawn coordinate (just outside the world edge) along the travel axis.
export function spawnAlong(dir) {
  switch (dir) {
    case 'north':
      return -30 // top, will move down (increasing y)
    case 'south':
      return WORLD + 30 // bottom, will move up (decreasing y)
    case 'west':
      return -30 // left, will move right (increasing x)
    case 'east':
      return WORLD + 30 // right, will move left (decreasing x)
    default:
      return 0
  }
}

// Exit coordinate (just past the far edge) along the travel axis.
export function exitAlong(dir) {
  switch (dir) {
    case 'north':
      return WORLD + 30
    case 'south':
      return -30
    case 'west':
      return WORLD + 30
    case 'east':
      return -30
    default:
      return WORLD
  }
}

// Position of the stop line along the travel axis for an approach. A vehicle
// moving toward the centre must not cross this while its light is red. This is
// set back from the box edge so vehicles halt behind the white line/crosswalk.
export function stopLineAlong(dir) {
  switch (dir) {
    case 'north':
      return C - STOP_LINE // moving down; stop before reaching here
    case 'south':
      return C + STOP_LINE // moving up; stop before (coordinate larger)
    case 'west':
      return C - STOP_LINE // moving right; stop before
    case 'east':
      return C + STOP_LINE // moving left; stop before (coordinate larger)
    default:
      return C
  }
}

// Has a vehicle at `along` (its travel-axis coordinate) passed the stop line
// and entered the intersection box? Used to decide when a vehicle is committed
// to crossing and can ignore the signal.
export function pastStopLine(dir, along) {
  const line = stopLineAlong(dir)
  switch (dir) {
    case 'north':
      return along >= line
    case 'south':
      return along <= line
    case 'west':
      return along >= line
    case 'east':
      return along <= line
    default:
      return false
  }
}

// Has the vehicle fully exited the intersection box (cleared the far stop line)?
export function clearedIntersection(dir, along) {
  switch (dir) {
    case 'north':
      return along >= C + STOP
    case 'south':
      return along <= C - STOP
    case 'west':
      return along >= C + STOP
    case 'east':
      return along <= C - STOP
    default:
      return false
  }
}

// Convert an (along, dir, laneIndex) into world (x, y) for rendering/collision.
export function toXY(dir, along, laneIndex) {
  const cross = laneCenter(dir, laneIndex)
  if (travelAxis(dir) === 'y') {
    return { x: cross, y: along }
  }
  return { x: along, y: cross }
}

// Rotation angle (radians) for a sprite traveling in `dir`, where a sprite is
// authored pointing up (toward -y).
export function headingAngle(dir) {
  switch (dir) {
    case 'north':
      return Math.PI // pointing down
    case 'south':
      return 0 // pointing up
    case 'west':
      return Math.PI / 2 // pointing right
    case 'east':
      return -Math.PI / 2 // pointing left
    default:
      return 0
  }
}
