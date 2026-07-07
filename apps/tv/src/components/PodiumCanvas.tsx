'use client'

// The winners' circle: top-3 horses standing on a decorated podium, golden
// spotlights, canvas confetti. Same art as the race engine.

import { useEffect, useRef } from 'react'
import type { Horse } from '@last-sip-derby/shared'
import { drawHorse } from '../race/horse'
import { ConfettiPool } from '../race/particles'
import { COATS } from '../race/palette'

interface Props {
  top3: Horse[] // [winner, second, third]
}

// slot layout: [x fraction, block height fraction, horse scale, rank label]
const SLOTS: Array<{ x: number; h: number; s: number; label: string }> = [
  { x: 0.5, h: 0.34, s: 1.0, label: '1' },
  { x: 0.2, h: 0.24, s: 0.88, label: '2' },
  { x: 0.8, h: 0.17, s: 0.8, label: '3' },
]

export function PodiumCanvas({ top3 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const horsesRef = useRef(top3)
  horsesRef.current = top3

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const confetti = new ConfettiPool()
    let raf = 0
    let last = performance.now()
    let time = 0
    let armed = false

    // Canvas can't resolve CSS vars in font strings — read the real family
    // names that next/font stored in the variables.
    const styles = getComputedStyle(document.body)
    const displayFont = styles.getPropertyValue('--font-yeseva').trim() || 'Georgia, serif'
    const monoFont = styles.getPropertyValue('--font-courier').trim() || 'monospace'

    const frame = (t: number) => {
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
      ctx.clearRect(0, 0, W, H)
      const S = H / 560

      if (!armed) {
        armed = true
        confetti.startRain(4)
        confetti.cannon(W * 0.08, H, 1, H)
        confetti.cannon(W * 0.92, H, -1, H)
      }
      if (confetti.count < 40) confetti.startRain(1.5)

      const floorY = H * 0.94

      // ── Spotlight cones on the winner ──
      for (const sx of [0.12, 0.88]) {
        const g = ctx.createLinearGradient(W * sx, 0, W * 0.5, floorY)
        g.addColorStop(0, 'rgba(255,224,150,0.16)')
        g.addColorStop(1, 'rgba(255,224,150,0)')
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.moveTo(W * sx - 14 * S, -10)
        ctx.lineTo(W * sx + 14 * S, -10)
        ctx.lineTo(W * 0.5 + 150 * S, floorY)
        ctx.lineTo(W * 0.5 - 150 * S, floorY)
        ctx.closePath()
        ctx.fill()
      }

      // ── Floor glow ──
      const fg = ctx.createRadialGradient(W / 2, floorY, 10, W / 2, floorY, W * 0.45)
      fg.addColorStop(0, 'rgba(217,169,63,0.14)')
      fg.addColorStop(1, 'rgba(217,169,63,0)')
      ctx.fillStyle = fg
      ctx.fillRect(0, floorY - H * 0.2, W, H * 0.25)

      // Draw 3rd, 2nd, then winner so the center block overlaps nicely
      const order = [2, 1, 0]
      for (const idx of order) {
        const horse = horsesRef.current[idx]
        const slot = SLOTS[idx]
        if (!horse || !slot) continue
        const bx = W * slot.x
        const bw = Math.min(W * 0.26, 300 * S)
        const bh = H * slot.h
        const topY = floorY - bh

        // block
        const wood = ctx.createLinearGradient(bx - bw / 2, topY, bx - bw / 2, floorY)
        wood.addColorStop(0, '#5a3c1e')
        wood.addColorStop(0.12, '#4a3018')
        wood.addColorStop(1, '#2c1c0e')
        ctx.fillStyle = wood
        ctx.beginPath()
        ctx.roundRect(bx - bw / 2, topY, bw, bh, [10 * S, 10 * S, 0, 0])
        ctx.fill()
        // gold lip
        ctx.fillStyle = idx === 0 ? '#D9A943' : 'rgba(217,169,63,0.55)'
        ctx.beginPath()
        ctx.roundRect(bx - bw / 2 - 6 * S, topY - 7 * S, bw + 12 * S, 10 * S, 4 * S)
        ctx.fill()
        // rank numeral
        ctx.fillStyle = idx === 0 ? 'rgba(217,169,63,0.95)' : 'rgba(228,210,172,0.5)'
        ctx.font = `${Math.round((idx === 0 ? 64 : 44) * S)}px ${displayFont}`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(slot.label, bx, topY + bh * 0.48)
        ctx.font = `${Math.round((idx === 0 ? 22 : 16) * S)}px ${displayFont}`
        ctx.fillText(idx === 0 ? 'er' : 'e', bx + (idx === 0 ? 34 : 24) * S, topY + bh * 0.38)

        // horse (idle breathing), winner nods with pride
        const k = slot.s * S * 0.92
        ctx.save()
        ctx.translate(bx, topY - 2 * S)
        ctx.scale(k, k)
        drawHorse(ctx, {
          coat: COATS[horse.lane % COATS.length],
          silk: horse.color,
          number: horse.lane + 1,
          phase: 0,
          speedNorm: 0,
          time: time + idx * 2.4,
          fall: 0,
          dizzy: false,
        })
        // winner rosette
        if (idx === 0) {
          ctx.fillStyle = '#D9A943'
          for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2 + time * 0.4
            ctx.beginPath()
            ctx.ellipse(8 + Math.cos(a) * 13, -62 + Math.sin(a) * 13, 7, 4, a, 0, Math.PI * 2)
            ctx.fill()
          }
          ctx.fillStyle = '#C63C2E'
          ctx.beginPath()
          ctx.arc(8, -62, 8, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.restore()

        // nameplate
        ctx.fillStyle = 'rgba(14,10,6,0.82)'
        const name = horse.name
        ctx.font = `bold ${Math.round(17 * S)}px ${monoFont}`
        const tw = ctx.measureText(name).width
        ctx.beginPath()
        ctx.roundRect(bx - tw / 2 - 14 * S, floorY + 4 * S, tw + 28 * S, 26 * S, 6 * S)
        ctx.fill()
        ctx.strokeStyle = 'rgba(217,169,63,0.5)'
        ctx.lineWidth = 1.5 * S
        ctx.stroke()
        ctx.fillStyle = '#F4E8CE'
        ctx.textBaseline = 'middle'
        ctx.fillText(name, bx, floorY + 17 * S)
      }

      confetti.update(dt, W, H)
      confetti.draw(ctx, S)

      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [])

  return <canvas ref={canvasRef} className="h-full w-full" />
}
