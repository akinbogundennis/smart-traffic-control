// Simulation engine.
//
// The orchestrator. Wires every module together in the prompt's unidirectional
// data flow:
//
//   VehicleGenerator -> vehicles -> VehicleMovement -> TrafficSensors
//     -> Controller (fixed/adaptive + emergency) -> TrafficSignal -> lights
//     -> VehicleMovement (next step) ... and MetricsCalculator observes it all.
//
// The engine is framework-agnostic: React just constructs it, calls step() on
// a clock tick, and reads snapshot(). No simulation logic lives in components.

import {
  DIRECTIONS,
  MODE,
  VEHICLE_STATUS,
  WEATHER,
  EMERGENCY_LANE,
  phaseOfDirection,
} from '../utils/constants.js'
import { createRng } from '../utils/rng.js'
import { createClock, advance, resetClock } from './SimulationClock.js'
import { createSignal, lightMap, stepSignal } from './TrafficSignal.js'
import { createGenerator, generate } from './VehicleGenerator.js'
import { makeVehicle } from './VehicleGenerator.js'
import { stepMovement } from './VehicleMovement.js'
import {
  createSensors,
  read as readSensors,
  recordArrival,
} from './TrafficSensors.js'
import { createFixedController, fixedDecide } from '../controllers/FixedTimeController.js'
import {
  createAdaptiveController,
  adaptiveDecide,
  adaptiveTick,
} from '../controllers/AdaptiveController.js'
import {
  createEmergencyController,
  injectEmergency as injectEmergencyReq,
  emergencyDecide,
  clearEmergency,
} from '../controllers/EmergencyPriorityController.js'
import {
  createMetrics,
  recordGenerated,
  recordExit,
  recordEmergency,
  recordHotspotRelease,
  sample,
  summarize,
} from '../analytics/MetricsCalculator.js'
import { FIXED_DT } from '../utils/constants.js'

// config:
//   mode: MODE.FIXED | MODE.ADAPTIVE
//   weatherKey, volumeKey, totalRate (vehicles/sec), demand {dir: weight}
//   seed
export function createEngine(config) {
  const seed = config.seed ?? 'default'
  return {
    config: {
      mode: config.mode ?? MODE.ADAPTIVE,
      weatherKey: config.weatherKey ?? 'clear',
      volumeKey: config.volumeKey ?? 'normal',
      totalRate: config.totalRate ?? 0.5,
      demand: { ...(config.demand ?? { north: 1, south: 1, east: 1, west: 1 }) },
      seed,
    },
    rng: createRng(seed),
    clock: createClock(),
    signal: createSignal('NS'),
    generator: createGenerator(),
    sensors: createSensors(),
    fixed: createFixedController(),
    adaptive: createAdaptiveController(),
    emergency: createEmergencyController(),
    metrics: createMetrics(),
    vehicles: [],
    events: [], // event log entries { t, text, kind }
    lights: lightMap(createSignal('NS')),
    lastReadings: null,
  }
}

function logEvent(engine, text, kind = 'info') {
  engine.events.push({ t: engine.clock.simTime, text, kind })
  if (engine.events.length > 200) engine.events.shift()
}

// Update live configuration mid-run (operator changes). Changing weather/volume
// affects the simulation immediately (prompt: controls must affect logic).
export function updateConfig(engine, patch) {
  Object.assign(engine.config, patch)
  if (patch.demand) engine.config.demand = { ...patch.demand }
}

// Inject an emergency vehicle from `dir`. Spawns a visible emergency vehicle
// (riding the lane line so it can pass queued traffic) and registers the
// priority request.
export function injectEmergency(engine, dir) {
  const v = makeVehicle(engine.generator, engine.rng, {
    dir,
    lane: EMERGENCY_LANE,
    simTime: engine.clock.simTime,
    type: 'emergency',
    emergency: true,
  })
  engine.vehicles.push(v)
  recordGenerated(engine.metrics, 1)
  recordArrival(engine.sensors, dir, engine.clock.simTime)
  injectEmergencyReq(engine.emergency, dir, engine.clock.simTime)
  logEvent(engine, `Emergency vehicle detected on ${dir.toUpperCase()} approach`, 'emergency')
}

