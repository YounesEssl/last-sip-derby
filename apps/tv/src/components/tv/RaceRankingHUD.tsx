'use client'

import { useMemo, useRef, useState, useEffect, useCallback } from 'react'
import { Horse } from '@last-sip-derby/shared'

const SLOT_WIDTH = 80
const AVATAR_SIZE = 44

function ordinal(n: number): string {
  if (n === 1) return '1er'
  return `${n}e`
}

export function RaceRankingHUD({ horses, raceProgress, colorMap }: { horses: Horse[]; raceProgress: number; colorMap: Map<string, string> }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(0)

  const updateWidth = useCallback(() => {
    if (containerRef.current) {
      setContainerWidth(containerRef.current.offsetWidth)
    }
  }, [])

  useEffect(() => {
    updateWidth()
    const ro = new ResizeObserver(updateWidth)
    if (containerRef.current) ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [updateWidth])

  // Sort by position descending → rank 0 = leader (exclude eliminated)
  const ranked = useMemo(
    () => [...horses].filter((h) => !h.isEliminated).sort((a, b) => b.position - a.position),
    [horses],
  )

  const n = ranked.length
  if (n === 0) return null

  const rankMap = new Map<string, number>()
  ranked.forEach((h, i) => rankMap.set(h.id, i))

  const usableWidth = Math.max(0, containerWidth - SLOT_WIDTH)

  return (
    <div
      className="absolute z-40 flex flex-col items-center"
      style={{
        top: 0,
        left: 0,
        right: 0,
        background: 'linear-gradient(180deg, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.45) 70%, transparent 100%)',
        paddingTop: 8,
        paddingBottom: 16,
      }}
    >
      {/* Inner container with fixed proportional width */}
      <div
        ref={containerRef}
        className="relative select-none"
        style={{
          width: '85%',
          maxWidth: 900,
          height: AVATAR_SIZE + 46,
        }}
      >
        {ranked.map((horse) => {
          const rank = rankMap.get(horse.id) ?? n - 1
          const isLeader = rank === 0
          const isTop3 = rank < 3
          const color = colorMap.get(horse.id) ?? '#888'

          // rank 0 → rightmost, rank n-1 → leftmost
          const slotLeft =
            n === 1 ? usableWidth / 2 : ((n - 1 - rank) / (n - 1)) * usableWidth

          return (
            <div
              key={horse.id}
              className="absolute flex flex-col items-center"
              style={{
                left: slotLeft,
                top: 0,
                width: SLOT_WIDTH,
                transition: 'left 600ms cubic-bezier(0.34, 1.56, 0.64, 1)',
                zIndex: isLeader ? 20 : 10 - rank,
              }}
            >
              {/* Rank badge — top-left of avatar */}
              <div
                className="absolute font-mono text-center leading-none font-bold"
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  top: -4,
                  left: SLOT_WIDTH / 2 - AVATAR_SIZE / 2 - 6,
                  fontSize: 11,
                  lineHeight: '20px',
                  background: 'rgba(255,255,255,0.12)',
                  color: 'rgba(255,255,255,0.5)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  zIndex: 30,
                }}
              >
                {rank + 1}
              </div>

              {/* Avatar */}
              <div
                className="relative flex items-center justify-center font-mono font-bold text-white"
                style={{
                  width: AVATAR_SIZE,
                  height: AVATAR_SIZE,
                  borderRadius: '50%',
                  backgroundColor: color,
                  border: isLeader
                    ? '3px solid #FFD700'
                    : '2px solid rgba(255,255,255,0.2)',
                  boxShadow: isLeader
                    ? '0 0 18px rgba(255,215,0,0.6), 0 0 40px rgba(255,215,0,0.15)'
                    : '0 2px 8px rgba(0,0,0,0.6)',
                  fontSize: 20,
                  transform: isLeader ? 'scale(1.15)' : 'scale(1)',
                  transition: 'transform 400ms cubic-bezier(0.34, 1.56, 0.64, 1), border 300ms ease, box-shadow 300ms ease',
                }}
              >
                {horse.lane + 1}
              </div>

              {/* Horse name */}
              <div
                className="font-mono font-bold truncate text-center leading-none mt-1"
                style={{
                  width: SLOT_WIDTH + 10,
                  fontSize: 10,
                  color: isLeader ? '#FFD700' : 'rgba(255,255,255,0.55)',
                  textShadow: '0 1px 3px rgba(0,0,0,0.9)',
                  transition: 'color 300ms ease',
                }}
              >
                {horse.name}
              </div>
              {/* Sips */}
              <div
                className="font-mono font-bold text-center leading-none"
                style={{ fontSize: 11, color: '#D4A843', marginTop: 1 }}
              >
                {horse.odds}G
              </div>

              {/* Ordinal label */}
              <div
                className="font-rye leading-none"
                style={{
                  fontSize: 11,
                  marginTop: 1,
                  color: isLeader ? '#FFD700' : 'rgba(212,168,67,0.45)',
                  textShadow: isLeader ? '0 0 10px rgba(255,215,0,0.5)' : undefined,
                  transition: 'color 300ms ease',
                }}
              >
                {ordinal(rank + 1)}
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Race progress bar ── */}
      <div
        className="relative"
        style={{
          width: '85%',
          maxWidth: 900,
          height: 6,
          marginTop: 4,
          borderRadius: 3,
          background: 'rgba(255,255,255,0.08)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${Math.min(100, raceProgress)}%`,
            borderRadius: 3,
            background: raceProgress > 85
              ? 'linear-gradient(90deg, #D4A843, #FF6B35)'
              : 'linear-gradient(90deg, #457B9D, #D4A843)',
            boxShadow: raceProgress > 85
              ? '0 0 12px rgba(255,107,53,0.6)'
              : '0 0 8px rgba(212,168,67,0.3)',
            transition: 'width 200ms linear, background 500ms ease',
          }}
        />
      </div>
    </div>
  )
}
