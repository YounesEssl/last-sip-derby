'use client'

import { useRef, useState, useEffect } from 'react'
import type { Horse as HorseType, Player } from '@last-sip-derby/shared'
import { Horse } from './Horse'

interface TrackProps {
  horses: HorseType[]
  players?: Player[]
}

export function Track({ horses, players = [] }: TrackProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [trackWidth, setTrackWidth] = useState(800)

  useEffect(() => {
    const updateWidth = () => {
      if (trackRef.current) {
        setTrackWidth(trackRef.current.offsetWidth)
      }
    }

    updateWidth()
    window.addEventListener('resize', updateWidth)
    return () => window.removeEventListener('resize', updateWidth)
  }, [])

  return (
    <div ref={trackRef} className="relative w-full h-full">
      {/* Sky gradient */}
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(180deg, #0D1020 0%, #1A1F2E 40%, #1E2A1E 70%, #1A2618 100%)',
        }}
      />

      {/* Track lanes */}
      <div className="relative h-full flex flex-col">
        {horses.map((horse, i) => {
          const better = players.find((p) => p.currentBet?.horseId === horse.id)
          const laneHeight = `${100 / horses.length}%`

          return (
            <div
              key={horse.id}
              className="relative border-b border-white/5 flex-1"
              style={{
                background: i % 2 === 0
                  ? 'rgba(26, 31, 46, 0.4)'
                  : 'rgba(26, 31, 46, 0.2)',
              }}
            >
              {/* Lane number */}
              <div className="absolute left-0 top-0 bottom-0 w-10 flex items-center justify-center font-mono text-[24px] text-derby-muted/50 border-r border-white/5">
                {i + 1}
              </div>

              {/* Lane stripe pattern */}
              <div
                className="absolute left-10 right-4 top-0 bottom-0"
                style={{
                  backgroundImage: 'repeating-linear-gradient(90deg, transparent 0px, transparent 58px, rgba(255,255,255,0.02) 58px, rgba(255,255,255,0.02) 60px)',
                  animation: 'track-scroll 1s linear infinite',
                }}
              />

              {/* Horse */}
              <div className="absolute left-12 right-8 top-0 bottom-0">
                <Horse horse={horse} trackWidth={trackWidth - 80} better={better} />
              </div>
            </div>
          )
        })}
      </div>

      {/* Start line */}
      <div className="absolute left-12 top-0 bottom-0 w-0.5 bg-white/20" />

      {/* Finish line */}
      <div
        className="absolute right-4 top-0 bottom-0 w-2"
        style={{
          background: 'repeating-linear-gradient(0deg, #F0EDE4 0px, #F0EDE4 6px, #08090D 6px, #08090D 12px)',
          animation: 'glow-neon 2s ease-in-out infinite',
        }}
      />
    </div>
  )
}
