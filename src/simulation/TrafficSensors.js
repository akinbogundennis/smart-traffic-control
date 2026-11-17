// Virtual traffic sensors.
//
// Simulates sensors installed at each incoming approach. Crucially, every
// reading is DERIVED FROM ACTUAL SIMULATED VEHICLE STATE (prompt section 4) -
// nothing is invented. The controller consumes these readings; it never looks
// at raw vehicle objects directly, mirroring how a real controller only sees
// sensor data.
//
// Per-approach readings:
//   count         vehicles currently on the approach (not yet past stop line)
//   queueLength   vehicles stopped/slow and waiting at the approach
//   arrivalRate   vehicles/sec arriving, smoothed over a short window
//   avgWait       mean accumulated wait time of waiting vehicles (s)
//   avgSpeed      mean speed of approach vehicles (px/s)
//   occupancy     fraction of the approach road length covered by vehicles
//
// Hotspot readings (the detection zone just before the stop line):
//   hotspotCount    vehicles inside the zone
//   hotspotStopped  vehicles inside the zone that are stopped
//   hotspotDwell    longest time (s) any vehicle has been continuously stopped
//                   in the zone
//   nearestGap      distance (px) from the stop line to the closest vehicle that
//                   has not yet crossed it (Infinity if the approach is empty)
//   crossing        vehicles past the stop line that have not yet cleared

import { DIRECTIONS, VEHICLE_STATUS } from '../utils/constants.js'
import { pastStopLine, inHotspot, gapToStopLine, clearedIntersection, inBox } from '../utils/geometry.js'
import { WORLD } from '../utils/geometry.js'

export function createSensors() {
  // Keep a little history per direction for arrival-rate smoothing.
  const arrivals = {}
  for (const d of DIRECTIONS) arrivals[d] = []
  return { arrivals, lastReadings: emptyReadings() }
}

function emptyReadings() {
  const r = {}
  for (const d of DIRECTIONS) {
    r[d] = {
      count: 0,
      queueLength: 0,
      arrivalRate: 0,
      avgWait: 0,
      avgSpeed: 0,
      occupancy: 0,
      hotspotCount: 0,
      hotspotStopped: 0,
      hotspotDwell: 0,
      nearestGap: Infinity,
      crossing: 0,
    }
  }
  return r
}

// Record a spawn event so arrival rate can be estimated.
export function recordArrival(sensors, dir, simTime) {
  sensors.arrivals[dir].push(simTime)
}

// Read the current state of all approaches from the live vehicle list.
// `window` is the smoothing window (seconds) for arrival rate.
export function read(sensors, vehicles, simTime, windowSec = 10) {
  const readings = emptyReadings()
  const sums = {}
  for (const d of DIRECTIONS) {
    sums[d] = {
      wait: 0, waitN: 0, speed: 0, n: 0, coveredLen: 0,
      hot: 0, hotStopped: 0, dwell: 0, nearestGap: Infinity, crossing: 0,
    }
  }

  for (const v of vehicles) {
    if (v.status === VEHICLE_STATUS.EXITED) continue
    // Vehicles past the stop line are committed to crossing; count them
    // separately and keep them out of the approach readings.
    if (pastStopLine(v.dir, v.along)) {
      // Still inside the box counts as crossing. Past the box, the vehicle is
      // just driving away and is no longer a sensor reading.
      if (!clearedIntersection(v.dir, v.along) || inBox(v.dir, v.along, v.length)) {
        sums[v.dir].crossing += 1
      }
      continue
    }

    const s = sums[v.dir]
    s.n += 1
    s.speed += v.speed
    s.coveredLen += v.length
    if (v.status === VEHICLE_STATUS.QUEUED || v.speed < 5) {
      s.wait += v.waitTime
      s.waitN += 1
    }

    // Hotspot detection.
    s.nearestGap = Math.min(s.nearestGap, gapToStopLine(v.dir, v.along, v.length))
    if (inHotspot(v)) {
      s.hot += 1
      if (v.speed < 1) {
        s.hotStopped += 1
        s.dwell = Math.max(s.dwell, v.dwell)
      }
    }
  }

  for (const d of DIRECTIONS) {
    const s = sums[d]
    // Trim arrival history outside the window.
    const hist = sensors.arrivals[d]
    while (hist.length && hist[0] < simTime - windowSec) hist.shift()

    const queueLength = s.waitN
    readings[d] = {
      count: s.n,
      queueLength,
      arrivalRate: hist.length / windowSec,
      avgWait: s.waitN > 0 ? s.wait / s.waitN : 0,
      avgSpeed: s.n > 0 ? s.speed / s.n : 0,
      // Approach length available before the stop line is roughly half the world.
      occupancy: Math.min(1, s.coveredLen / (WORLD / 2)),
      hotspotCount: s.hot,
      hotspotStopped: s.hotStopped,
      hotspotDwell: s.dwell,
      nearestGap: s.nearestGap,
      crossing: s.crossing,
    }
  }

  sensors.lastReadings = readings
  return readings
}

// Convenience aggregates used by controllers/metrics.
export function phaseQueue(readings, dirs) {
  return dirs.reduce((sum, d) => sum + readings[d].queueLength, 0)
}

export function phaseAvgWait(readings, dirs) {
  const waits = dirs.map((d) => readings[d].avgWait)
  const nonzero = waits.filter((w) => w > 0)
  if (nonzero.length === 0) return 0
  return nonzero.reduce((s, w) => s + w, 0) / nonzero.length
}

export function maxWaitAcross(readings, dirs) {
  return Math.max(0, ...dirs.map((d) => readings[d].avgWait))
}
