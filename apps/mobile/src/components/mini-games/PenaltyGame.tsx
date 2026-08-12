'use client'

import { useEffect, useRef, useState } from 'react'
import {
  PENALTY_GOAL_LEFT_PERCENT,
  PENALTY_GOAL_RIGHT_PERCENT,
  isPenaltyGoal,
} from '@last-sip-derby/shared'
import { SoccerBall } from './SoccerBall'
import { playGameFeedback } from './feedback'

interface ShotVisual {
  id: number
  x: number
  goal: boolean
}

const BALL_MIN_X = 7
const BALL_MAX_X = 93
const ROUND_TRIP_MS = 1_050
const SHOT_FLIGHT_MS = 330

export function PenaltyGame({
  shots,
  goals,
  active,
  onShot,
}: {
  shots: number
  goals: number
  active: boolean
  onShot: (centerPercent: number) => void
}) {
  const startedAtRef = useRef(0)
  const xRef = useRef(50)
  const localShotsRef = useRef(shots)
  const timersRef = useRef<number[]>([])
  const [x, setX] = useState(50)
  const [flights, setFlights] = useState<ShotVisual[]>([])
  const [impacts, setImpacts] = useState<ShotVisual[]>([])

  useEffect(() => {
    localShotsRef.current = Math.max(localShotsRef.current, shots)
  }, [shots])

  useEffect(() => {
    startedAtRef.current = performance.now()
    let frame = 0
    const tick = (time: number) => {
      const phase = ((time - startedAtRef.current) % ROUND_TRIP_MS) / ROUND_TRIP_MS
      const travel = phase < 0.5 ? phase * 2 : (1 - phase) * 2
      const nextX = BALL_MIN_X + travel * (BALL_MAX_X - BALL_MIN_X)
      xRef.current = nextX
      setX(nextX)
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [])

  useEffect(() => () => timersRef.current.forEach((timer) => window.clearTimeout(timer)), [])

  const shoot = () => {
    if (!active || localShotsRef.current >= 10) return
    const centerPercent = xRef.current
    const shot: ShotVisual = { id: Date.now() + localShotsRef.current, x: centerPercent, goal: isPenaltyGoal(centerPercent) }
    localShotsRef.current += 1
    setFlights((current) => [...current, shot])
    onShot(centerPercent)
    playGameFeedback(shot.goal ? 'GOAL' : 'MISS')
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(24)

    const timer = window.setTimeout(() => {
      setFlights((current) => current.filter((item) => item.id !== shot.id))
      setImpacts((current) => [...current.slice(-15), shot])
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(shot.goal ? [18, 25, 18] : 45)
    }, SHOT_FLIGHT_MS)
    timersRef.current.push(timer)
  }

  const remaining = Math.max(0, 10 - Math.max(shots, localShotsRef.current))

  return (
    <div
      data-testid="penalty-field"
      onPointerDown={(event) => {
        event.preventDefault()
        shoot()
      }}
      className="relative mx-auto h-[min(50vh,350px)] min-h-[280px] w-full select-none overflow-hidden rounded-[1.4rem] border-4 border-white/60 bg-[#28733b] shadow-[inset_0_0_45px_rgba(0,0,0,.38)] touch-none"
      style={{ WebkitUserSelect: 'none' }}
    >
      <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'repeating-linear-gradient(90deg,transparent 0,transparent 12.5%,rgba(255,255,255,.16) 12.5%,rgba(255,255,255,.16) 25%)' }} />
      <div className="absolute inset-x-[5%] bottom-[17%] h-[55%] rounded-[50%] border-2 border-white/35" />

      <div className="absolute left-3 top-3 z-30 rounded-lg border border-black/30 bg-black/70 px-3 py-1.5 font-headline text-lg tracking-wider text-white">
        BUTS : <span className="text-[#72f58a]">{goals}</span>
      </div>
      <div className="absolute right-3 top-3 z-30 rounded-lg border border-black/30 bg-black/75 px-3 py-1.5 font-headline text-base tracking-wide text-white">
        Ballons restants : <span className="text-derby-gold">{remaining}</span>
      </div>

      <div
        data-testid="penalty-goal"
        className="absolute top-[32%] h-[20%] border-[5px] border-b-[6px] border-white shadow-[0_4px_0_rgba(0,0,0,.35),inset_0_0_0_2px_rgba(0,0,0,.15)]"
        style={{ left: `${PENALTY_GOAL_LEFT_PERCENT}%`, right: `${100 - PENALTY_GOAL_RIGHT_PERCENT}%` }}
      >
        <div className="absolute inset-0 opacity-45" style={{ backgroundImage: 'linear-gradient(35deg,transparent 46%,white 48%,white 51%,transparent 53%),linear-gradient(-35deg,transparent 46%,white 48%,white 51%,transparent 53%)', backgroundSize: '18px 18px' }} />
        <div className="absolute -bottom-3 left-[-7px] right-[-7px] h-3 -skew-x-[25deg] border-b-2 border-white/70 bg-black/20" />
      </div>

      {impacts.map((impact) => (
        <div
          key={impact.id}
          data-goal={impact.goal ? 'true' : 'false'}
          className={`absolute top-[40%] z-20 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rotate-12 rounded-[45%_55%_40%_60%] border-2 shadow-[0_2px_3px_rgba(0,0,0,.45)] ${impact.goal ? 'border-green-950 bg-[#56ee73]' : 'border-red-950 bg-[#f04646]'}`}
          style={{ left: `${impact.x}%` }}
        >
          <span className="absolute -left-2 top-1 h-2 w-2 rounded-full bg-current" />
          <span className="absolute -right-2 bottom-0 h-1.5 w-1.5 rounded-full bg-current" />
        </div>
      ))}

      {flights.map((flight) => (
        <div
          key={flight.id}
          className="absolute bottom-[12%] z-40 h-11 w-11 -translate-x-1/2 animate-[penalty-shot_330ms_cubic-bezier(.2,.8,.25,1)_forwards]"
          style={{ left: `${flight.x}%`, ['--shot-x' as string]: `${flight.x}%` }}
        >
          <SoccerBall className="h-full w-full animate-[spin_220ms_linear_infinite] drop-shadow-[0_5px_3px_rgba(0,0,0,.5)]" />
        </div>
      ))}

      <div className="absolute bottom-[8%] z-30 h-14 w-14 -translate-x-1/2" style={{ left: `${x}%` }}>
        <SoccerBall className="h-full w-full drop-shadow-[0_6px_4px_rgba(0,0,0,.55)]" />
      </div>
      <div className="absolute inset-x-0 bottom-1.5 font-body text-[11px] font-bold uppercase tracking-[.18em] text-white/80">Touchez n’importe où pour frapper</div>
    </div>
  )
}
