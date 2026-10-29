// Predefined test scenarios (prompt section 11).
//
// Each scenario fixes the traffic arrival schedule inputs (volume, demand,
// weather, seed, duration) so the fixed-time and adaptive controllers can be
// run against IDENTICAL conditions and compared fairly.

import { MODE } from '../utils/constants.js'

export const SCENARIOS = [
  {
    id: 'normal',
    name: 'Normal Traffic',
    description:
      'Moderate, balanced traffic under clear weather. Baseline check that vehicles move and signals operate correctly.',
    config: {
      weatherKey: 'clear',
      volumeKey: 'normal',
      totalRate: 0.5,
      demand: { north: 1, south: 1, east: 1, west: 1 },
      seed: 'normal-42',
    },
    duration: 180,
  },
  {
    id: 'rush',
    name: 'Rush-Hour Congestion',
    description:
      'High arrival rate with heavier north-south demand. Tests whether adaptive control responds to growing queues on the busy axis.',
    config: {
      weatherKey: 'clear',
      volumeKey: 'rush',
      totalRate: 1.0,
      demand: { north: 3, south: 3, east: 1, west: 1 },
      seed: 'rush-42',
    },
    duration: 240,
  },
  {
    id: 'low',
    name: 'Low Traffic Volume',
    description:
      'Few vehicles arrive. Evaluates unnecessary waiting time: fixed timers may hold green on empty approaches while adaptive should not.',
    config: {
      weatherKey: 'clear',
      volumeKey: 'low',
      totalRate: 0.18,
      demand: { north: 1, south: 1, east: 1, west: 1 },
      seed: 'low-42',
    },
    duration: 180,
  },
  {
    id: 'weather',
    name: 'Adverse Weather',
    description:
      'Heavy rain reduces vehicle speeds and lengthens yellow/all-red clearance. Verifies safe transitions and weather-aware timing.',
    config: {
      weatherKey: 'rain',
      volumeKey: 'normal',
      totalRate: 0.6,
      demand: { north: 2, south: 2, east: 1, west: 1 },
      seed: 'weather-42',
    },
    duration: 200,
  },
  {
    id: 'emergency',
    name: 'Emergency Vehicle',
    description:
      'An emergency vehicle is injected on the east approach during a conflicting phase. Verifies safe priority handling and restoration of normal operation.',
    config: {
      weatherKey: 'clear',
      volumeKey: 'normal',
      totalRate: 0.5,
      demand: { north: 2, south: 2, east: 1, west: 1 },
      seed: 'emergency-42',
    },
    duration: 150,
    // Scripted events: inject an emergency at t=20s from the east.
    events: [{ at: 20, type: 'emergency', dir: 'east' }],
  },
]

export const MODES_TO_COMPARE = [MODE.FIXED, MODE.ADAPTIVE]

export function getScenario(id) {
  return SCENARIOS.find((s) => s.id === id) ?? SCENARIOS[0]
}
