// Adaptive controller + weather tests.

import { describe, it, expect } from 'vitest'
import { computeGreen } from '../controllers/AdaptiveController.js'
import { TIMING, WEATHER, PHASES } from '../utils/constants.js'

function readingsWithQueue(nsQueue, ewQueue, nsWait = 0) {
  const base = { count: 0, queueLength: 0, arrivalRate: 0, avgWait: 0, avgSpeed: 0, occupancy: 0 }
  return {
    north: { ...base, queueLength: Math.ceil(nsQueue / 2), avgWait: nsWait },
    south: { ...base, queueLength: Math.floor(nsQueue / 2), avgWait: nsWait },
    east: { ...base, queueLength: Math.ceil(ewQueue / 2) },
    west: { ...base, queueLength: Math.floor(ewQueue / 2) },
  }
}

describe('adaptive green-time response', () => {
  it('gives more green time as queue length grows', () => {
    const small = computeGreen(readingsWithQueue(2, 0), 'NS')
    const large = computeGreen(readingsWithQueue(12, 0), 'NS')
    expect(large).toBeGreaterThan(small)
  })

  it('keeps green time within configured min/max limits', () => {
    const tiny = computeGreen(readingsWithQueue(0, 0), 'NS')
    const huge = computeGreen(readingsWithQueue(100, 0, 200), 'NS')
    expect(tiny).toBeGreaterThanOrEqual(TIMING.minGreen)
    expect(huge).toBeLessThanOrEqual(TIMING.maxGreen)
  })

  it('increases green time with higher average wait', () => {
    const lowWait = computeGreen(readingsWithQueue(4, 0, 0), 'NS')
    const highWait = computeGreen(readingsWithQueue(4, 0, 60), 'NS')
    expect(highWait).toBeGreaterThanOrEqual(lowWait)
  })
})

describe('weather affects simulation parameters', () => {
  it('lengthens yellow and all-red clearance in adverse weather', () => {
    expect(WEATHER.rain.yellow).toBeGreaterThan(WEATHER.clear.yellow)
    expect(WEATHER.rain.allRed).toBeGreaterThan(WEATHER.clear.allRed)
    expect(WEATHER.fog.yellow).toBeGreaterThan(WEATHER.clear.yellow)
  })

  it('reduces vehicle speed in adverse weather', () => {
    expect(WEATHER.rain.speedFactor).toBeLessThan(WEATHER.clear.speedFactor)
    expect(WEATHER.fog.speedFactor).toBeLessThan(WEATHER.clear.speedFactor)
  })
})
