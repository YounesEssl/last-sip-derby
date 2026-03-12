'use client'

import { useState, useEffect } from 'react'

interface TimerProps {
  startedAt: number
  duration: number
  size?: 'normal' | 'large'
}

export function Timer({ startedAt, duration, size = 'normal' }: TimerProps) {
  const [remaining, setRemaining] = useState(0)

  useEffect(() => {
    const update = () => {
      const elapsed = Date.now() - startedAt
      const rem = Math.max(0, Math.ceil((duration - elapsed) / 1000))
      setRemaining(rem)
    }

    update()
    const interval = setInterval(update, 200)
    return () => clearInterval(interval)
  }, [startedAt, duration])

  const progress = Math.max(0, Math.min(1, (Date.now() - startedAt) / duration))
  const minutes = Math.floor(remaining / 60)
  const seconds = remaining % 60
  const timeStr = minutes > 0
    ? `${minutes}:${seconds.toString().padStart(2, '0')}`
    : seconds.toString().padStart(2, '0')

  const isLarge = size === 'large'

  return (
    <div className="flex flex-col items-center gap-2">
      <span
        className={`font-mono font-bold tabular-nums text-derby-gold ${
          isLarge ? 'text-7xl' : 'text-5xl'
        }`}
        style={{ textShadow: '0 0 20px rgba(212, 168, 67, 0.4)' }}
      >
        {timeStr}
      </span>
      <div
        className={`bg-derby-muted/30 overflow-hidden ${
          isLarge ? 'w-48 h-2 rounded' : 'w-32 h-1.5 rounded'
        }`}
      >
        <div
          className="h-full bg-derby-gold transition-all duration-500 rounded"
          style={{
            width: `${(1 - progress) * 100}%`,
            boxShadow: '0 0 8px rgba(212, 168, 67, 0.5)',
          }}
        />
      </div>
    </div>
  )
}
