'use client'

import { useState, useEffect } from 'react'

interface TimerProps {
  startedAt: number
  duration: number
}

export function Timer({ startedAt, duration }: TimerProps) {
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

  const minutes = Math.floor(remaining / 60)
  const seconds = remaining % 60

  return (
    <span className="font-display text-4xl text-derby-gold tabular-nums">
      {minutes > 0 ? `${minutes}:` : ''}{seconds.toString().padStart(2, '0')}
    </span>
  )
}
