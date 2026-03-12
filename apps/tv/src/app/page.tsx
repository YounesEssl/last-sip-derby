'use client'

import { useGameSocket } from '@/hooks/useGameSocket'
import { Screen } from '@/components/tv/Screen'
import { DirtTrack } from '@/components/tv/DirtTrack'

export default function TVPage() {
  const { gameState, activeEvent, connected, startRace, resetRace } = useGameSocket()

  if (!connected || !gameState) {
    return (
      <Screen>
        <div className="text-center">
          <h1 className="font-rye text-[80px] text-western-gold leading-none mb-4" style={{ textShadow: '0 0 30px rgba(212,168,67,0.4)' }}>
            Last Sip Derby
          </h1>
          <p className="font-mono text-[28px] text-western-gold/60 animate-pulse">
            ESTABLISHING CONNECTION...
          </p>
        </div>
      </Screen>
    )
  }

  return (
    <Screen>
      <DirtTrack gameState={gameState} activeEvent={activeEvent} />

      {/* Dev controls */}
      <div className="absolute bottom-12 right-6 z-50 flex gap-3">
        <button
          onClick={resetRace}
          className="px-5 py-2 bg-white/10 text-white font-mono text-sm border border-white/20 hover:bg-white/20 transition-colors rounded"
        >
          RESET
        </button>
        <button
          onClick={startRace}
          className="px-5 py-2 bg-green-700/80 text-white font-mono text-sm border border-green-400/40 hover:bg-green-600/80 transition-colors rounded"
        >
          START RACE
        </button>
      </div>
    </Screen>
  )
}
