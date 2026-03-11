'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'

interface TapBoostProps {
  horseId: string
  durationMs: number
  horseName: string
  onTap: (horseId: string) => void
}

export function TapBoost({ horseId, durationMs, horseName, onTap }: TapBoostProps) {
  const [tapCount, setTapCount] = useState(0)
  const [timeLeft, setTimeLeft] = useState(durationMs / 1000)

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft((t) => Math.max(0, t - 0.1))
    }, 100)
    return () => clearInterval(interval)
  }, [])

  const handleTap = useCallback(() => {
    setTapCount((c) => c + 1)
    onTap(horseId)
  }, [horseId, onTap])

  if (timeLeft <= 0) return null

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-50 bg-derby-gold/95 flex flex-col items-center justify-center p-6"
    >
      <p className="font-display text-2xl text-derby-bg mb-2">COUP DE FOUET !</p>
      <p className="text-derby-bg/70 mb-6">Booste {horseName}</p>

      <div className="text-derby-bg font-display text-8xl mb-4">{tapCount}</div>

      <button
        onPointerDown={handleTap}
        className="w-48 h-48 rounded-full bg-derby-bg text-derby-gold font-display text-3xl active:scale-90 transition-transform shadow-2xl"
      >
        TAP !
      </button>

      <div className="mt-6 w-full max-w-xs">
        <div className="h-3 bg-derby-bg/30 rounded-full overflow-hidden">
          <div
            className="h-full bg-derby-bg transition-all duration-100"
            style={{ width: `${(timeLeft / (durationMs / 1000)) * 100}%` }}
          />
        </div>
        <p className="text-derby-bg/60 text-sm text-center mt-1">{timeLeft.toFixed(1)}s</p>
      </div>
    </motion.div>
  )
}
