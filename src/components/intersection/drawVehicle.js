// Canvas vehicle sprite drawing.
//
// Draws detailed top-down vehicle sprites (car / truck / bus / emergency) so
// the simulation reads as real traffic rather than colored boxes. A sprite is
// authored pointing "up" (toward -y) and the caller rotates it to the travel
// heading. Emergency vehicles get a red/blue flashing light bar.

import { VEHICLE_TYPE } from '../../utils/constants.js'

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

// Draw a vehicle centered at (x, y), rotated by `angle` (radians), with the
// given body length/width/color. `flashPhase` drives the emergency light bar.
export function drawVehicle(ctx, { x, y, angle, length, width, color, type, emergency, flashPhase }) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(angle)

  const w = width
  const l = length

  // Soft shadow for depth.
  ctx.fillStyle = 'rgba(0,0,0,0.28)'
  roundedRect(ctx, -w / 2 + 1.5, -l / 2 + 2.5, w, l, 4)
  ctx.fill()

  // Body.
  ctx.fillStyle = color
  roundedRect(ctx, -w / 2, -l / 2, w, l, 4)
  ctx.fill()

  // Subtle body outline.
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'
  ctx.lineWidth = 1
  roundedRect(ctx, -w / 2, -l / 2, w, l, 4)
  ctx.stroke()

  if (type === VEHICLE_TYPE.BUS || type === VEHICLE_TYPE.TRUCK) {
    drawLargeVehicle(ctx, w, l, type)
  } else {
    drawCar(ctx, w, l)
  }

  if (emergency) drawEmergencyBar(ctx, w, l, flashPhase)

  ctx.restore()
}

function drawCar(ctx, w, l) {
  // Windshield (front, toward -y) and rear window.
  ctx.fillStyle = 'rgba(16,22,30,0.72)'
  roundedRect(ctx, -w / 2 + 2, -l / 2 + 3.5, w - 4, l * 0.26, 2)
  ctx.fill()
  roundedRect(ctx, -w / 2 + 2, l / 2 - l * 0.24 - 3.5, w - 4, l * 0.2, 2)
  ctx.fill()

  // Roof highlight strip.
  ctx.fillStyle = 'rgba(255,255,255,0.08)'
  roundedRect(ctx, -w / 2 + 3, -l * 0.12, w - 6, l * 0.24, 2)
  ctx.fill()

  // Headlights (front) and taillights (rear).
  ctx.fillStyle = '#fff6cf'
  ctx.fillRect(-w / 2 + 1, -l / 2 + 1, 2.4, 2)
  ctx.fillRect(w / 2 - 3.4, -l / 2 + 1, 2.4, 2)
  ctx.fillStyle = '#ff5a5a'
  ctx.fillRect(-w / 2 + 1, l / 2 - 3, 2.4, 2)
  ctx.fillRect(w / 2 - 3.4, l / 2 - 3, 2.4, 2)
}

function drawLargeVehicle(ctx, w, l, type) {
  // Cab/cargo split for trucks; long window band for buses.
  if (type === VEHICLE_TYPE.TRUCK) {
    ctx.fillStyle = 'rgba(16,22,30,0.7)'
    roundedRect(ctx, -w / 2 + 2, -l / 2 + 3, w - 4, l * 0.18, 2) // cab window
    ctx.fill()
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'
    ctx.beginPath()
    ctx.moveTo(-w / 2, -l / 2 + l * 0.32)
    ctx.lineTo(w / 2, -l / 2 + l * 0.32) // cab/cargo divider
    ctx.stroke()
  } else {
    ctx.fillStyle = 'rgba(16,22,30,0.68)'
    for (let i = 0; i < 4; i++) {
      const wy = -l / 2 + 5 + i * (l * 0.2)
      roundedRect(ctx, -w / 2 + 2, wy, w - 4, l * 0.12, 1.5)
      ctx.fill()
    }
  }
  ctx.fillStyle = '#fff6cf'
  ctx.fillRect(-w / 2 + 1, -l / 2 + 1, 2.4, 2)
  ctx.fillRect(w / 2 - 3.4, -l / 2 + 1, 2.4, 2)
}

function drawEmergencyBar(ctx, w, l, flashPhase) {
  // A light bar near the front that alternates red/blue.
  const on = Math.floor((flashPhase ?? 0) * 4) % 2 === 0
  const leftColor = on ? '#ff3b3b' : '#1f6bff'
  const rightColor = on ? '#1f6bff' : '#ff3b3b'
  ctx.fillStyle = leftColor
  ctx.fillRect(-w / 2 + 1.5, -l * 0.06, w / 2 - 2, 3.5)
  ctx.fillStyle = rightColor
  ctx.fillRect(0.5, -l * 0.06, w / 2 - 2, 3.5)

  // Glow.
  ctx.fillStyle = on ? 'rgba(255,59,59,0.22)' : 'rgba(31,107,255,0.22)'
  ctx.beginPath()
  ctx.arc(0, -l * 0.04, w, 0, Math.PI * 2)
  ctx.fill()

  // White cross on the roof to read as an ambulance.
  ctx.fillStyle = '#e23b3b'
  ctx.fillRect(-1.5, l * 0.08, 3, 9)
  ctx.fillRect(-4.5, l * 0.08 + 3, 9, 3)
}
