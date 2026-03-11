'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import type { Horse, Bet } from '@last-sip-derby/shared'

interface HorseSelectorProps {
  horses: Horse[]
  currentBet: Bet | null
  onBet: (horseId: string, amount: number) => void
}

export function HorseSelector({ horses, currentBet, onBet }: HorseSelectorProps) {
  const [selectedHorseId, setSelectedHorseId] = useState<string | null>(null)
  const [amount, setAmount] = useState(1)

  if (currentBet) {
    const horse = horses.find((h) => h.id === currentBet.horseId)
    return (
      <div className="p-4 flex flex-col items-center justify-center min-h-[60vh]">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center bg-derby-dark rounded-2xl p-6 border border-derby-gold/30"
        >
          <div className="text-4xl mb-3">🎰</div>
          <p className="text-derby-gold font-display text-2xl mb-1">PARI ENREGISTRE</p>
          <p className="text-white text-xl">
            <span style={{ color: horse?.color }}>{horse?.name}</span>
          </p>
          <p className="text-gray-400 mt-2">
            Mise : <span className="text-derby-gold font-bold">{currentBet.amount}G</span>
            {' '} — Cote : <span className="text-white">{horse?.odds}x</span>
          </p>
          <p className="text-sm text-gray-500 mt-3">
            Gain possible : {Math.round(currentBet.amount * (horse?.odds ?? 1))}G a distribuer
          </p>
        </motion.div>
      </div>
    )
  }

  const handleBet = () => {
    if (selectedHorseId) {
      onBet(selectedHorseId, amount)
    }
  }

  return (
    <div className="p-4 space-y-4">
      <p className="font-display text-xl text-derby-gold text-center">CHOISIS TON CHEVAL</p>

      {/* Horse list */}
      <div className="space-y-2">
        {horses.map((horse) => (
          <button
            key={horse.id}
            onClick={() => setSelectedHorseId(horse.id)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-colors ${
              selectedHorseId === horse.id
                ? 'border-derby-gold bg-derby-gold/10'
                : 'border-gray-800 bg-derby-dark'
            }`}
          >
            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: horse.color }} />
            <span className="flex-1 text-left font-display text-lg">{horse.name}</span>
            <span className="font-display text-xl text-derby-gold">{horse.odds}x</span>
          </button>
        ))}
      </div>

      {/* Amount selector */}
      {selectedHorseId && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-3"
        >
          <p className="text-center text-gray-400 text-sm">Mise (en gorgees)</p>
          <div className="flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                onClick={() => setAmount(n)}
                className={`w-12 h-12 rounded-xl font-display text-xl ${
                  amount === n
                    ? 'bg-derby-gold text-derby-bg'
                    : 'bg-derby-dark border border-gray-700 text-white'
                }`}
              >
                {n}
              </button>
            ))}
          </div>

          <button
            onClick={handleBet}
            className="w-full bg-derby-red text-white font-display text-2xl py-4 rounded-xl active:scale-95 transition-transform"
          >
            MISER {amount}G
          </button>
        </motion.div>
      )}
    </div>
  )
}
