'use client'

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { getMazeLayout, type MazeExitSide } from '@last-sip-derby/shared'
import { playGameFeedback } from './feedback'

interface Vector {
  x: number
  y: number
}

const BALL_RADIUS = 0.29
const ACCELERATION = 17
const MAX_SPEED = 3.8
const ACTIVE_DRAG = 1.15
const RELEASE_DRAG = 4.1
const JOYSTICK_RADIUS = 46

function circleHitsWall(cells: string[], x: number, y: number): boolean {
  const minX = Math.floor(x - BALL_RADIUS)
  const maxX = Math.floor(x + BALL_RADIUS)
  const minY = Math.floor(y - BALL_RADIUS)
  const maxY = Math.floor(y + BALL_RADIUS)
  for (let cellY = minY; cellY <= maxY; cellY++) {
    for (let cellX = minX; cellX <= maxX; cellX++) {
      if (cellY < 0 || cellX < 0 || cellY >= cells.length || cellX >= cells.length) continue
      if (cells[cellY][cellX] !== '#') continue
      const nearestX = Math.max(cellX, Math.min(x, cellX + 1))
      const nearestY = Math.max(cellY, Math.min(y, cellY + 1))
      const dx = x - nearestX
      const dy = y - nearestY
      if (dx * dx + dy * dy < BALL_RADIUS * BALL_RADIUS) return true
    }
  }
  return false
}

function hasFullyExited(side: MazeExitSide, size: number, x: number, y: number): boolean {
  if (side === 'TOP') return y + BALL_RADIUS < 0
  if (side === 'RIGHT') return x - BALL_RADIUS > size
  if (side === 'BOTTOM') return y - BALL_RADIUS > size
  return x + BALL_RADIUS < 0
}

export function MazeGame({ mazeIndex, active, paused = false, onFinish }: { mazeIndex: number; active: boolean; paused?: boolean; onFinish: () => void }) {
  const layout = useMemo(() => getMazeLayout(mazeIndex), [mazeIndex])
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const joystickRef = useRef<HTMLDivElement>(null)
  const joystickVectorRef = useRef<Vector>({ x: 0, y: 0 })
  const ballRef = useRef({ x: layout.start.x + 0.5, y: layout.start.y + 0.5, vx: 0, vy: 0 })
  const finishedRef = useRef(false)
  const onFinishRef = useRef(onFinish)
  const pausedRef = useRef(paused)
  const [joystickVisual, setJoystickVisual] = useState<Vector>({ x: 0, y: 0 })
  const [finished, setFinished] = useState(false)
  pausedRef.current = paused

  useEffect(() => {
    onFinishRef.current = onFinish
  }, [onFinish])

  useEffect(() => {
    ballRef.current = { x: layout.start.x + 0.5, y: layout.start.y + 0.5, vx: 0, vy: 0 }
    finishedRef.current = false
    setFinished(false)
  }, [layout])

  useEffect(() => {
    if (!paused) return
    joystickVectorRef.current = { x: 0, y: 0 }
    setJoystickVisual({ x: 0, y: 0 })
  }, [paused])

  useEffect(() => {
    let frame = 0
    let previous = performance.now()
    const render = (time: number) => {
      const canvas = canvasRef.current
      if (!canvas) {
        frame = requestAnimationFrame(render)
        return
      }
      const rect = canvas.getBoundingClientRect()
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const pixelWidth = Math.max(1, Math.round(rect.width * dpr))
      const pixelHeight = Math.max(1, Math.round(rect.height * dpr))
      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth
        canvas.height = pixelHeight
      }

      if (pausedRef.current) {
        previous = time
        const context = canvas.getContext('2d')
        if (context) drawMaze(context, pixelWidth, pixelHeight, dpr, layout.cells, layout.exit, ballRef.current)
        frame = requestAnimationFrame(render)
        return
      }

      const rawDt = Math.min(0.035, Math.max(0, (time - previous) / 1000))
      previous = time
      const ball = ballRef.current
      const joystick = active && !finishedRef.current ? joystickVectorRef.current : { x: 0, y: 0 }
      const strength = Math.min(1, Math.hypot(joystick.x, joystick.y))
      const steps = Math.max(1, Math.ceil(rawDt / (1 / 120)))
      const dt = rawDt / steps

      for (let step = 0; step < steps; step++) {
        ball.vx += joystick.x * ACCELERATION * dt
        ball.vy += joystick.y * ACCELERATION * dt
        const drag = Math.exp(-(strength > 0.04 ? ACTIVE_DRAG : RELEASE_DRAG) * dt)
        ball.vx *= drag
        ball.vy *= drag
        const speed = Math.hypot(ball.vx, ball.vy)
        if (speed > MAX_SPEED) {
          ball.vx = (ball.vx / speed) * MAX_SPEED
          ball.vy = (ball.vy / speed) * MAX_SPEED
        }

        const nextX = ball.x + ball.vx * dt
        if (!circleHitsWall(layout.cells, nextX, ball.y)) ball.x = nextX
        else ball.vx *= -0.08

        const nextY = ball.y + ball.vy * dt
        if (!circleHitsWall(layout.cells, ball.x, nextY)) ball.y = nextY
        else ball.vy *= -0.08

        if (!finishedRef.current && hasFullyExited(layout.exit.side, layout.size, ball.x, ball.y)) {
          finishedRef.current = true
          joystickVectorRef.current = { x: 0, y: 0 }
          setJoystickVisual({ x: 0, y: 0 })
          setFinished(true)
          onFinishRef.current()
          playGameFeedback('SUCCESS')
          if (navigator.vibrate) navigator.vibrate([35, 30, 90])
        }
      }

      const context = canvas.getContext('2d')
      if (context) drawMaze(context, pixelWidth, pixelHeight, dpr, layout.cells, layout.exit, ball)
      frame = requestAnimationFrame(render)
    }
    frame = requestAnimationFrame(render)
    return () => cancelAnimationFrame(frame)
  }, [active, layout])

  const updateJoystick = (event: ReactPointerEvent<HTMLDivElement>) => {
    const element = joystickRef.current
    if (!element || finished || pausedRef.current) return
    const rect = element.getBoundingClientRect()
    const rawX = event.clientX - (rect.left + rect.width / 2)
    const rawY = event.clientY - (rect.top + rect.height / 2)
    const distance = Math.hypot(rawX, rawY)
    const scale = distance > JOYSTICK_RADIUS ? JOYSTICK_RADIUS / distance : 1
    const visual = { x: rawX * scale, y: rawY * scale }
    setJoystickVisual(visual)
    joystickVectorRef.current = { x: visual.x / JOYSTICK_RADIUS, y: visual.y / JOYSTICK_RADIUS }
  }

  const releaseJoystick = () => {
    setJoystickVisual({ x: 0, y: 0 })
    joystickVectorRef.current = { x: 0, y: 0 }
  }

  return (
    <div className={`mx-auto flex w-full max-w-[370px] flex-col items-center rounded-3xl border p-2 transition-colors ${finished ? 'border-emerald-300 bg-emerald-700/70' : 'border-derby-gold/30 bg-black/20'}`}>
      <div className="mb-1 flex w-full items-center justify-between px-1 font-body text-[10px] uppercase tracking-[.16em] text-derby-smoke">
        <span>Labyrinthe n° {layout.id + 1}</span>
        <span>{finished ? 'SORTIE VALIDÉE' : 'Pilotez avec le pouce'}</span>
      </div>
      <canvas
        ref={canvasRef}
        data-testid="maze-canvas"
        className="aspect-square w-full max-w-[min(72vw,300px)] rounded-xl border-2 border-derby-gold/70 bg-[#d9c999] shadow-[inset_0_0_18px_rgba(0,0,0,.7)]"
      />
      <div
        ref={joystickRef}
        data-testid="maze-joystick"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId)
          updateJoystick(event)
        }}
        onPointerMove={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) updateJoystick(event)
        }}
        onPointerUp={releaseJoystick}
        onPointerCancel={releaseJoystick}
        className="relative mt-2 h-[108px] w-[108px] shrink-0 touch-none rounded-full border-2 border-derby-gold/60 bg-[radial-gradient(circle,#3d352c_0,#211b17_68%,#0f0b09_100%)] shadow-[inset_0_4px_14px_rgba(0,0,0,.75),0_3px_12px_rgba(0,0,0,.5)]"
        aria-label="Joystick analogique"
      >
        <div className="absolute left-1/2 top-1/2 h-1 w-[72%] -translate-x-1/2 -translate-y-1/2 bg-derby-gold/15" />
        <div className="absolute left-1/2 top-1/2 h-[72%] w-1 -translate-x-1/2 -translate-y-1/2 bg-derby-gold/15" />
        <div
          className="absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-derby-cream/80 bg-gradient-to-br from-derby-gold to-[#8b5f22] shadow-[0_5px_8px_rgba(0,0,0,.65)] transition-transform duration-75"
          style={{ transform: `translate(calc(-50% + ${joystickVisual.x}px), calc(-50% + ${joystickVisual.y}px))` }}
        />
      </div>
    </div>
  )
}

