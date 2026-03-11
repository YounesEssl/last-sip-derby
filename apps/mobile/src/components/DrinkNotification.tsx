'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { DRINK_CONFIRM_TIMEOUT_MS } from '@last-sip-derby/shared'

interface DrinkNotificationProps {
  sips: number
  reason: string
  onConfirm: () => void
}

export function DrinkNotification({ sips, reason, onConfirm }: DrinkNotificationProps) {
  const [remaining, setRemaining] = useState(DRINK_CONFIRM_TIMEOUT_MS / 1000)

  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining((r) => Math.max(0, r - 1))
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="absolute inset-0 z-50 bg-derby-red/95 flex flex-col items-center justify-center p-6"
    >
      <motion.div
        initial={{ scale: 0.5 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', damping: 10, stiffness: 200 }}
        className="text-center"
      >
        <div className="text-7xl mb-4">🍺</div>
        <p className="font-display text-6xl text-white mb-2">{sips}G</p>
        <p className="text-white/80 text-lg mb-8">{reason}</p>

        <div className="mb-6">
          <div className="text-white/60 text-sm mb-1">
            Confirme dans {remaining}s sinon +1G
          </div>
          <div className="w-48 h-2 bg-white/20 rounded-full mx-auto overflow-hidden">
            <div
              className="h-full bg-white transition-all duration-1000"
              style={{ width: `${(remaining / (DRINK_CONFIRM_TIMEOUT_MS / 1000)) * 100}%` }}
            />
          </div>
        </div>

        <button
          onClick={onConfirm}
          className="bg-white text-derby-red font-display text-3xl px-12 py-5 rounded-2xl active:scale-95 transition-transform"
        >
          J'AI BU 🍺
        </button>
      </motion.div>
    </motion.div>
  )
}
