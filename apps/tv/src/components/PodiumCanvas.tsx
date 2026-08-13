'use client'

// The winners' circle: top-3 horses standing on a decorated podium, golden
// spotlights, canvas confetti. Same art as the race engine.

import { useEffect, useRef } from 'react'
import type { Horse } from '@last-sip-derby/shared'
import { drawBlackKnightRider, drawCamel, drawHorse, drawMotorcycle, drawScooter } from '../race/horse'
import { ConfettiPool } from '../race/particles'
import { COATS } from '../race/palette'

interface Props {
  top3: Horse[] // [winner, second, third]
  paused?: boolean
}

// slot layout: [x fraction, block height fraction, horse scale, rank label]
const SLOTS: Array<{ x: number; h: number; s: number; label: string }> = [
  { x: 0.5, h: 0.34, s: 1.0, label: '1' },
  { x: 0.2, h: 0.24, s: 0.88, label: '2' },
  { x: 0.8, h: 0.17, s: 0.8, label: '3' },
]

const GOLDEN_COAT = { body: '#D9A943', dark: '#7A5518', light: '#FFE79A', mane: '#5A3B0E' }
const DIAMOND_COAT = { body: '#52B9E8', dark: '#1A6199', light: '#D8F7FF', mane: '#163C70' }
const BLACK_COAT = { body: '#17191D', dark: '#050607', light: '#454A52', mane: '#010101' }

export function PodiumCanvas({ top3, paused = false }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pausedRef = useRef(paused)
  pausedRef.current = paused
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
      if (pausedRef.current) {
        raf = requestAnimationFrame(frame)
        return
      }
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

        // Preserve the exact final runner skin instead of substituting a base horse.
        const k = slot.s * S * 0.92
        if (horse.isGolden || horse.isDiamond || horse.isBlackKnight) {
          const trailColor = horse.isBlackKnight ? '18,20,24' : horse.isDiamond ? '80,195,235' : '217,169,63'
          for (let puff = 0; puff < 4; puff++) {
            const drift = ((time * 22 + puff * 29) % 92) * slot.s * S
            const alpha = Math.max(0, .28 - drift / (420 * slot.s * S))
            ctx.fillStyle = `rgba(${trailColor},${alpha})`
            ctx.beginPath()
            ctx.ellipse(bx - 25 * k - drift, topY - 3 * S, (18 + puff * 4) * k, (4 + puff) * k, 0, 0, Math.PI * 2)
            ctx.fill()
          }
        }
        ctx.save()
        ctx.translate(bx, topY - 2 * S)
        ctx.scale(horse.isReversed ? -k : k, k)
        if (horse.isGolden) {
          ctx.shadowColor = '#FFE36A'
          ctx.shadowBlur = 20
        }
        if (horse.isDiamond) {
          ctx.shadowColor = '#69D9FF'
          ctx.shadowBlur = 28
        }
        const jockeyFall = horse.jockeyFallen || horse.miniGameJockeyFallen ? 1 : 0
        const runnerOpts = {
          silk: horse.color,
          number: horse.lane + 1,
          phase: 0,
          speedNorm: 0,
          time: time + idx * 2.4,
          fall: 0,
          jockeyFall,
          golden: horse.isGolden,
          diamond: horse.isDiamond,
          blackKnight: horse.isBlackKnight,
        }
        if (horse.appearance === 'CAMEL') drawCamel(ctx, runnerOpts)
        else if (horse.appearance === 'MOTORCYCLE') drawMotorcycle(ctx, runnerOpts)
        else if (horse.appearance === 'SCOOTER') drawScooter(ctx, runnerOpts)
        else {
          drawHorse(ctx, {
            ...runnerOpts,
            coat: horse.isBlackKnight ? BLACK_COAT : horse.isDiamond ? DIAMOND_COAT : horse.isGolden ? GOLDEN_COAT : COATS[horse.lane % COATS.length],
            jockeyFall: horse.isBlackKnight ? 1 : jockeyFall,
            dizzy: false,
          })
          if (horse.isBlackKnight) drawBlackKnightRider(ctx, -2, -80, time + idx * 2.4)
        }
        ctx.restore()

        // Name above the jockey: long names can no longer collide below the podium.
        ctx.fillStyle = 'rgba(14,10,6,0.82)'
        const name = horse.name
        ctx.font = `bold ${Math.round(14 * S)}px ${monoFont}`
        const fittedName = name.length > 20 ? `${name.slice(0, 19)}…` : name
        const tw = Math.min(bw - 10 * S, ctx.measureText(fittedName).width)
        ctx.beginPath()
        const labelY = topY - 145 * slot.s * S
        ctx.roundRect(bx - tw / 2 - 10 * S, labelY, tw + 20 * S, 25 * S, 6 * S)
        ctx.fill()
        ctx.strokeStyle = 'rgba(217,169,63,0.5)'
        ctx.lineWidth = 1.5 * S
        ctx.stroke()
        ctx.fillStyle = '#F4E8CE'
        ctx.textBaseline = 'middle'
        ctx.fillText(fittedName, bx, labelY + 13 * S, tw)
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
