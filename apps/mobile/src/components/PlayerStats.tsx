'use client'

import type { Player } from '@last-sip-derby/shared'

interface PlayerStatsProps {
  player: Player
}

export function PlayerStats({ player }: PlayerStatsProps) {
  return (
    <div className="bg-derby-dark border-t border-gray-800 px-4 py-3 flex justify-between text-sm">
      <div className="text-center">
        <div className="text-derby-gold font-display text-lg">{player.totalSipsGiven}</div>
        <div className="text-gray-500 text-xs">Donnees</div>
      </div>
      <div className="text-center">
        <div className="text-derby-red font-display text-lg">{player.totalSipsDrunk}</div>
        <div className="text-gray-500 text-xs">Bues</div>
      </div>
      <div className="text-center">
        <div className={`font-display text-lg ${player.debt > 0 ? 'text-derby-red animate-pulse' : 'text-gray-400'}`}>
          {player.debt}
        </div>
        <div className="text-gray-500 text-xs">Dette</div>
      </div>
    </div>
  )
}
