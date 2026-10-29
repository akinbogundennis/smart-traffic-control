// Canvas scene drawing: roads, lane markings, crosswalks, stop lines,
// directional arrows, signal heads, sensor overlays, and weather effects.
// Pure drawing helpers; all positions come from utils/geometry.

import {
  WORLD,
  C,
  LANE_W,
  ROAD_W,
  HALF_ROAD,
  STOP,
  laneCenter,
} from '../../utils/geometry.js'
import { LANES_PER_APPROACH, LIGHT } from '../../utils/constants.js'

const COL = {
  ground: '#17211b',
  grass: '#1a2b20',
  road: '#2f3741',
  roadDark: '#2a313a',
  box: '#343c47',
  edge: '#434d5c',
  dash: '#d4dbe3',
  stop: '#eef2f6',
  crosswalk: '#c7ced7',
  arrow: '#9fb0c2',
}

export function drawScene(ctx) {
  // Ground.
  ctx.fillStyle = COL.ground
  ctx.fillRect(0, 0, WORLD, WORLD)

  // Corner "blocks" (just subtle ground texture).
  ctx.fillStyle = COL.grass
  const corners = [
    [0, 0],
    [C + HALF_ROAD, 0],
    [0, C + HALF_ROAD],
    [C + HALF_ROAD, C + HALF_ROAD],
  ]
  const cornerSize = C - HALF_ROAD
  for (const [cx, cy] of corners) {
    ctx.fillRect(cx, cy, cornerSize, cornerSize)
  }

  // Roads.
  ctx.fillStyle = COL.road
  ctx.fillRect(C - HALF_ROAD, 0, ROAD_W, WORLD) // N-S
  ctx.fillRect(0, C - HALF_ROAD, WORLD, ROAD_W) // E-W

  // Intersection box slightly lighter.
  ctx.fillStyle = COL.box
  ctx.fillRect(C - HALF_ROAD, C - HALF_ROAD, ROAD_W, ROAD_W)

  drawRoadEdges(ctx)
  drawLaneMarkings(ctx)
  drawStopLinesAndCrosswalks(ctx)
  drawDirectionalArrows(ctx)
}

function drawRoadEdges(ctx) {
  ctx.strokeStyle = COL.edge
  ctx.lineWidth = 2
  // Vertical road sides.
  line(ctx, C - HALF_ROAD, 0, C - HALF_ROAD, WORLD)
  line(ctx, C + HALF_ROAD, 0, C + HALF_ROAD, WORLD)
  // Horizontal road sides.
  line(ctx, 0, C - HALF_ROAD, WORLD, C - HALF_ROAD)
  line(ctx, 0, C + HALF_ROAD, WORLD, C + HALF_ROAD)
}

function drawLaneMarkings(ctx) {
  // Solid double centre line per road (divides opposing directions).
  ctx.strokeStyle = '#e8c33b'
  ctx.lineWidth = 1.5
  ctx.setLineDash([])
  line(ctx, C - 1.5, 0, C - 1.5, C - HALF_ROAD)
  line(ctx, C + 1.5, 0, C + 1.5, C - HALF_ROAD)
  line(ctx, C - 1.5, C + HALF_ROAD, C - 1.5, WORLD)
  line(ctx, C + 1.5, C + HALF_ROAD, C + 1.5, WORLD)
  line(ctx, 0, C - 1.5, C - HALF_ROAD, C - 1.5)
  line(ctx, 0, C + 1.5, C - HALF_ROAD, C + 1.5)
  line(ctx, C + HALF_ROAD, C - 1.5, WORLD, C - 1.5)
  line(ctx, C + HALF_ROAD, C + 1.5, WORLD, C + 1.5)

  // Dashed lane separators between same-direction lanes.
  ctx.strokeStyle = COL.dash
  ctx.lineWidth = 1.5
  ctx.setLineDash([12, 12])
  // Vertical road: separators at offsets +/- LANE_W from centre (for 2 lanes/side).
  for (let i = 1; i < LANES_PER_APPROACH; i++) {
    const o = LANE_W * i
    line(ctx, C + o, 0, C + o, C - HALF_ROAD)
    line(ctx, C + o, C + HALF_ROAD, C + o, WORLD)
    line(ctx, C - o, 0, C - o, C - HALF_ROAD)
    line(ctx, C - o, C + HALF_ROAD, C - o, WORLD)
  }
  // Horizontal road.
  for (let i = 1; i < LANES_PER_APPROACH; i++) {
    const o = LANE_W * i
    line(ctx, 0, C + o, C - HALF_ROAD, C + o)
    line(ctx, C + HALF_ROAD, C + o, WORLD, C + o)
    line(ctx, 0, C - o, C - HALF_ROAD, C - o)
    line(ctx, C + HALF_ROAD, C - o, WORLD, C - o)
  }
  ctx.setLineDash([])
}

