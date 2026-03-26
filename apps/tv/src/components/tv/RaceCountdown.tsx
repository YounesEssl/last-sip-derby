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
    color: '#E83B3B',
    textShadow: '0 6px 0 rgba(160,32,32,0.3), 0 0 80px rgba(232,59,59,0.3)',
    WebkitTextStroke: '3px rgba(160,32,32,0.2)',
  }

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 overflow-hidden"
      style={{ zIndex: 100, opacity: 1, background: '#f4eacc' }}
    >
      {/* ── Screen: 3  (starts offscreen left) ── */}
      <div
        data-screen="3"
        className="bg-pmu-paper"
        style={{
          ...screenBase,
          transform: 'translateX(-100%)',
        }}
      >
        <div className="paper-texture"></div>
        {/* Leading edge shadow */}
        <div
          className="absolute top-0 right-0 bottom-0 w-4"
          style={{ background: 'linear-gradient(to left, rgba(74,48,24,0.15), transparent)' }}
        />
        <span className="font-rye relative z-10" style={numberStyle}>
          3
        </span>
      </div>

      {/* ── Screen: 2  (starts offscreen right) ── */}
      <div
        data-screen="2"
        className="bg-pmu-paper"
        style={{
          ...screenBase,
          transform: 'translateX(100%)',
        }}
      >
        <div className="paper-texture"></div>
        <div
          className="absolute top-0 left-0 bottom-0 w-4"
          style={{ background: 'linear-gradient(to right, rgba(74,48,24,0.15), transparent)' }}
        />
        <span className="font-rye relative z-10" style={numberStyle}>
          2
        </span>
      </div>

      {/* ── Screen: 1  (starts offscreen top) ── */}
      <div
        data-screen="1"
        className="bg-pmu-paper"
        style={{
          ...screenBase,
          transform: 'translateY(-100%)',
        }}
      >
        <div className="paper-texture"></div>
        <div
          className="absolute left-0 right-0 bottom-0 h-4"
          style={{ background: 'linear-gradient(to top, rgba(74,48,24,0.15), transparent)' }}
        />
        <span className="font-rye relative z-10" style={numberStyle}>
          1
        </span>
      </div>

      {/* ── Screen: PARTEZ !  (starts scaled down + transparent) ── */}
      <div
        data-screen="go"
        className="bg-pmu-paper"
        style={{
          ...screenBase,
          transform: 'scale(0.85)',
          opacity: 0,
        }}
      >
        <div className="paper-texture"></div>
        <div
          className="font-rye tracking-widest uppercase relative z-10 text-pmu-dark/30"
          style={{ fontSize: 'min(8vh, 5vw)', marginBottom: '1vh' }}
        >
          ★ ★ ★
        </div>
        <span
          className="font-rye relative z-10"
          style={{
            fontSize: 'min(28vh, 18vw)',
            lineHeight: 1,
            color: '#E83B3B',
            textShadow: '0 6px 0 rgba(160,32,32,0.3), 0 0 80px rgba(232,59,59,0.3)',
            WebkitTextStroke: '3px rgba(160,32,32,0.2)',
          }}
        >
          PARTEZ !
        </span>
        <div
          className="font-rye tracking-widest uppercase relative z-10 text-pmu-dark/30"
          style={{ fontSize: 'min(8vh, 5vw)', marginTop: '1vh' }}
        >
          ★ ★ ★
        </div>
      </div>
    </div>
  )
}
