'use client'

import { useEffect, useState } from 'react'

export function useNow(intervalMs = 250): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

export function usePhaseCountdown(phaseStartedAt: number, phaseDuration: number): number {
  const now = useNow(200)
  return Math.max(0, Math.ceil((phaseStartedAt + phaseDuration - now) / 1000))
}

export function CountdownPill({ seconds, label }: { seconds: number; label: string }) {
  const urgent = seconds <= 10
  return (
    <div className="flex items-center gap-3 rounded-full border border-derby-gold/40 bg-derby-ink px-4 py-1.5">
      <span className="font-headline text-sm tracking-[0.2em] text-derby-smoke">{label}</span>
      <span className={`font-terminal text-2xl leading-none ${urgent ? 'animate-pulse text-derby-red' : 'text-derby-gold'}`}>
        {String(Math.floor(seconds / 60)).padStart(2, '0')}:{String(seconds % 60).padStart(2, '0')}
      </span>
    </div>
  )
}

export function Header({ raceNumber, right }: { raceNumber?: number; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-5 pt-[max(1rem,env(safe-area-inset-top))]">
      <div>
        <div className="text-engraved font-display text-xl leading-none">Last Sip Derby</div>
        {raceNumber !== undefined && (
          <div className="font-headline text-xs tracking-[0.3em] text-derby-smoke">COURSE N°{raceNumber}</div>
        )}
      </div>
      {right}
    </div>
  )
}

export function SilkChip({ color, number, size = 40 }: { color: string; number: number; size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-lg font-headline text-white shadow-lg"
      style={{ background: color, width: size, height: size, fontSize: size * 0.55 }}
    >
      {number}
    </span>
  )
}
