'use client'

import { motion } from 'framer-motion'
import type { GameState } from '@last-sip-derby/shared'
import { QRCode } from '../ui/QRCode'
import { Track } from '../race/Track'

interface IdlePhaseProps {
  gameState: GameState
}

export function IdlePhase({ gameState }: IdlePhaseProps) {
  const mobileUrl = process.env.NEXT_PUBLIC_MOBILE_URL ?? 'http://localhost:3002'

  return (
    <div className="h-screen flex flex-col items-center justify-center p-8">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        <h1 className="font-display text-8xl text-derby-gold mb-2">LAST SIP DERBY</h1>
        <p className="text-gray-400 text-2xl">Scannez le QR code pour rejoindre</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.3 }}
        className="mb-8"
      >
        <QRCode url={mobileUrl} size={250} />
      </motion.div>

      {/* Demo race in background */}
      {gameState.horses.length > 0 && (
        <div className="w-full max-w-4xl opacity-30">
          <Track horses={gameState.horses} />
        </div>
      )}

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="text-gray-600 text-sm mt-8 animate-pulse-gold"
      >
        En attente de joueurs...
      </motion.p>
    </div>
  )
}
