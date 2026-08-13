'use client'

// Small always-galloping horse for the odds board rows.

import { useEffect, useRef } from 'react'
import { drawHorse } from '../race/horse'
import { COATS } from '../race/palette'

export function RowHorse({ lane, silk, size = 64, paused = false }: { lane: number; silk: string; size?: number; paused?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pausedRef = useRef(paused)
  pausedRef.current = paused

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    let raf = 0
    let last = performance.now()
    let phase = Math.random()
    let time = 0

    const frame = (t: number) => {
      const dt = Math.max(0, Math.min(0.05, (t - last) / 1000))
      last = t
      if (pausedRef.current) {
        raf = requestAnimationFrame(frame)
        return
      }
      time += dt
      phase = (phase + dt * 2.1) % 1

      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const w = size * 1.9
      const h = size * 1.3
      if (canvas.width !== Math.round(w * dpr)) {
        canvas.width = Math.round(w * dpr)
        canvas.height = Math.round(h * dpr)
        canvas.style.width = `${w}px`
        canvas.style.height = `${h}px`
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)
      ctx.save()
      ctx.translate(w * 0.46, h * 0.94)
      ctx.scale(size / 155, size / 155)
      drawHorse(ctx, {
        coat: COATS[lane % COATS.length],
        silk,
        number: lane + 1,
        phase,
        speedNorm: 0.72,
        time: time + lane * 1.3,
        fall: 0,
        dizzy: false,
      })
      ctx.restore()
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [lane, silk, size])

  return <canvas ref={canvasRef} />
}
