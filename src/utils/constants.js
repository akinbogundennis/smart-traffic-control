// Single source of truth for simulation configuration.
//
// All timing values are "configurable simulation assumptions, not real-world
// traffic engineering standards" (per the project prompt).

// ---------------------------------------------------------------------------
// Geometry / directions
// ---------------------------------------------------------------------------

// Four controlled approaches. A vehicle's direction is the side it ENTERS from
// and travels toward the centre.
//   north -> travels downward (south-bound), enters from the top
//   south -> travels upward   (north-bound), enters from the bottom
//   east  -> travels leftward (west-bound),  enters from the right
//   west  -> travels rightward (east-bound), enters from the left
export const DIRECTIONS = ['north', 'south', 'east', 'west']

// Lanes per approach (two inbound lanes each => "four lanes, two on each side"
// for the highway, mirrored on the cross road).
export const LANES_PER_APPROACH = 2

// Two non-conflicting signal groups. North/South run together; East/West run
// together. This guarantees conflicting movements never get green at once.
export const PHASES = {
  NS: ['north', 'south'],
  EW: ['east', 'west'],
}
export const PHASE_KEYS = ['NS', 'EW']

export function phaseOfDirection(dir) {
  return PHASES.NS.includes(dir) ? 'NS' : 'EW'
}

export function opposingPhase(phaseKey) {
  return phaseKey === 'NS' ? 'EW' : 'NS'
}

// ---------------------------------------------------------------------------
// Signal states and controller stages
// ---------------------------------------------------------------------------

export const LIGHT = {
  RED: 'red',
  YELLOW: 'yellow',
  GREEN: 'green',
}

// Stage within a signal cycle. ALL_RED is the safety clearance interval.
export const STAGE = {
  GREEN: 'green',
  YELLOW: 'yellow',
  ALL_RED: 'allRed',
}

export const MODE = {
  FIXED: 'fixed',
  ADAPTIVE: 'adaptive',
}

// ---------------------------------------------------------------------------
// Signal timing (seconds) - prompt section 5 suggested parameters
// ---------------------------------------------------------------------------

export const TIMING = {
  minGreen: 10,
  maxGreen: 60,
  defaultGreen: 25,
  yellow: 3,
  allRed: 2,
  maxWaitThreshold: 90, // anti-starvation ceiling
}

// Adaptive green-time formula weights:
//   greenTime = clamp(baseGreen + queueWeight*queueLen + waitWeight*avgWait, min, max)
export const ADAPTIVE = {
  baseGreen: 12,
  queueWeight: 2.2, // seconds of green added per queued vehicle
  waitWeight: 0.25, // seconds of green added per second of average wait
  // Hysteresis: the active phase only yields if the opposing demand exceeds the
  // current demand by this margin (prevents rapid flip-flopping).
  switchMargin: 2,
}

// ---------------------------------------------------------------------------
// Weather - affects movement AND signal timing (prompt section 7)
// ---------------------------------------------------------------------------

export const WEATHER = {
  clear: {
    label: 'Clear',
    speedFactor: 1.0, // multiplier on vehicle target speed
    accelFactor: 1.0, // multiplier on acceleration
    yellow: TIMING.yellow,
    allRed: TIMING.allRed,
    stoppingFactor: 1.0, // multiplier on stopping distance
  },
  rain: {
    label: 'Heavy Rain',
    speedFactor: 0.72,
    accelFactor: 0.7,
    yellow: TIMING.yellow + 1,
    allRed: TIMING.allRed + 1.5,
    stoppingFactor: 1.6,
  },
  fog: {
    label: 'Fog',
    speedFactor: 0.6,
    accelFactor: 0.8,
    yellow: TIMING.yellow + 2,
    allRed: TIMING.allRed + 2,
    stoppingFactor: 1.4,
  },
}
export const WEATHER_KEYS = Object.keys(WEATHER)

// ---------------------------------------------------------------------------
// Traffic volume presets - total vehicles/second across all approaches
// ---------------------------------------------------------------------------

export const VOLUME = {
  low: { label: 'Low Traffic', rate: 0.2 },
  normal: { label: 'Normal Traffic', rate: 0.5 },
  rush: { label: 'Rush Hour', rate: 0.95 },
  heavy: { label: 'Heavy Congestion', rate: 1.5 },
  custom: { label: 'Custom', rate: 0.5 },
}
export const VOLUME_KEYS = Object.keys(VOLUME)

// Default per-direction demand weights (relative share of arrivals). Used when
// volume is not "custom"; custom lets the operator set each direction.
export const DEFAULT_DEMAND = { north: 1, south: 1, east: 1, west: 1 }

// ---------------------------------------------------------------------------
// Vehicle physics (world units = pixels; time = seconds)
// ---------------------------------------------------------------------------

export const VEHICLE = {
  length: 22,
  width: 12,
  minGap: 8, // bumper gap when queued
  baseSpeed: 70, // px/s free-flow target speed (clear weather)
  accel: 55, // px/s^2
  decel: 120, // px/s^2 (braking)
  emergencySpeedBonus: 1.25, // emergency vehicles move a bit faster
}

export const VEHICLE_STATUS = {
  APPROACHING: 'approaching',
  QUEUED: 'queued',
  MOVING: 'moving',
  CROSSING: 'crossing',
  EXITED: 'exited',
}

export const VEHICLE_TYPE = {
  CAR: 'car',
  TRUCK: 'truck',
  BUS: 'bus',
  EMERGENCY: 'emergency',
}

// ---------------------------------------------------------------------------
// Simulation clock
// ---------------------------------------------------------------------------

export const SPEED_OPTIONS = [1, 2, 5]
// Fixed physics step for determinism. The clock accumulates real elapsed time
// (scaled by sim speed) and advances the world in steps of this size.
export const FIXED_DT = 1 / 60
