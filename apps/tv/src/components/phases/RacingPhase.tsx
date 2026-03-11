'use client'

import type { GameState, GameEvent } from '@last-sip-derby/shared'
import { Timer } from '../ui/Timer'
import { Track } from '../race/Track'
import { EventBanner } from '../ui/EventBanner'
import { Scoreboard } from '../ui/Scoreboard'

interface RacingPhaseProps {
  gameState: GameState
  activeEvent: GameEvent | null
}

export function RacingPhase({ gameState, activeEvent }: RacingPhaseProps) {
  const sortedHorses = [...gameState.horses].sort((a, b) => b.position - a.position)

  return (
    <div className="h-screen flex flex-col p-4 relative">
      <EventBanner event={activeEvent} />

      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-4">
          <h1 className="font-display text-4xl text-derby-gold">COURSE #{gameState.raceNumber}</h1>
          <div className="h-3 w-3 rounded-full bg-derby-red animate-pulse" />
          <span className="text-derby-red font-display text-xl">EN DIRECT</span>
        </div>
        <Timer startedAt={gameState.phaseStartedAt} duration={gameState.phaseDuration} />
      </div>

      {/* Track */}
      <div className="flex-1 bg-derby-dark rounded-xl border border-gray-800 p-4 mb-3 overflow-hidden">
        <Track horses={gameState.horses} />
      </div>

      {/* Bottom bar */}
      <div className="flex gap-4 h-40">
        {/* Scoreboard */}
        <div className="w-64 bg-derby-dark rounded-xl p-3 border border-gray-800 overflow-y-auto">
          <Scoreboard players={gameState.players} />
        </div>

        {/* Live standings */}
        <div className="flex-1 bg-derby-dark rounded-xl p-3 border border-gray-800">
          <h3 className="font-display text-lg text-derby-gold mb-2">CLASSEMENT EN DIRECT</h3>
          <div className="grid grid-cols-3 gap-x-4 gap-y-1">
            {sortedHorses.map((horse, i) => {
              const better = gameState.players.find(
                (p) => p.currentBet?.horseId === horse.id,
              )
              return (
                <div key={horse.id} className="flex items-center gap-2 text-sm">
                  <span className="text-gray-500 w-5">{i + 1}.</span>
                  <div
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: horse.color }}
                  />
                  <span className="text-white truncate">{horse.name}</span>
                  {better && (
                    <span className="text-gray-500 text-xs">
                      ({better.pseudo})
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
