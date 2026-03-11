'use client'

import { motion } from 'framer-motion'
import type { GameState } from '@last-sip-derby/shared'
import { Timer } from '../ui/Timer'
import { OddsBoard } from '../race/OddsBoard'
import { QRCode } from '../ui/QRCode'
import { Scoreboard } from '../ui/Scoreboard'

interface BettingPhaseProps {
  gameState: GameState
}

export function BettingPhase({ gameState }: BettingPhaseProps) {
  const mobileUrl = process.env.NEXT_PUBLIC_MOBILE_URL ?? 'http://localhost:3002'
  const activeBetters = gameState.players.filter((p) => p.currentBet)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="h-screen flex flex-col p-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-5xl text-derby-gold">PROCHAINE COURSE</h1>
          <p className="text-gray-400 text-lg">Course #{gameState.raceNumber} — Paris ouverts</p>
        </div>
        <div className="text-right">
          <Timer startedAt={gameState.phaseStartedAt} duration={gameState.phaseDuration} />
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex gap-6 min-h-0">
        {/* Left: QR Code + scoreboard */}
        <div className="w-72 flex flex-col gap-6">
          <div className="bg-derby-dark rounded-xl p-4 border border-gray-800 flex flex-col items-center">
            <p className="text-derby-gold font-display text-lg mb-3">SCANNER POUR PARIER</p>
            <QRCode url={mobileUrl} size={180} />
            <p className="text-gray-500 text-xs mt-3">
              {gameState.players.length} joueur{gameState.players.length !== 1 ? 's' : ''} connect{gameState.players.length !== 1 ? 'es' : 'e'}
            </p>
          </div>

          {gameState.players.length > 0 && (
            <div className="bg-derby-dark rounded-xl p-4 border border-gray-800 flex-1 overflow-y-auto">
              <Scoreboard players={gameState.players} />
            </div>
          )}
        </div>

        {/* Right: Horses + active bets */}
        <div className="flex-1 flex flex-col gap-4">
          <div className="bg-derby-dark rounded-xl p-6 border border-gray-800 flex-1">
            <h2 className="font-display text-2xl text-white mb-4">LES CHEVAUX</h2>
            <OddsBoard horses={gameState.horses} players={gameState.players} />
          </div>

          {activeBetters.length > 0 && (
            <div className="bg-derby-dark rounded-xl p-4 border border-gray-800">
              <h3 className="font-display text-lg text-derby-gold mb-2">PARIS EN COURS</h3>
              <div className="flex flex-wrap gap-2">
                {activeBetters.map((p) => {
                  const horse = gameState.horses.find((h) => h.id === p.currentBet?.horseId)
                  return (
                    <div
                      key={p.id}
                      className="bg-derby-muted rounded px-3 py-1 text-sm"
                    >
                      <span className="text-white font-bold">{p.pseudo}</span>
                      <span className="text-gray-400"> → </span>
                      <span style={{ color: horse?.color }}>{horse?.name}</span>
                      <span className="text-derby-gold ml-1">({p.currentBet?.amount}G)</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}
