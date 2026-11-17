// Metrics calculator.
//
// Collects performance measures from ACTUAL simulated events (prompt section 10
// forbids invented or hardcoded results). Every number here is derived from
// vehicles that really spawned, waited, and exited, plus sampled queue state.
//
// Tracked:
//   generated        vehicles spawned
//   processed        vehicles that exited the intersection
//   totalWait        sum of waiting time of processed vehicles
//   totalDelay       sum of travel delay (actual travel time - free-flow time)
//   queue samples    running sum + peak of total queue length
//   throughput       processed per simulated hour
//   history          time series for charts (wait, queue, throughput)

import { spawnAlong, exitAlong, progress } from '../utils/geometry.js'
import { VEHICLE, WEATHER } from '../utils/constants.js'

export function createMetrics() {
  return {
    generated: 0,
    processed: 0,
    totalWait: 0,
    totalDelay: 0,
    queueSum: 0,
    queueSamples: 0,
    peakQueue: 0,
    currentQueue: 0,
    elapsed: 0,
    emergencyProcessed: 0,
    emergencyResponseSum: 0,
    emergencyResponseCount: 0,
    hotspotReleases: 0, // greens ended early by the hotspot sensor
    hotspotDwellSum: 0, // total dwell (s) of the vehicles that triggered releases
    hotspotGreenSaved: 0, // total idle green (s) those releases cut short
    history: [], // [{ t, avgWait, queue, throughput }]
    _sinceSample: 0,
  }
}

export function recordGenerated(m, n = 1) {
  m.generated += n
}

// Record a vehicle that exited. Computes its travel delay vs. an ideal
// free-flow traversal of the world at the weather-adjusted target speed.
export function recordExit(m, vehicle, simTime, weatherKey) {
  m.processed += 1
  m.totalWait += vehicle.waitTime
  vehicle.exitTime = simTime

  const travelTime = simTime - vehicle.spawnTime
  const weather = WEATHER[weatherKey] ?? WEATHER.clear
  const pathLength = progress(vehicle.dir, exitAlong(vehicle.dir)) - progress(vehicle.dir, spawnAlong(vehicle.dir))
  const freeFlowTime = pathLength / (VEHICLE.baseSpeed * weather.speedFactor)
  const delay = Math.max(0, travelTime - freeFlowTime)
  m.totalDelay += delay
}

// Record an emergency vehicle that cleared the intersection. `delay` is the time
// it actually spent stopped on the way through (emergency vehicles do not wait
// for a green, so this is what the response delay means now).
export function recordEmergency(m, delay) {
  m.emergencyProcessed += 1
  m.emergencyResponseSum += delay
  m.emergencyResponseCount += 1
}

// Record a green that the hotspot sensor ended early.
export function recordHotspotRelease(m, dwell, savedGreen) {
  m.hotspotReleases += 1
  m.hotspotDwellSum += dwell
  m.hotspotGreenSaved += savedGreen
}

// Sample the instantaneous total queue length, and append to the time series
// at a throttled cadence to keep charts readable.
export function sample(m, totalQueue, dt) {
  m.currentQueue = totalQueue
  m.queueSum += totalQueue
  m.queueSamples += 1
  m.elapsed += dt
  if (totalQueue > m.peakQueue) m.peakQueue = totalQueue

  m._sinceSample += dt
  if (m._sinceSample >= 1) {
    m._sinceSample = 0
    m.history.push({
      t: Math.round(m.elapsed),
      avgWait: round(avgWait(m)),
      queue: totalQueue,
      throughput: round(throughputPerHour(m)),
    })
    // Cap history length for performance.
    if (m.history.length > 600) m.history.shift()
  }
}

function round(x) {
  return Math.round(x * 100) / 100
}

export function avgWait(m) {
  return m.processed > 0 ? m.totalWait / m.processed : 0
}

export function avgQueue(m) {
  return m.queueSamples > 0 ? m.queueSum / m.queueSamples : 0
}

export function avgDelay(m) {
  return m.processed > 0 ? m.totalDelay / m.processed : 0
}

export function throughputPerHour(m) {
  return m.elapsed > 0 ? (m.processed / m.elapsed) * 3600 : 0
}

export function avgEmergencyResponse(m) {
  return m.emergencyResponseCount > 0 ? m.emergencyResponseSum / m.emergencyResponseCount : 0
}

// A plain summary object for display and comparison.
export function summarize(m) {
  return {
    generated: m.generated,
    processed: m.processed,
    avgWait: avgWait(m),
    avgQueue: avgQueue(m),
    peakQueue: m.peakQueue,
    currentQueue: m.currentQueue,
    avgDelay: avgDelay(m),
    throughput: throughputPerHour(m),
    emergencyProcessed: m.emergencyProcessed,
    avgEmergencyResponse: avgEmergencyResponse(m),
    hotspotReleases: m.hotspotReleases,
    avgHotspotDwell: m.hotspotReleases > 0 ? m.hotspotDwellSum / m.hotspotReleases : 0,
    hotspotGreenSaved: m.hotspotGreenSaved,
    elapsed: m.elapsed,
  }
}
