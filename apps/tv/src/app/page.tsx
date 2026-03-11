'use client'

import { useGameSocket } from '@/hooks/useGameSocket'
import { BettingPhase } from '@/components/phases/BettingPhase'
import { RacingPhase } from '@/components/phases/RacingPhase'
import { ResultsPhase } from '@/components/phases/ResultsPhase'
import { IdlePhase } from '@/components/phases/IdlePhase'

export default function TVPage() {
  const { gameState, activeEvent, connected } = useGameSocket()

  if (!connected || !gameState) {
    return (
      <div className="flex h-screen items-center justify-center bg-derby-bg">
        <div className="text-center">
          <h1 className="font-display text-6xl text-derby-gold mb-4">LAST SIP DERBY</h1>
          <p className="text-gray-400 text-xl animate-pulse">Connexion au serveur...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen w-screen bg-derby-bg overflow-hidden">
      {gameState.phase === 'BETTING' && (
        <BettingPhase gameState={gameState} />
      )}
      {gameState.phase === 'RACING' && (
        <RacingPhase gameState={gameState} activeEvent={activeEvent} />
      )}
      {gameState.phase === 'RESULTS' && (
        <ResultsPhase gameState={gameState} />
      )}
      {gameState.phase === 'IDLE' && (
        <IdlePhase gameState={gameState} />
      )}
    </div>
  )
}
