// useSimulation - React hook that owns the live simulation engine.
//
// Keeps the mutable engine in a ref (it is stepped every animation frame and
// must not trigger React renders on its own). A throttled snapshot is pushed
// into React state so the UI updates smoothly without re-rendering on every
// one of the 60 fixed steps per second.
//
// The hook exposes operator actions (start/pause/reset/speed/config/emergency)
// that the control panel calls. All of them manipulate the engine; none of the
// simulation logic lives in components.

import { useCallback, useEffect, useRef, useState } from 'react'
import { MODE } from '../utils/constants.js'
import {
  createEngine,
  step as stepEngine,
  snapshot,
  updateConfig,
  injectEmergency as injectEmergencyEngine,
  resetEngine,
} from '../simulation/SimulationEngine.js'

const SNAPSHOT_HZ = 30 // UI snapshots per second

export function useSimulation(initialConfig) {
  const [config, setConfig] = useState({
    mode: MODE.ADAPTIVE,
    weatherKey: 'clear',
    volumeKey: 'normal',
    totalRate: 0.5,
    demand: { north: 1, south: 1, east: 1, west: 1 },
    seed: '42',
    ...initialConfig,
  })
  const [running, setRunning] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [snap, setSnap] = useState(null)

  const engineRef = useRef(null)
  const rafRef = useRef(null)
  const lastTsRef = useRef(null)
  const snapAccumRef = useRef(0)

  // (Re)build the engine from config whenever config changes while stopped.
  const build = useCallback(() => {
    engineRef.current = createEngine(config)
    setSnap(snapshot(engineRef.current))
  }, [config])

  useEffect(() => {
    if (!running) build()
  }, [build, running])

  // Animation loop.
  useEffect(() => {
    if (!running) return

    function frame(ts) {
      if (lastTsRef.current == null) lastTsRef.current = ts
      let realDelta = (ts - lastTsRef.current) / 1000
      lastTsRef.current = ts
      realDelta = Math.min(realDelta, 0.1) // guard against big jumps

      const engine = engineRef.current
      if (engine) {
        stepEngine(engine, realDelta, speed)
        snapAccumRef.current += realDelta
        if (snapAccumRef.current >= 1 / SNAPSHOT_HZ) {
          snapAccumRef.current = 0
          setSnap(snapshot(engine))
        }
      }
      rafRef.current = requestAnimationFrame(frame)
    }

    rafRef.current = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(rafRef.current)
      lastTsRef.current = null
    }
  }, [running, speed])

  const start = useCallback(() => setRunning(true), [])
  const pause = useCallback(() => setRunning(false), [])

  const reset = useCallback(() => {
    setRunning(false)
    lastTsRef.current = null
    if (engineRef.current) {
      resetEngine(engineRef.current)
      setSnap(snapshot(engineRef.current))
    } else {
      build()
    }
  }, [build])

  // Live config updates. Weather/volume/demand apply to the running engine;
  // mode/seed changes reset the run so comparisons stay clean.
  const changeConfig = useCallback((patch) => {
    setConfig((c) => {
      const nextCfg = { ...c, ...patch }
      const resetKeys = ['mode', 'seed']
      const needsReset = resetKeys.some((k) => k in patch)
      if (engineRef.current && !needsReset) {
        updateConfig(engineRef.current, patch)
        setSnap(snapshot(engineRef.current))
      } else {
        setRunning(false)
        lastTsRef.current = null
      }
      return nextCfg
    })
  }, [])

  const setSimSpeed = useCallback((s) => setSpeed(s), [])

  const triggerEmergency = useCallback((dir) => {
    if (engineRef.current) {
      injectEmergencyEngine(engineRef.current, dir)
      setSnap(snapshot(engineRef.current))
    }
  }, [])

  return {
    config,
    running,
    speed,
    snap,
    start,
    pause,
    reset,
    changeConfig,
    setSimSpeed,
    triggerEmergency,
  }
}
