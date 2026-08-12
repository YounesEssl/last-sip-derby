'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { playGameFeedback } from './feedback'

const DEPLOYED_CYCLE_MS = 900
const PRESSURE_SPEED_MULTIPLIER = 1.3
const CYCLE_MS = DEPLOYED_CYCLE_MS / PRESSURE_SPEED_MULTIPLIER
const GAUGE_TOP_Y = 5
const GAUGE_BOTTOM_Y = 205
const GAUGE_HALF_WIDTH = 46

function clampAndRoundScore(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value * 10) / 10))
}

function gaugeEdge(score: number): { y: number; left: number; right: number } {
  const ratio = Math.min(1, Math.max(0, score / 100))
  const y = GAUGE_BOTTOM_Y - ratio * (GAUGE_BOTTOM_Y - GAUGE_TOP_Y)
  const halfWidth = GAUGE_HALF_WIDTH * ratio
  return { y, left: 50 - halfWidth, right: 50 + halfWidth }
}

function resultMessage(score: number): string {
  if (score < 20) return 'Ptdrrr la honte'
  if (score < 40) return 'T’es vraiment mauvais'
  if (score < 60) return 'C’est moyen tout ça chef'
  if (score < 80) return 'Pas trop mal'
  if (score < 90) return 'Bien !'
  if (score < 95) return 'Excellent !!'
  if (score < 98) return 'INCROYABLE !!!'
  if (score < 100) return 'C’est EXCEPTIONNEL.'
  return 'TU ES LE GOAT'
}

function resultColor(score: number): string {
  if (score < 40) return 'text-derby-red'
  if (score < 80) return 'text-amber-300'
  if (score < 95) return 'text-lime-300'
  return 'text-emerald-300'
}

export function PressureGame({ active, confirmedScore, onScore }: { active: boolean; confirmedScore?: number | null; onScore: (score: number) => void }) {
  const clipId = useId().replace(/:/g, '')
  const startedAtRef = useRef(0)
  const lockedRef = useRef(false)
  const [value, setValue] = useState(0)
  const [score, setScore] = useState<number | null>(null)

  useEffect(() => {
    if (confirmedScore === null || confirmedScore === undefined || lockedRef.current) return
    lockedRef.current = true
    const rounded = clampAndRoundScore(confirmedScore)
    setValue(rounded)
    setScore(rounded)
  }, [confirmedScore])

  useEffect(() => {
    if (active || lockedRef.current) return
    lockedRef.current = true
    setValue(0)
    setScore(0)
  }, [active])

  useEffect(() => {
    startedAtRef.current = performance.now()
    let frame = 0
    const tick = (time: number) => {
      if (!lockedRef.current) {
        // Quantize the visible value and the submitted score identically. The
        // modulo makes the 100 -> 0 reset immediate, with no trailing frame.
        const next = clampAndRoundScore((((time - startedAtRef.current) % CYCLE_MS) / CYCLE_MS) * 100)
        setValue(next)
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [])

  const stop = () => {
    if (!active || lockedRef.current) return
    lockedRef.current = true
    // The event handler and the gauge are from the same committed React render,
    // so this freezes the exact value visible under the player's finger.
    setScore(value)
    onScore(value)
    playGameFeedback(value >= 95 ? 'SUCCESS' : 'LOCK')
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(value >= 95 ? [30, 30, 70] : 35)
  }

  const displayed = score ?? value
  const formatted = displayed.toFixed(1).replace('.', ',')
  const edge = gaugeEdge(displayed)

  return (
    <button
      data-testid="pressure-game"
      onPointerDown={(event) => {
        event.preventDefault()
        stop()
      }}
      onClick={stop}
      disabled={!active || score !== null}
      className="mx-auto flex w-full max-w-[390px] select-none items-center justify-center gap-4 rounded-3xl border border-derby-gold/25 bg-black/30 px-3 py-4 text-left disabled:opacity-100"
    >
      <svg viewBox="0 0 100 210" className="h-[min(48vh,370px)] min-h-[260px] w-[42%] max-w-[155px] overflow-visible" aria-label={`Jauge à ${formatted} pour cent`}>
        <defs>
          <clipPath id={clipId}>
            <path d="M50 205 L4 5 L96 5 Z" />
          </clipPath>
          <linearGradient id={`${clipId}-fill`} gradientUnits="userSpaceOnUse" x1="0" y1={GAUGE_BOTTOM_Y} x2="0" y2={GAUGE_TOP_Y}>
            <stop offset="0" stopColor="#a31320" />
            <stop offset=".35" stopColor="#e24b25" />
            <stop offset=".62" stopColor="#e4b62a" />
            <stop offset=".82" stopColor="#6caa39" />
            <stop offset="1" stopColor="#0c612f" />
          </linearGradient>
          <linearGradient id={`${clipId}-empty`} x1="0" y1="0" x2="1" y2="0">
            <stop stopColor="#2c2622" />
            <stop offset=".5" stopColor="#534b40" />
            <stop offset="1" stopColor="#211c19" />
          </linearGradient>
        </defs>
        <path d="M50 205 L4 5 L96 5 Z" fill={`url(#${clipId}-empty)`} stroke="#f3d27d" strokeWidth="3" strokeLinejoin="round" />
        <rect x="0" y={edge.y} width="100" height={GAUGE_BOTTOM_Y - edge.y} fill={`url(#${clipId}-fill)`} clipPath={`url(#${clipId})`} />
        {[20, 40, 60, 80, 100].map((mark) => {
          const markEdge = gaugeEdge(mark)
          return <line key={mark} x1={markEdge.left} x2={markEdge.right} y1={markEdge.y} y2={markEdge.y} stroke="rgba(255,255,255,.28)" strokeWidth="1" />
        })}
        {displayed > 0 && (
          <line
            data-testid="pressure-fill-edge"
            x1={edge.left}
            x2={edge.right}
            y1={edge.y}
            y2={edge.y}
            stroke="#fff4c7"
            strokeWidth="2"
            strokeLinecap="butt"
            vectorEffect="non-scaling-stroke"
            clipPath={`url(#${clipId})`}
          />
        )}
        <path d="M50 205 L4 5 L96 5 Z" fill="none" stroke="rgba(255,255,255,.35)" strokeWidth="1" strokeLinejoin="round" />
      </svg>

      <div className="min-w-0 flex-1">
        <div className={`min-h-[4.8rem] font-headline text-[clamp(1.15rem,5.2vw,1.65rem)] leading-tight ${score === null ? 'text-derby-cream' : resultColor(score)}`}>
          {score === null ? 'APPUYEZ POUR BLOQUER' : resultMessage(score)}
        </div>
        <div className={`whitespace-nowrap font-terminal text-[clamp(2.65rem,13vw,4.6rem)] leading-none tabular-nums ${score === null ? 'text-derby-gold' : resultColor(score)}`}>
          {formatted}<span className="text-[.55em]"> %</span>
        </div>
        <div className="mt-3 font-body text-xs uppercase tracking-[.13em] text-derby-smoke">
          {score === null ? 'Une seule tentative' : 'Score verrouillé'}
        </div>
      </div>
    </button>
  )
}
