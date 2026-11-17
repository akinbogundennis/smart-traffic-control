import { useEffect, useRef } from 'react'
import { WORLD } from '../../utils/geometry.js'
import { headingAngle, toXY } from '../../utils/geometry.js'
import { drawScene, drawSignals, drawWeather } from './drawScene.js'
import { drawSensors } from './drawHotspots.js'
import { drawVehicle } from './drawVehicle.js'

// The animated top-down intersection. Renders purely from the snapshot each
// time it changes; the simulation itself runs in the engine via useSimulation.

export default function IntersectionCanvas({ snap, showSensors }) {
  const canvasRef = useRef(null)
  const flashRef = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return // canvas not available (e.g. non-browser environment)
    // Advance a small flash/weather phase for animated effects.
    flashRef.current = (flashRef.current + 0.08) % 1000

    ctx.clearRect(0, 0, WORLD, WORLD)
    drawScene(ctx)

    if (snap) {
      if (showSensors) drawSensors(ctx, snap.readings)

      // Vehicles.
      for (const v of snap.vehicles) {
        const { x, y } = toXY(v.dir, v.along, v.lane)
        drawVehicle(ctx, {
          x,
          y,
          angle: headingAngle(v.dir),
          length: v.length,
          width: v.width,
          color: v.color,
          type: v.type,
          emergency: v.emergency,
          flashPhase: flashRef.current,
        })
      }

      drawSignals(ctx, snap.lights)
      drawWeather(ctx, snap.weatherKey, flashRef.current)
    }
  }, [snap, showSensors])

  return (
    <div className="relative w-full">
      <canvas
        ref={canvasRef}
        width={WORLD}
        height={WORLD}
        className="w-full h-auto rounded-xl bg-[#17211b] border border-line"
      />
      {snap && <Hud snap={snap} />}
    </div>
  )
}

function Hud({ snap }) {
  const phaseLabel = snap.phaseKey === 'NS' ? 'North-South' : 'East-West'
  const stageLabel =
    snap.stage === 'green' ? 'GREEN' : snap.stage === 'yellow' ? 'YELLOW' : 'ALL-RED'
  const stageColor =
    snap.stage === 'green'
      ? 'text-signal-green'
      : snap.stage === 'yellow'
        ? 'text-signal-yellow'
        : 'text-signal-red'

  return (
    <div className="absolute top-3 left-3 flex flex-col gap-2 pointer-events-none">
      <div className="bg-black/55 backdrop-blur rounded-lg px-3 py-2 text-xs">
        <div className="text-muted">Active phase</div>
        <div className="font-semibold">{phaseLabel}</div>
        <div className={`font-mono ${stageColor}`}>
          {stageLabel} · {snap.timeToTransition.toFixed(1)}s
        </div>
      </div>
      {snap.emergency && (
        <div className="bg-danger/85 rounded-lg px-3 py-2 text-xs font-semibold animate-pulse">
          EMERGENCY · {snap.emergency.dir.toUpperCase()}
          {snap.emergency.granted ? ' (priority granted)' : ' (requesting)'}
        </div>
      )}
    </div>
  )
}
