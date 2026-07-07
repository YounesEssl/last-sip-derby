'use client'

// Living backdrop for the idle screen: the race-engine scenery at dusk,
// slow camera drift, and every now and then a lone horse jogging past.

import { useEffect, useRef } from 'react'
import { Scenery } from '../race/scenery'
import { Track } from '../race/track'
import { drawHorse, hoofContact } from '../race/horse'
import { DustPool } from '../race/particles'
import { HORSE_COLORS } from '@last-sip-derby/shared'
import { COATS, laneGroundY, laneScale } from '../race/palette'

const PAN_SPEED = 26 // px/s camera drift
const HORSE_SPEED = 430 // px/s
const WORLD_LOOP = 11000

export function AmbientScene({ dim = 0.42 }: { dim?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const scenery = new Scenery(42)
    const track = new Track(49)
    const dust = new DustPool()
    let raf = 0
    let last = performance.now()
    let time = 0
    let phase = 0
    let passCount = 0

    const frame = (t: number) => {
      // rAF timestamps can precede the performance.now() captured at mount —
      // clamp to 0 or `time` goes negative and array indices break.
      const dt = Math.max(0, Math.min(0.05, (t - last) / 1000))
      last = t
      time += dt

      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const W = canvas.clientWidth
      const H = canvas.clientHeight
      if (W === 0 || H === 0) {
        raf = requestAnimationFrame(frame)
        return
      }
      if (canvas.width !== Math.round(W * dpr)) {
        canvas.width = Math.round(W * dpr)
        canvas.height = Math.round(H * dpr)
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const S = H / 1080
      const cam = time * PAN_SPEED

      scenery.drawSky(ctx, W, H, cam, time)
      scenery.drawHills(ctx, W, H, cam)
      scenery.drawTreeLine(ctx, W, H, cam)
      scenery.drawGrass(ctx, W, H, cam)
      scenery.drawGrandstand(ctx, W, H, cam, time, 0.06)
      scenery.drawFarRail(ctx, W, H, cam)
      track.drawSurface(ctx, W, H, cam % WORLD_LOOP)

      // The passer-by: loops around the world, changing coat each lap
      const horseWorldX = time * HORSE_SPEED
      const lap = Math.max(0, Math.floor(horseWorldX / (WORLD_LOOP + W * 2)))
      const hx = (horseWorldX % (WORLD_LOOP + W * 2)) - (cam % WORLD_LOOP)
      const lane = 2 + (lap % 3)
      if (hx > -200 && hx < W + 200) {
        if (lap !== passCount) passCount = lap
        const groundY = laneGroundY(lane, H)
        const k = laneScale(lane) * S * 0.92
        phase = (phase + dt * 2.3) % 1
        const contact = hoofContact(phase)
        if (contact > 0.5 && Math.random() < 0.5) {
          dust.spawn(hx - 40 * k, groundY - 2, k, 0.7)
        }
        ctx.save()
        ctx.translate(hx, groundY)
        ctx.scale(k, k)
        drawHorse(ctx, {
          coat: COATS[lap % COATS.length],
          silk: HORSE_COLORS[lap % HORSE_COLORS.length],
          number: (lap % 5) + 1,
          phase,
          speedNorm: 0.78,
          time,
          fall: 0,
          dizzy: false,
        })
        ctx.restore()
      }
      dust.update(dt)
      dust.draw(ctx, 0, W)
      scenery.drawNearRail(ctx, W, H, cam)

      // Legibility dim + top gradient for the marquee title
      ctx.fillStyle = `rgba(10,7,4,${dim})`
      ctx.fillRect(0, 0, W, H)
      const g = ctx.createLinearGradient(0, 0, 0, H * 0.55)
      g.addColorStop(0, 'rgba(10,7,4,0.55)')
      g.addColorStop(1, 'rgba(10,7,4,0)')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, W, H * 0.55)

      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [dim])

  return <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
}
