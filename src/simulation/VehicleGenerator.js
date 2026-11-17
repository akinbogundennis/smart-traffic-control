// Vehicle generator.
//
// Spawns vehicles at each approach according to the configured traffic demand,
// using the seeded RNG so arrivals are reproducible. Each vehicle starts just
// outside the world edge in a chosen inbound lane and heads for the centre.
//
// Arrivals follow a simple per-step Bernoulli process: over a step of dt
// seconds, the probability of a new arrival on a given approach is
// rate_dir * dt (kept small). This approximates a Poisson arrival stream.

import {
  DIRECTIONS,
  LANES_PER_APPROACH,
  VEHICLE,
  VEHICLE_STATUS,
  VEHICLE_TYPE,
} from '../utils/constants.js'
import { spawnAlong } from '../utils/geometry.js'

const VEHICLE_COLORS = [
  '#d7dde4', '#e8c33b', '#5bb8ff', '#ef6f6f',
  '#8d7bef', '#58c9a3', '#e8954b', '#b0b7c0',
]

// Relative likelihood of each non-emergency vehicle type.
const TYPE_WEIGHTS = [
  { type: VEHICLE_TYPE.CAR, weight: 0.78 },
  { type: VEHICLE_TYPE.TRUCK, weight: 0.12 },
  { type: VEHICLE_TYPE.BUS, weight: 0.1 },
]

export function createGenerator() {
  return { nextId: 1 }
}

// Build a single vehicle object (prompt section 9 lists the required fields).
export function makeVehicle(gen, rng, { dir, lane, simTime, type, emergency }) {
  const chosenType = emergency ? VEHICLE_TYPE.EMERGENCY : type
  const sizeByType = {
    [VEHICLE_TYPE.CAR]: { length: VEHICLE.length, width: VEHICLE.width },
    [VEHICLE_TYPE.TRUCK]: { length: VEHICLE.length * 1.6, width: VEHICLE.width * 1.1 },
    [VEHICLE_TYPE.BUS]: { length: VEHICLE.length * 1.9, width: VEHICLE.width * 1.15 },
    [VEHICLE_TYPE.EMERGENCY]: { length: VEHICLE.length * 1.15, width: VEHICLE.width * 1.05 },
  }
  const size = sizeByType[chosenType]

  return {
    id: gen.nextId++,
    dir, // entry direction (approach)
    lane, // lane index 0..LANES_PER_APPROACH-1
    type: chosenType,
    emergency: !!emergency,
    color: emergency ? '#f4f6f8' : VEHICLE_COLORS[rng.int(0, VEHICLE_COLORS.length - 1)],
    length: size.length,
    width: size.width,
    along: spawnAlong(dir), // position along travel axis
    speed: 0, // current speed px/s
    targetSpeed: 0, // desired speed this step
    status: VEHICLE_STATUS.APPROACHING,
    spawnTime: simTime,
    exitTime: null,
    waitTime: 0, // accumulated seconds spent stopped/queued
    dwell: 0, // seconds continuously stopped inside the hotspot (resets on movement)
    arrivalTime: null, // sim time the vehicle first reached the hotspot / claimed the box
  }
}

// Try to spawn vehicles for this step. Returns an array of new vehicles.
// `demand` is a {dir: weight} map; `totalRate` is vehicles/sec across all
// approaches. Per-direction rate is totalRate * weight / sumWeights.
export function generate(gen, rng, { dt, simTime, demand, totalRate }) {
  const spawned = []
  const weights = DIRECTIONS.map((d) => demand[d] ?? 0)
  const sumW = weights.reduce((s, w) => s + w, 0) || 1

  for (const dir of DIRECTIONS) {
    const w = demand[dir] ?? 0
    if (w <= 0) continue
    const dirRate = (totalRate * w) / sumW
    const p = dirRate * dt
    if (rng.chance(Math.min(p, 0.9))) {
      const lane = rng.int(0, LANES_PER_APPROACH - 1)
      const typePick = TYPE_WEIGHTS[rng.weightedIndex(TYPE_WEIGHTS.map((t) => t.weight))]
      spawned.push(
        makeVehicle(gen, rng, { dir, lane, simTime, type: typePick.type, emergency: false }),
      )
    }
  }
  return spawned
}
