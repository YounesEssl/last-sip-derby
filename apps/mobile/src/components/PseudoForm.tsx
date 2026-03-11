'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'

interface PseudoFormProps {
  onJoin: (pseudo: string) => void
}

export function PseudoForm({ onJoin }: PseudoFormProps) {
  const [pseudo, setPseudo] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = pseudo.trim()
    if (trimmed.length > 0) {
      onJoin(trimmed)
    }
  }

  return (
    <div className="flex h-screen items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        <h1 className="font-display text-5xl text-derby-gold text-center mb-2">
          LAST SIP DERBY
        </h1>
        <p className="text-gray-400 text-center mb-8">Entre ton blaze pour jouer</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            value={pseudo}
            onChange={(e) => setPseudo(e.target.value)}
            placeholder="Ton pseudo..."
            maxLength={20}
            autoFocus
            className="w-full bg-derby-dark border-2 border-derby-gold/30 rounded-xl px-4 py-4 text-xl text-white placeholder-gray-600 focus:border-derby-gold focus:outline-none text-center font-display"
          />
          <button
            type="submit"
            disabled={pseudo.trim().length === 0}
            className="w-full bg-derby-gold text-derby-bg font-display text-2xl py-4 rounded-xl disabled:opacity-30 active:scale-95 transition-transform"
          >
            REJOINDRE
          </button>
        </form>
      </motion.div>
    </div>
  )
}
