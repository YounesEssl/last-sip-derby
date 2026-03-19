'use client'

import { useEffect, useRef, useCallback } from 'react'

interface Props {
  onReveal: () => void   // called when fade begins — race becomes visible underneath
  onComplete: () => void // called when fade finishes — safe to unmount
  onBeep?: (step: number) => void  // countdown beep for 3, 2, 1
  onStart?: () => void             // start gun on "PARTEZ!"
}

const TRANSITION_MS = 420
const HOLD_MS = 650

// Slight overshoot on entry (inertia feel), quick departure
const ENTER_EASE = 'cubic-bezier(0.22, 1.12, 0.58, 1)'
const EXIT_EASE = 'cubic-bezier(0.55, 0, 1, 0.45)'

export function RaceCountdown({ onReveal, onComplete, onBeep, onStart }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const hasRun = useRef(false)

  const runCountdown = useCallback(async () => {
    const container = containerRef.current
    if (!container || hasRun.current) return
    hasRun.current = true

    const wait = (ms: number) => new Promise<void>(r => setTimeout(r, ms))
    const $ = (sel: string) => container.querySelector(sel) as HTMLDivElement

    const s3 = $('[data-screen="3"]')
    const s2 = $('[data-screen="2"]')
    const s1 = $('[data-screen="1"]')
    const sGo = $('[data-screen="go"]')

    // ── Phase 1: "3" enters from left ──
    onBeep?.(3)
    s3.style.transition = `transform ${TRANSITION_MS}ms ${ENTER_EASE}`
    s3.style.transform = 'translateX(0)'
    await wait(TRANSITION_MS + HOLD_MS)

    // ── Phase 2: "3" exits right + "2" enters from right ──
    onBeep?.(2)
    s3.style.transition = `transform ${TRANSITION_MS}ms ${EXIT_EASE}`
    s3.style.transform = 'translateX(100%)'
    s2.style.transition = `transform ${TRANSITION_MS}ms ${ENTER_EASE}`
    s2.style.transform = 'translateX(0)'
    await wait(TRANSITION_MS + HOLD_MS)

    // ── Phase 3: "2" exits left + "1" enters from top ──
    onBeep?.(1)
    s2.style.transition = `transform ${TRANSITION_MS}ms ${EXIT_EASE}`
    s2.style.transform = 'translateX(-100%)'
    s1.style.transition = `transform ${TRANSITION_MS}ms ${ENTER_EASE}`
    s1.style.transform = 'translateY(0)'
    await wait(TRANSITION_MS + HOLD_MS)

    // ── Phase 4: "1" exits bottom + "Partez!" pops ──
    onStart?.()
    s1.style.transition = `transform ${TRANSITION_MS}ms ${EXIT_EASE}`
    s1.style.transform = 'translateY(100%)'
    sGo.style.transition = `transform ${TRANSITION_MS}ms ${ENTER_EASE}, opacity ${TRANSITION_MS}ms ease-out`
    sGo.style.transform = 'scale(1)'
    sGo.style.opacity = '1'
    await wait(TRANSITION_MS + HOLD_MS)

    // ── Cross-dissolve: reveal race underneath ──
    onReveal()
    container.style.transition = 'opacity 700ms ease-out'
    container.style.opacity = '0'
    await wait(700)

    onComplete()
  }, [onReveal, onComplete])

  useEffect(() => {
    // Small delay to ensure DOM is painted before starting
    const id = requestAnimationFrame(() => runCountdown())
    return () => cancelAnimationFrame(id)
  }, [runCountdown])

  const screenBase: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column',
    willChange: 'transform',
  }

  const numberStyle: React.CSSProperties = {
    fontSize: 'min(75vh, 45vw)',
    lineHeight: 1,
    textShadow:
      '0 0 80px rgba(212,168,67,0.5), 0 0 160px rgba(212,168,67,0.2), 0 10px 40px rgba(0,0,0,0.8)',
    WebkitTextStroke: '2px rgba(140,100,30,0.4)',
  }

  /* Wood grain overlay via repeating-linear-gradient */
  const grainOverlay =
    'repeating-linear-gradient(90deg, transparent 0px, transparent 3px, rgba(0,0,0,0.06) 3px, rgba(0,0,0,0.06) 5px)'

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 overflow-hidden"
      style={{ zIndex: 100, opacity: 1, background: '#0d0703' }}
    >
      {/* ── Screen: 3  (starts offscreen left) ── */}
      <div
        data-screen="3"
        style={{
          ...screenBase,
          transform: 'translateX(-100%)',
          background: `${grainOverlay}, radial-gradient(ellipse at 40% 50%, #3d2814 0%, #1a0e06 70%, #0d0703 100%)`,
        }}
      >
        {/* Leading edge shadow */}
        <div
          className="absolute top-0 right-0 bottom-0 w-4"
          style={{
            background: 'linear-gradient(to left, rgba(0,0,0,0.6), transparent)',
          }}
        />
        <span className="font-rye text-western-gold" style={numberStyle}>
          3
        </span>
      </div>

      {/* ── Screen: 2  (starts offscreen right) ── */}
      <div
        data-screen="2"
        style={{
          ...screenBase,
          transform: 'translateX(100%)',
          background: `${grainOverlay}, radial-gradient(ellipse at 60% 50%, #362010 0%, #150a04 70%, #0a0502 100%)`,
        }}
      >
        <div
          className="absolute top-0 left-0 bottom-0 w-4"
          style={{
            background: 'linear-gradient(to right, rgba(0,0,0,0.6), transparent)',
          }}
        />
        <span className="font-rye text-western-gold" style={numberStyle}>
          2
        </span>
      </div>

      {/* ── Screen: 1  (starts offscreen top) ── */}
      <div
        data-screen="1"
        style={{
          ...screenBase,
          transform: 'translateY(-100%)',
          background: `${grainOverlay}, radial-gradient(ellipse at 50% 60%, #4a2a12 0%, #1c0c04 70%, #0d0502 100%)`,
        }}
      >
        <div
          className="absolute left-0 right-0 bottom-0 h-4"
          style={{
            background: 'linear-gradient(to top, rgba(0,0,0,0.6), transparent)',
          }}
        />
        <span className="font-rye text-western-gold" style={numberStyle}>
          1
        </span>
      </div>

      {/* ── Screen: PARTEZ !  (starts scaled down + transparent) ── */}
      <div
        data-screen="go"
        style={{
          ...screenBase,
          transform: 'scale(0.85)',
          opacity: 0,
          background: `${grainOverlay}, radial-gradient(ellipse at 50% 50%, #2a3a12 0%, #0f1a06 70%, #060d03 100%)`,
        }}
      >
        <div
          className="font-rye tracking-widest uppercase text-prairie-accent/50"
          style={{ fontSize: 'min(8vh, 5vw)', marginBottom: '1vh' }}
        >
          ★ ★ ★
        </div>
        <span
          className="font-rye text-prairie-accent"
          style={{
            fontSize: 'min(28vh, 18vw)',
            lineHeight: 1,
            textShadow:
              '0 0 80px rgba(123,198,126,0.6), 0 0 160px rgba(123,198,126,0.25), 0 10px 40px rgba(0,0,0,0.8)',
            WebkitTextStroke: '2px rgba(50,120,55,0.3)',
          }}
        >
          PARTEZ !
        </span>
        <div
          className="font-rye tracking-widest uppercase text-prairie-accent/50"
          style={{ fontSize: 'min(8vh, 5vw)', marginTop: '1vh' }}
        >
          ★ ★ ★
        </div>
      </div>
    </div>
  )
}