function drawStopLinesAndCrosswalks(ctx) {
  ctx.fillStyle = COL.stop
  const t = 4
  // Drive-on-the-right (US): stop lines cover each approach's inbound half.
  // North approach inbound = west half (x in [C-HALF_ROAD, C]).
  ctx.fillRect(C - HALF_ROAD, C - STOP - t, HALF_ROAD, t)
  // South approach inbound = east half (x in [C, C+HALF_ROAD]).
  ctx.fillRect(C, C + STOP, HALF_ROAD, t)
  // West approach inbound = south half (y in [C, C+HALF_ROAD]).
  ctx.fillRect(C - STOP - t, C, t, HALF_ROAD)
  // East approach inbound = north half (y in [C-HALF_ROAD, C]).
  ctx.fillRect(C + STOP, C - HALF_ROAD, t, HALF_ROAD)

  // Crosswalk zebra stripes just outside each stop line.
  ctx.fillStyle = COL.crosswalk
  const stripeN = 6
  // Top crosswalk (spans the N-S road width).
  for (let i = 0; i < stripeN * 2; i++) {
    const x = C - HALF_ROAD + i * (ROAD_W / (stripeN * 2))
    ctx.fillRect(x, C - STOP - t - 14, ROAD_W / (stripeN * 2) - 2, 10)
  }
  for (let i = 0; i < stripeN * 2; i++) {
    const x = C - HALF_ROAD + i * (ROAD_W / (stripeN * 2))
    ctx.fillRect(x, C + STOP + t + 4, ROAD_W / (stripeN * 2) - 2, 10)
  }
  for (let i = 0; i < stripeN * 2; i++) {
    const y = C - HALF_ROAD + i * (ROAD_W / (stripeN * 2))
    ctx.fillRect(C - STOP - t - 14, y, 10, ROAD_W / (stripeN * 2) - 2)
  }
  for (let i = 0; i < stripeN * 2; i++) {
    const y = C - HALF_ROAD + i * (ROAD_W / (stripeN * 2))
    ctx.fillRect(C + STOP + t + 4, y, 10, ROAD_W / (stripeN * 2) - 2)
  }
}

// Draw a straight-ahead arrow in each inbound lane pointing toward the centre.
// Uses laneCenter so arrows always sit in the same inbound lanes the vehicles
// use (drive-on-the-right, US).
function drawDirectionalArrows(ctx) {
  ctx.fillStyle = COL.arrow
  const back = STOP + 55 // distance from centre where arrow sits

  for (let lane = 0; lane < LANES_PER_APPROACH; lane++) {
    // North inbound, pointing down (west half).
    arrow(ctx, laneCenter('north', lane), C - back, 'down')
    // South inbound, pointing up (east half).
    arrow(ctx, laneCenter('south', lane), C + back, 'up')
    // West inbound, pointing right (south half).
    arrow(ctx, C - back, laneCenter('west', lane), 'right')
    // East inbound, pointing left (north half).
    arrow(ctx, C + back, laneCenter('east', lane), 'left')
  }
}