// Run exactly one fixed simulation step (FIXED_DT seconds).
function stepOnce(engine) {
  const dt = FIXED_DT
  const { config } = engine
  const weather = WEATHER[config.weatherKey] ?? WEATHER.clear

  // 1) Generate arrivals.
  const spawned = generate(engine.generator, engine.rng, {
    dt,
    simTime: engine.clock.simTime,
    demand: config.demand,
    totalRate: config.totalRate,
  })
  for (const v of spawned) {
    engine.vehicles.push(v)
    recordArrival(engine.sensors, v.dir, engine.clock.simTime)
  }
  if (spawned.length) recordGenerated(engine.metrics, spawned.length)

  // 2) Advance the signal state machine (handles yellow/all-red timers).
  const sigEvent = stepSignal(engine.signal, dt, weather)
  if (sigEvent && sigEvent.event === 'greenStart') {
    logEvent(
      engine,
      `Green started for ${sigEvent.phase} (${sigEvent.duration.toFixed(0)}s planned)`,
      'signal',
    )
  }

  // 3) Move vehicles under the current lights.
  engine.lights = lightMap(engine.signal)
  const { exited } = stepMovement(engine.vehicles, {
    dt,
    lights: engine.lights,
    weatherKey: config.weatherKey,
    simTime: engine.clock.simTime,
  })
  for (const v of exited) {
    recordExit(engine.metrics, v, engine.clock.simTime, config.weatherKey)
    if (v.emergency) {
      // Delay = time the emergency vehicle actually spent stopped.
      recordEmergency(engine.metrics, v.waitTime)
      logEvent(
        engine,
        `Emergency vehicle from ${v.dir.toUpperCase()} cleared the intersection (stopped ${v.waitTime.toFixed(1)}s)`,
        'emergency',
      )
    }
  }

  // 4) Read sensors from the resulting vehicle states.
  const readings = readSensors(engine.sensors, engine.vehicles, engine.clock.simTime)
  engine.lastReadings = readings

  // 5) Controller decisions. Emergency priority takes precedence when active.
  const emResult = emergencyDecide(engine.emergency, engine.signal, {
    simTime: engine.clock.simTime,
    weather,
  })
  if (emResult.event) {
    if (emResult.event.type === 'emergencyPreempt') {
      logEvent(engine, `Priority preemption requested for ${emResult.event.dir.toUpperCase()}`, 'emergency')
    } else if (emResult.event.type === 'emergencyGranted') {
      logEvent(
        engine,
        `Priority granted to ${emResult.event.dir.toUpperCase()} (response ${emResult.event.responseTime.toFixed(1)}s)`,
        'emergency',
      )
    }
  }

  if (!emResult.preempt) {
    if (config.mode === MODE.FIXED) {
      const ev = fixedDecide(engine.fixed, engine.signal, { weather })
      if (ev) logEvent(engine, `Fixed cycle: switch to ${ev.phase}`, 'signal')
    } else {
      adaptiveTick(engine.adaptive, engine.signal, dt)
      const ev = adaptiveDecide(engine.adaptive, engine.signal, { readings, weather })
      if (ev?.hotspot) {
        recordHotspotRelease(engine.metrics, ev.hotspot.dwell, ev.hotspot.savedGreen)
        logEvent(
          engine,
          `Hotspot release: switch to ${ev.phase} (${ev.reason}; cut ${ev.hotspot.savedGreen.toFixed(0)}s of idle green)`,
          'hotspot',
        )
      } else if (ev) {
        logEvent(engine, `Adaptive: switch to ${ev.phase} (${ev.reason}, ${ev.duration.toFixed(0)}s)`, 'adaptive')
      }
    }
  }

  // 6) Once the emergency vehicle has cleared (whether or not the signal got to
  //    grant it a green first), return to normal operation.
  if (engine.emergency.active) {
    const dir = engine.emergency.active.dir
    const stillPresent = engine.vehicles.some(
      (v) => v.emergency && v.dir === dir && v.status !== VEHICLE_STATUS.EXITED,
    )
    if (!stillPresent) {
      clearEmergency(engine.emergency)
      logEvent(engine, `Emergency on ${dir.toUpperCase()} cleared; normal operation restored`, 'info')
    }
  }

  // 7) Metrics sampling.
  const totalQueue = DIRECTIONS.reduce((s, d) => s + readings[d].queueLength, 0)
  sample(engine.metrics, totalQueue, dt)

  // 8) Remove exited vehicles to keep the list small.
  if (exited.length) {
    engine.vehicles = engine.vehicles.filter((v) => v.status !== VEHICLE_STATUS.EXITED)
  }
}

// Advance by real elapsed time scaled by `speed`. Runs whole fixed steps.
export function step(engine, realDelta, speed) {
  const steps = advance(engine.clock, realDelta, speed)
  for (let i = 0; i < steps; i++) stepOnce(engine)
  return engine
}

// Run a fixed number of simulated seconds (used by headless scenario runs).
export function runFor(engine, seconds) {
  const steps = Math.round(seconds / FIXED_DT)
  for (let i = 0; i < steps; i++) {
    engine.clock.simTime += FIXED_DT
    stepOnce(engine)
  }
  return engine
}

export function resetEngine(engine) {
  const cfg = engine.config
  const fresh = createEngine(cfg)
  Object.assign(engine, fresh)
  resetClock(engine.clock)
}

// Build a plain, render-ready snapshot.
export function snapshot(engine) {
  const em = engine.emergency.active
  return {
    simTime: engine.clock.simTime,
    mode: engine.config.mode,
    weatherKey: engine.config.weatherKey,
    lights: { ...engine.lights },
    phaseKey: engine.signal.phaseKey,
    stage: engine.signal.stage,
    greenElapsed: engine.signal.greenElapsed,
    // Countdown to the next transition: in green we show planned duration left;
    // in yellow/all-red the stage timer.
    timeToTransition:
      engine.signal.stage === 'green'
        ? Math.max(0, (engine.adaptive.currentGreenDuration || 0) - engine.signal.greenElapsed)
        : Math.max(0, engine.signal.stageTimeLeft),
    vehicles: engine.vehicles.map((v) => ({
      id: v.id,
      dir: v.dir,
      lane: v.lane,
      along: v.along,
      type: v.type,
      emergency: v.emergency,
      color: v.color,
      length: v.length,
      width: v.width,
      status: v.status,
      speed: v.speed,
    })),
    readings: engine.lastReadings,
    emergency: em ? { dir: em.dir, phase: em.phase, granted: em.grantedAt != null } : null,
    metrics: summarize(engine.metrics),
    history: engine.metrics.history,
    events: engine.events.slice(-40).reverse(),
    config: { ...engine.config },
  }
}
