// Hotspot zone overlay.
//
// Draws each approach's hotspot detection zone on its INBOUND half of the road,
// directly upstream of the stop line, using the same geometry constants the
// sensors use, so what you see is what the sensor measures.
//
// Colour shows the sensor state:
//   blue    idle (no vehicle in the zone)
//   teal    vehicles in the zone, none waiting
//   amber   a vehicle has been stopped long enough to request an early release
// The label shows the live dwell time while a vehicle is stopped in the zone.

import { C, HALF_ROAD, STOP_LINE } from '../../utils/geometry.js'
import { HOTSPOT } from '../../utils/constants.js'

export function drawSensors(ctx, readings) {
  if (!readings) return
  const len = HOTSPOT.length
  const zones = {
    north: { x: C - HALF_ROAD, y: C - STOP_LINE - len, w: HALF_ROAD, h: len },
    south: { x: C, y: C + STOP_LINE, w: HALF_ROAD, h: len },
    west: { x: C - STOP_LINE - len, y: C, w: len, h: HALF_ROAD },
    east: { x: C + STOP_LINE, y: C - HALF_ROAD, w: len, h: HALF_ROAD },
  }

  ctx.save()
  for (const dir of Object.keys(zones)) {
    const z = zones[dir]
    const r = readings[dir]
    const count = r?.hotspotCount ?? 0
    const dwell = r?.hotspotDwell ?? 0
    const waiting = (r?.hotspotStopped ?? 0) > 0

    let rgb = '91,184,255'
    let alpha = 0.08
    if (count > 0) {
      rgb = '61,220,200'
      alpha = 0.16
    }
    if (waiting && dwell >= HOTSPOT.minDwell) {
      rgb = '255,210,63'
      alpha = 0.2 + Math.min(0.2, dwell * 0.03)
    }

    ctx.fillStyle = `rgba(${rgb},${alpha})`
    ctx.fillRect(z.x, z.y, z.w, z.h)
    ctx.strokeStyle = `rgba(${rgb},0.65)`
    ctx.lineWidth = 1
    ctx.setLineDash([5, 4])
    ctx.strokeRect(z.x + 0.5, z.y + 0.5, z.w - 1, z.h - 1)
    ctx.setLineDash([])

    // Label chip just outside the far end of the zone.
    const label = waiting
      ? `${dir[0].toUpperCase()} hotspot ${dwell.toFixed(1)}s`
      : `${dir[0].toUpperCase()} hotspot ${count}`
    ctx.font = '10px ui-monospace, monospace'
    const tw = ctx.measureText(label).width
    let tx = z.x + 4
    let ty = z.y - 6
    if (dir === 'south') ty = z.y + z.h + 13
    if (dir === 'west') ty = z.y + z.h + 13
    ctx.fillStyle = 'rgba(8,12,18,0.7)'
    ctx.fillRect(tx - 3, ty - 10, tw + 6, 14)
    ctx.fillStyle = waiting && dwell >= HOTSPOT.minDwell ? '#ffd23f' : '#bfe0ff'
    ctx.fillText(label, tx, ty)
  }
  ctx.restore()
}
