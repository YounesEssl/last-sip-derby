'use client'

import { motion } from 'framer-motion'
import type { GameState } from '@last-sip-derby/shared'
import { Timer } from '../ui/Timer'
import { Scoreboard } from '../ui/Scoreboard'

interface ResultsPhaseProps {
  gameState: GameState
}

export function ResultsPhase({ gameState }: ResultsPhaseProps) {
  const winner = gameState.lastRaceWinner
  const losers = gameState.players.filter(
    (p) => p.currentBet && p.currentBet.horseId !== gameState.horses.find((h) => h.position >= 100)?.id,
  )

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="h-screen flex flex-col items-center justify-center p-8 relative"
    >
      {/* Timer in corner */}
      <div className="absolute top-4 right-6">
        <Timer startedAt={gameState.phaseStartedAt} duration={gameState.phaseDuration} />
      </div>

      {/* Confetti effect via gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-derby-gold/5 to-transparent pointer-events-none" />

      {winner ? (
        <>
          {/* Podium */}
          <motion.div
            initial={{ scale: 0, y: 50 }}
            animate={{ scale: 1, y: 0 }}
            transition={{ type: 'spring', damping: 12, stiffness: 200, delay: 0.2 }}
            className="text-center mb-8"
          >
            <div className="text-6xl mb-4">🏆</div>
            <h1 className="font-display text-7xl text-derby-gold mb-2">
              {winner.pseudo}
            </h1>
            <p className="text-2xl text-gray-300">
              sur <span className="text-white font-bold">{winner.horseName}</span>
            </p>
          </motion.div>

          {/* Sips to distribute */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="bg-derby-dark border-2 border-derby-gold rounded-2xl px-12 py-6 mb-8"
          >
            <p className="font-display text-4xl text-white text-center">
              Distribue{' '}
              <span className="text-derby-gold text-6xl">{winner.sipsToDistribute}</span>
              {' '}gorgees !
            </p>
          </motion.div>

          {/* Losers */}
          {losers.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
              className="text-center"
            >
              <p className="text-gray-400 text-lg mb-2">Les perdants boivent leur mise :</p>
              <div className="flex flex-wrap gap-3 justify-center">
                {losers.map((p) => (
                  <div
                    key={p.id}
                    className="bg-derby-red/20 border border-derby-red/40 rounded-lg px-4 py-2"
                  >
                    <span className="text-white font-bold">{p.pseudo}</span>
                    <span className="text-derby-red ml-2">{p.currentBet?.amount}G</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center"
        >
          <h1 className="font-display text-5xl text-gray-400">Aucun gagnant</h1>
          <p className="text-gray-500 mt-2">Personne n'avait parie sur le vainqueur</p>
        </motion.div>
      )}

      {/* Scoreboard overlay */}
      <div className="absolute bottom-4 left-4 w-56 bg-derby-dark/90 rounded-xl p-3 border border-gray-800">
        <Scoreboard players={gameState.players} />
      </div>
    </motion.div>
  )
}
