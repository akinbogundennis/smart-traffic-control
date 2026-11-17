// Vehicle movement + waiting-time tests.

import { describe, it, expect } from 'vitest'
import { stepMovement } from '../simulation/VehicleMovement.js'
import { makeVehicle, createGenerator } from '../simulation/VehicleGenerator.js'
import { createRng } from '../utils/rng.js'
import { LIGHT, VEHICLE_STATUS } from '../utils/constants.js'
import { spawnAlong, stopLineAlong, pastStopLine, clearedIntersection, offWorld } from '../utils/geometry.js'

function spawnCar(dir, overrides = {}) {
  const gen = createGenerator()
  const rng = createRng('move')
  const v = makeVehicle(gen, rng, { dir, lane: 0, simTime: 0, type: 'car', emergency: false })
  return Object.assign(v, overrides)
}

// All directions red.
const RED = { north: LIGHT.RED, south: LIGHT.RED, east: LIGHT.RED, west: LIGHT.RED }

describe('vehicle stopping at red', () => {
  it('a car approaching a red light stops at or before the stop line', () => {
    const v = spawnCar('north', { along: spawnAlong('north'), speed: 70 })
    // Simulate ~15 seconds with a persistent red on its approach.
    for (let i = 0; i < 15 * 60; i++) {
      stepMovement([v], { dt: 1 / 60, lights: RED, weatherKey: 'clear' })
    }
    // It must not have crossed the stop line.
    expect(pastStopLine('north', v.along)).toBe(false)
    // And it should be stopped/queued.
    expect(v.speed).toBeLessThan(1)
    expect(v.status).toBe(VEHICLE_STATUS.QUEUED)
  })
})

describe('waiting time accrual', () => {
  it('accumulates waiting time while stopped at red', () => {
    // Start already at rest at the stop line (front bumper on the line) so the
    // vehicle is stopped from the first step and the full dwell is counted.
    const v = spawnCar('north')
    v.along = stopLineAlong('north') - v.length / 2
    v.speed = 0
    // Settle one step so the vehicle registers as stopped at the line.
    stepMovement([v], { dt: 1 / 60, lights: RED, weatherKey: 'clear' })
    const before = v.waitTime
    for (let i = 0; i < 5 * 60; i++) {
      stepMovement([v], { dt: 1 / 60, lights: RED, weatherKey: 'clear' })
    }
    // ~5 seconds of waiting should have accrued (allow small step rounding).
    expect(v.waitTime - before).toBeGreaterThan(4.9)
    expect(v.waitTime - before).toBeLessThan(5.1)
  })
})

describe('green lets vehicles proceed', () => {
  it('a queued car crosses, keeps going past the box, and leaves at the world edge', () => {
    const GREEN = { ...RED, north: LIGHT.GREEN, south: LIGHT.GREEN }
    const v = spawnCar('north', { along: stopLineAlong('north') - 15, speed: 0 })
    let sawPastBox = false
    let exited = false
    for (let i = 0; i < 40 * 60 && !exited; i++) {
      const r = stepMovement([v], { dt: 1 / 60, lights: GREEN, weatherKey: 'clear' })
      if (clearedIntersection(v.dir, v.along) && v.status !== VEHICLE_STATUS.EXITED) sawPastBox = true
      if (r.exited.includes(v)) exited = true
    }
    expect(sawPastBox).toBe(true)
    expect(offWorld('north', v.along) || v.status === VEHICLE_STATUS.EXITED).toBe(true)
    expect(v.status).toBe(VEHICLE_STATUS.EXITED)
  })
})

describe('no overlap between following vehicles', () => {
  it('keeps a positive gap between two cars in the same lane', () => {
    const lead = spawnCar('north', { along: stopLineAlong('north') - 15, speed: 0 })
    const follow = spawnCar('north', { along: stopLineAlong('north') - 60, speed: 60 })
    for (let i = 0; i < 10 * 60; i++) {
      stepMovement([lead, follow], { dt: 1 / 60, lights: RED, weatherKey: 'clear' })
      // Following car must stay behind the leader (smaller `along` for north).
      expect(follow.along).toBeLessThan(lead.along)
    }
  })
})
