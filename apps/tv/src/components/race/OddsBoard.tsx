'use client'

import type { Horse, Player } from '@last-sip-derby/shared'

interface OddsBoardProps {
  horses: Horse[]
  players: Player[]
}

export function OddsBoard({ horses, players }: OddsBoardProps) {
  return (
    <div className="space-y-2">
      {horses.map((horse) => {
        const betters = players.filter((p) => p.currentBet?.horseId === horse.id)

        return (
          <div
            key={horse.id}
            className="flex items-center gap-3 bg-derby-dark/80 rounded-lg px-4 py-2 border border-gray-800"
          >
            <div
              className="w-4 h-4 rounded-full flex-shrink-0"
              style={{ backgroundColor: horse.color }}
            />
            <span className="font-display text-xl flex-1 text-white truncate">
              {horse.name}
            </span>
            <span className="font-display text-2xl text-derby-gold min-w-[60px] text-right">
              {horse.odds}x
            </span>
            {betters.length > 0 && (
              <div className="text-xs text-gray-400 min-w-[80px]">
                {betters.map((p) => p.pseudo).join(', ')}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
