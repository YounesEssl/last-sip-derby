'use client'

import type { Horse, Player } from '@last-sip-derby/shared'
import { HorseSVG } from './HorseSVG'

interface OddsBoardProps {
  horses: Horse[]
  players: Player[]
}

export function OddsBoard({ horses, players }: OddsBoardProps) {
  return (
    <div className="grid grid-cols-2 gap-4">
      {horses.map((horse, i) => {
        const betters = players.filter((p) => p.currentBet?.horseId === horse.id)

        return (
          <div
            key={horse.id}
            className="relative overflow-hidden rounded-lg"
            style={{
              background: 'linear-gradient(135deg, rgba(26, 31, 46, 0.8) 0%, rgba(15, 17, 24, 0.9) 100%)',
              border: `2px solid ${horse.color}30`,
            }}
          >
            {/* Color band top */}
            <div className="h-1.5" style={{ background: horse.color }} />

            <div className="p-4 flex items-center gap-4">
              {/* Horse number */}
              <div
                className="w-10 h-10 flex items-center justify-center font-display text-[32px] rounded"
                style={{ background: `${horse.color}20`, color: horse.color }}
              >
                {i + 1}
              </div>

              {/* Horse info */}
              <div className="flex-1 min-w-0">
                <div className="font-display text-[32px] text-derby-text leading-none truncate">
                  {horse.name.toUpperCase()}
                </div>
                {/* Stat bars - intentionally vague */}
                <div className="flex gap-3 mt-2">
                  <div className="flex items-center gap-1.5">
                    <span className="font-body text-[18px] text-derby-muted">VIT</span>
                    <div className="flex gap-0.5">
                      {Array.from({ length: 5 }).map((_, j) => (
                        <div
                          key={j}
                          className="w-3 h-2 rounded-sm"
                          style={{
                            background: j < Math.ceil(horse.speed / 2) ? horse.color : 'rgba(90, 95, 117, 0.3)',
                          }}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-body text-[18px] text-derby-muted">END</span>
                    <div className="flex gap-0.5">
                      {Array.from({ length: 5 }).map((_, j) => (
                        <div
                          key={j}
                          className="w-3 h-2 rounded-sm"
                          style={{
                            background: j < Math.ceil(horse.endurance / 2) ? horse.color : 'rgba(90, 95, 117, 0.3)',
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Horse SVG */}
              <div className="flex-shrink-0">
                <HorseSVG color={horse.color} isRunning={false} scale={0.8} />
              </div>

              {/* Odds */}
              <div className="text-right flex-shrink-0">
                <div
                  className="font-display text-[48px] leading-none"
                  style={{ color: '#D4A843', textShadow: '0 0 15px rgba(212, 168, 67, 0.3)' }}
                >
                  {horse.odds}x
                </div>
              </div>
            </div>

            {/* Betters */}
            {betters.length > 0 && (
              <div className="px-4 pb-3">
                <div className="flex gap-2">
                  {betters.map((p) => (
                    <span
                      key={p.id}
                      className="font-body text-[20px] px-2 py-0.5 rounded"
                      style={{ background: `${horse.color}20`, color: horse.color }}
                    >
                      {p.pseudo} ({p.currentBet?.amount}G)
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
