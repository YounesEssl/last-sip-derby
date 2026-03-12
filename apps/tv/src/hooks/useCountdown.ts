import { useState, useEffect } from 'react'

export function useCountdown(phaseStartedAt: number, phaseDuration: number) {
  const [timeLeft, setTimeLeft] = useState(0)

  useEffect(() => {
    const updateCountdown = () => {
      const now = Date.now()
      const elapsed = now - phaseStartedAt
      const remaining = Math.max(0, phaseDuration - elapsed)
      setTimeLeft(Math.floor(remaining / 1000))
    }

    updateCountdown()
    const interval = setInterval(updateCountdown, 1000)
    return () => clearInterval(interval)
  }, [phaseStartedAt, phaseDuration])

  return timeLeft
}