function drawMaze(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  dpr: number,
  cells: string[],
  exit: { x: number; y: number; side: MazeExitSide },
  ball: { x: number; y: number; vx: number; vy: number },
) {
  const size = cells.length
  const cell = Math.min(width, height) / size
  context.clearRect(0, 0, width, height)
  context.fillStyle = '#cdbd8d'
  context.fillRect(0, 0, width, height)

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const px = x * cell
      const py = y * cell
      if (cells[y][x] === '#') {
        const gradient = context.createLinearGradient(px, py, px + cell, py + cell)
        gradient.addColorStop(0, '#302820')
        gradient.addColorStop(0.55, '#171310')
        gradient.addColorStop(1, '#090706')
        context.fillStyle = gradient
        context.fillRect(px, py, cell + 0.5 * dpr, cell + 0.5 * dpr)
        context.fillStyle = 'rgba(255,218,139,.12)'
        context.fillRect(px, py, cell, Math.max(1, dpr))
      } else {
        context.fillStyle = (x + y) % 2 ? 'rgba(255,255,255,.035)' : 'rgba(73,48,24,.035)'
        context.fillRect(px, py, cell, cell)
      }
    }
  }

  context.save()
  context.shadowColor = '#55f28a'
  context.shadowBlur = 12 * dpr
  context.fillStyle = '#25b85d'
  context.fillRect(exit.x * cell, exit.y * cell, cell, cell)
  context.restore()

  const bx = ball.x * cell
  const by = ball.y * cell
  const radius = BALL_RADIUS * cell
  const gradient = context.createRadialGradient(bx - radius * 0.35, by - radius * 0.4, radius * 0.12, bx, by, radius)
  gradient.addColorStop(0, '#fff0c5')
  gradient.addColorStop(0.28, '#ef5b48')
  gradient.addColorStop(0.75, '#9f1720')
  gradient.addColorStop(1, '#3f070d')
  context.save()
  context.shadowColor = 'rgba(0,0,0,.65)'
  context.shadowBlur = 4 * dpr
  context.shadowOffsetY = 2 * dpr
  context.fillStyle = gradient
  context.beginPath()
  context.arc(bx, by, radius, 0, Math.PI * 2)
  context.fill()
  context.strokeStyle = '#2b0807'
  context.lineWidth = Math.max(1, 1.2 * dpr)
  context.stroke()
  context.restore()
}
