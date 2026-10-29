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

import { WORLD } from '../utils/geometry.js'
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
  const freeFlowTime = WORLD / (VEHICLE.baseSpeed * weather.speedFactor)
  const delay = Math.max(0, travelTime - freeFlowTime)
  m.totalDelay += delay
}

export function recordEmergency(m, responseTime) {
  m.emergencyProcessed += 1
  m.emergencyResponseSum += responseTime
  m.emergencyResponseCount += 1
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
    elapsed: m.elapsed,
  }
}