function arrow(ctx, x, y, dir) {
  ctx.save()
  ctx.translate(x, y)
  const rot = { up: 0, down: Math.PI, right: Math.PI / 2, left: -Math.PI / 2 }[dir]
  ctx.rotate(rot)
  ctx.beginPath()
  ctx.moveTo(0, -12)
  ctx.lineTo(6, 0)
  ctx.lineTo(2, 0)
  ctx.lineTo(2, 12)
  ctx.lineTo(-2, 12)
  ctx.lineTo(-2, 0)
  ctx.lineTo(-6, 0)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

// Signal heads for each approach, placed just outside the far corner of the box.
export function drawSignals(ctx, lights) {
  const off = HALF_ROAD + 22
  const positions = {
    north: { x: C - HALF_ROAD - 14, y: C - off, label: 'N' },
    south: { x: C + HALF_ROAD + 14, y: C + off, label: 'S' },
    east: { x: C + off, y: C - HALF_ROAD - 14, label: 'E' },
    west: { x: C - off, y: C + HALF_ROAD + 14, label: 'W' },
  }
  for (const dir of Object.keys(positions)) {
    drawSignalHead(ctx, positions[dir], lights[dir])
  }
}

function drawSignalHead(ctx, p, state) {
  const r = 7
  const gap = 2
  // Housing (vertical 3-lamp head).
  ctx.fillStyle = '#10151c'
  roundedRect(ctx, p.x - r - 3, p.y - (r * 3 + gap * 2 + 6) / 2, r * 2 + 6, r * 3 + gap * 2 + 6, 4)
  ctx.fill()

  const lamps = [
    { c: '#ff4d4d', on: state === LIGHT.RED },
    { c: '#ffd23f', on: state === LIGHT.YELLOW },
    { c: '#3ddc84', on: state === LIGHT.GREEN },
  ]
  const top = p.y - (r * 3 + gap * 2) / 2 + r / 2
  lamps.forEach((lamp, i) => {
    const cy = top + i * (r + gap) * 1.5
    ctx.beginPath()
    ctx.arc(p.x, cy, r / 1.4, 0, Math.PI * 2)
    ctx.fillStyle = lamp.on ? lamp.c : '#232c38'
    ctx.fill()
    if (lamp.on) {
      ctx.shadowColor = lamp.c
      ctx.shadowBlur = 10
      ctx.fill()
      ctx.shadowBlur = 0
    }
  })

  // Label.
  ctx.fillStyle = '#93a1b3'
  ctx.font = 'bold 10px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(p.label, p.x, p.y - (r * 3 + gap * 2 + 6) / 2 - 4)
  ctx.textAlign = 'start'
}

// Sensor visualization overlay: a translucent detection zone on each inbound
// approach with its live count/queue (prompt: "enable live sensor visualization").
export function drawSensors(ctx, readings) {
  if (!readings) return
  ctx.save()
  const zone = 70
  const specs = {
    north: { x: C, y: C - STOP - zone, w: HALF_ROAD, h: zone },
    south: { x: C - HALF_ROAD, y: C + STOP, w: HALF_ROAD, h: zone },
    west: { x: C - STOP - zone, y: C, w: zone, h: HALF_ROAD },
    east: { x: C + STOP, y: C - HALF_ROAD, w: zone, h: HALF_ROAD },
  }
  for (const dir of Object.keys(specs)) {
    const s = specs[dir]
    const r = readings[dir]
    const intensity = Math.min(1, (r?.queueLength ?? 0) / 8)
    ctx.fillStyle = `rgba(91,184,255,${0.08 + intensity * 0.22})`
    ctx.fillRect(s.x, s.y, s.w, s.h)
    ctx.strokeStyle = 'rgba(91,184,255,0.5)'
    ctx.setLineDash([4, 4])
    ctx.strokeRect(s.x, s.y, s.w, s.h)
    ctx.setLineDash([])
    ctx.fillStyle = '#bfe0ff'
    ctx.font = '9px ui-monospace, monospace'
    ctx.fillText(`${dir[0].toUpperCase()} q:${r?.queueLength ?? 0}`, s.x + 4, s.y + 12)
  }
  ctx.restore()
}

// Weather overlay (rain streaks / fog haze). `phase` animates it.
export function drawWeather(ctx, weatherKey, phase) {
  if (weatherKey === 'rain') {
    ctx.save()
    ctx.strokeStyle = 'rgba(170,200,230,0.35)'
    ctx.lineWidth = 1
    const n = 90
    for (let i = 0; i < n; i++) {
      const seed = (i * 97.13) % WORLD
      const x = (seed + phase * 220) % WORLD
      const y = (i * 53.7 + phase * 520) % WORLD
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x - 2, y + 9)
      ctx.stroke()
    }
    ctx.fillStyle = 'rgba(30,45,70,0.12)'
    ctx.fillRect(0, 0, WORLD, WORLD)
    ctx.restore()
  } else if (weatherKey === 'fog') {
    ctx.save()
    const g = ctx.createRadialGradient(C, C, WORLD * 0.15, C, C, WORLD * 0.7)
    g.addColorStop(0, 'rgba(200,210,220,0.05)')
    g.addColorStop(1, 'rgba(200,210,220,0.34)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, WORLD, WORLD)
    ctx.restore()
  }
}

function line(ctx, x1, y1, x2, y2) {
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.stroke()
}

// Local rounded-rect helper for the signal housing.
function roundedRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}
