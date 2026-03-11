'use client'

import { motion, AnimatePresence } from 'framer-motion'
import type { GameEvent } from '@last-sip-derby/shared'

interface EventBannerProps {
  event: GameEvent | null
}

const EVENT_ICONS: Record<string, string> = {
  ANTIDOPING: '🧪',
  COUP_DE_FOUET: '🏇',
  CHUTE_COLLECTIVE: '💥',
  OBSTACLE_IMPREVU: '🚧',
}

export function EventBanner({ event }: EventBannerProps) {
  return (
    <AnimatePresence>
      {event && (
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          className="absolute top-4 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-3xl"
        >
          <div className="bg-derby-red/95 backdrop-blur border-2 border-red-400 rounded-lg px-6 py-4 shadow-2xl shadow-red-500/30">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{EVENT_ICONS[event.type] ?? '⚡'}</span>
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-red-200">
                  Breaking News
                </div>
                <div className="font-display text-2xl text-white leading-tight">
                  {event.message}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
