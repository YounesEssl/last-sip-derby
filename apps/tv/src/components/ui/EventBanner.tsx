'use client'

import { motion, AnimatePresence } from 'framer-motion'
import type { GameEvent } from '@last-sip-derby/shared'

interface EventBannerProps {
  event: GameEvent | null
}

export function EventBanner({ event }: EventBannerProps) {
  return (
    <AnimatePresence>
      {event && (
        <motion.div
          initial={{ y: -120, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -120, opacity: 0 }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          className="absolute top-0 left-0 right-0 z-50"
        >
          <div
            className="h-20 flex items-center justify-center gap-4 px-8"
            style={{
              background: 'linear-gradient(180deg, rgba(232, 59, 59, 0.95) 0%, rgba(232, 59, 59, 0.85) 100%)',
              backdropFilter: 'blur(8px)',
              boxShadow: '0 4px 40px rgba(232, 59, 59, 0.5)',
            }}
          >
            <motion.span
              className="font-display text-4xl text-white"
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ repeat: Infinity, duration: 0.6 }}
            >
              ALERTE
            </motion.span>
            <div className="w-px h-10 bg-white/30" />
            <span className="font-display text-3xl text-white leading-tight flex-1 text-center">
              {event.description}
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
