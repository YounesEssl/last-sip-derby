'use client'

// Live race preview: a compact canvas strip with one row per horse,
// smoothed positions and tiny galloping silhouettes. Not the "real" race —
// a pit-wall monitor vibe that mirrors the TV.

import { useEffect, useRef } from 'react'
import type { Horse } from '@last-sip-derby/shared'

interface MiniHorse {
  display: number // smoothed position 0..100
  target: number
  phase: number
  color: string
  lane: number
  eliminated: boolean
}

interface Props {
  horses: Horse[]
  myHorseId: string | null
  paused: boolean
}

const ROW_H = 34
const PAD_X = 14
const LEFT_GUTTER = 8
const RIGHT_GUTTER = 34

export function MiniRace({ horses, myHorseId, paused }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stateRef = useRef<Map<string, MiniHorse>>(new Map())
  const propsRef = useRef({ horses, myHorseId, paused })
  propsRef.current = { horses, myHorseId, paused }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let raf = 0
    let last = performance.now()

    const frame = (t: number) => {
      const dt = Math.max(0, Math.min(0.05, (t - last) / 1000))
      last = t
      const { horses, myHorseId, paused } = propsRef.current

      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const w = canvas.clientWidth
      const h = ROW_H * Math.max(1, horses.length) + 16
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr)
        canvas.height = Math.round(h * dpr)
        canvas.style.height = `${h}px`
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)

      const trackL = PAD_X + LEFT_GUTTER
      const trackR = w - PAD_X - RIGHT_GUTTER
      const trackW = trackR - trackL

      // rows + finish line
      for (let i = 0; i < horses.length; i++) {
        const y = 8 + i * ROW_H + ROW_H / 2
        ctx.strokeStyle = 'rgba(217,169,63,0.16)'
        ctx.lineWidth = 1
        ctx.setLineDash([3, 5])
        ctx.beginPath()
        ctx.moveTo(trackL, y)
        ctx.lineTo(trackR + 20, y)
        ctx.stroke()
        ctx.setLineDash([])
      }
      // finish checkers
      const sq = 5
      for (let r = 0; r < Math.ceil((ROW_H * horses.length) / sq); r++) {
        for (let c = 0; c < 2; c++) {
          ctx.fillStyle = (r + c) % 2 === 0 ? 'rgba(244,232,206,0.75)' : 'rgba(20,14,8,0.9)'
          ctx.fillRect(trackR + 20 + c * sq, 8 + r * sq, sq, Math.min(sq, ROW_H * horses.length - r * sq))
        }
      }

      for (const horse of horses) {
        let m = stateRef.current.get(horse.id)
        if (!m) {
          m = {
            display: horse.position,
            target: horse.position,
            phase: Math.random(),
            color: horse.color,
            lane: horse.lane,
            eliminated: horse.isEliminated,
          }
          stateRef.current.set(horse.id, m)
        }
        m.target = horse.position
        m.eliminated = horse.isEliminated
        m.display += (m.target - m.display) * Math.min(1, dt * 7)
        const moving = !paused && !m.eliminated && Math.abs(m.target - m.display) > 0.01
        if (moving) m.phase = (m.phase + dt * 2.6) % 1

        const x = trackL + (Math.min(100, m.display) / 100) * trackW
        const y = 8 + m.lane * ROW_H + ROW_H / 2
        drawMiniHorse(ctx, x, y, m, t / 1000, horse.id === myHorseId)
      }

      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [])

  return <canvas ref={canvasRef} className="w-full" />
}

function drawMiniHorse(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  m: MiniHorse,
  time: number,
  isMine: boolean,
) {
  const bob = m.eliminated ? 0 : Math.sin(m.phase * Math.PI * 2) * 1.6
  const color = m.eliminated ? '#5a544a' : m.color

  ctx.save()
  ctx.translate(x, y + bob)

  if (isMine && !m.eliminated) {
    ctx.strokeStyle = '#D9A943'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.ellipse(0, 0, 16, 12, 0, 0, Math.PI * 2)
    ctx.stroke()
  }

  if (m.eliminated) ctx.rotate(-0.35)

  // legs
  ctx.strokeStyle = color
  ctx.lineWidth = 2
  ctx.lineCap = 'round'
  for (let i = 0; i < 4; i++) {
    const off = [0, 0.15, 0.5, 0.65][i]
    const a = m.eliminated ? (i < 2 ? 0.9 : -0.9) : Math.sin((m.phase + off) * Math.PI * 2) * 0.7
    const lx = i < 2 ? 5 : -5
    ctx.beginPath()
    ctx.moveTo(lx, 2)
    ctx.lineTo(lx + Math.sin(a) * 6, 8)
    ctx.stroke()
  }
  // body
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.ellipse(0, 0, 8, 4.5, 0, 0, Math.PI * 2)
  ctx.fill()
  // neck + head
  ctx.beginPath()
  ctx.ellipse(8, -4 + (m.eliminated ? 4 : Math.sin(m.phase * Math.PI * 2 + 1) * 1), 3.4, 2.6, 0.5, 0, Math.PI * 2)
  ctx.fill()
  // tail
  ctx.strokeStyle = color
  ctx.lineWidth = 1.6
  ctx.beginPath()
  ctx.moveTo(-8, -1)
  ctx.quadraticCurveTo(-12, -4 + Math.sin(time * 3 + m.lane) * 1.5, -14, -1)
  ctx.stroke()

  if (m.eliminated) {
    ctx.rotate(0.35)
    ctx.fillStyle = 'rgba(244,232,206,0.8)'
    ctx.font = 'bold 10px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('✕', 0, -10)
  }

  ctx.restore()
}
