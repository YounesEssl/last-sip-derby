'use client'

import { useMemo, useState, useEffect, useCallback, useRef } from 'react'
import { GameState, GameEvent, HORSE_COLORS } from '@last-sip-derby/shared'
import { useCountdown } from '@/hooks/useCountdown'
import { ParallaxBackground } from './ParallaxBackground'
import { RaceHorse, assignVariants } from './RaceHorse'
import { RaceRankingHUD } from './RaceRankingHUD'

// Virtual viewport: everything is authored at this resolution and uniformly scaled
const V_W = 1920
const V_H = 1080

// Scale per lane: top (far) → bottom (close) — very subtle perspective
const LANE_SCALES = [0.94, 0.96, 0.97, 0.98, 1.0]

// Z-index per lane for depth effect with background layers (bg: 0-5, horses: 4-6)
const LANE_ZINDEX = [4, 4, 5, 6, 6]

// Horse positions in virtual pixels
const TRACK_TOP = 194      // 18% of 1080
const TRACK_HEIGHT = 540    // 50% of 1080
const HORSE_START_X = -60
const HORSE_END_X = 1400    // where position=100 reaches (head at ~1400+560=1960 ≈ right edge)

export const DirtTrack = ({ gameState, activeEvent, eventResolution, raceStarting }: { gameState: GameState, activeEvent: GameEvent | null, eventResolution?: { horseEliminated: boolean; horseName: string } | null, raceStarting?: boolean }) => {
  const timeLeft = useCountdown(gameState.phaseStartedAt, gameState.phaseDuration)
  const isRacing = gameState.phase === 'RACING'
  const isFinished = gameState.phase === 'RESULTS'
  const timerColor = timeLeft < 10 ? '#FF4444' : '#D4A843'

  const rankedHorses = useMemo(
    () => [...gameState.horses].sort((a, b) => b.position - a.position),
    [gameState.horses]
  )

  const leaderId = rankedHorses[0]?.id
  const raceProgress = gameState.raceProgress ?? 0
  const horseCount = gameState.horses.length

  // Assign unique sprite variants per horse (no duplicates in a race)
  const variantMap = useMemo(() => {
    const names = gameState.horses.map(h => h.name)
    const variants = assignVariants(names)
    const map = new Map<string, number>()
    gameState.horses.forEach((h, i) => map.set(h.id, variants[i]))
    return map
  }, [gameState.horses.map(h => h.name).join(',')])

  // Compute uniform scale to fit virtual viewport into actual screen
  const containerRef = useRef<HTMLDivElement>(null)
  const [fitScale, setFitScale] = useState(1)
  const updateFit = useCallback(() => {
    if (!containerRef.current) return
    const { offsetWidth: w, offsetHeight: h } = containerRef.current
    setFitScale(Math.min(w / V_W, h / V_H))
  }, [])
  useEffect(() => {
    updateFit()
    window.addEventListener('resize', updateFit)
    return () => window.removeEventListener('resize', updateFit)
  }, [updateFit])

  const laneHeight = TRACK_HEIGHT / horseCount

  return (
    <div ref={containerRef} className="relative w-full h-full bg-black overflow-hidden">

      {/* ── PARALLAX BACKGROUND (fills real viewport) ── */}
      <div className="absolute inset-0 z-0">
        <ParallaxBackground isRacing={isRacing && !gameState.racePaused} raceProgress={raceProgress} isFinished={isFinished} />
      </div>

      {/* ── VIRTUAL VIEWPORT — everything inside is at 1920×1080 and scaled ── */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: V_W,
          height: V_H,
          transform: `translate(-50%, -50%) scale(${fitScale})`,
          transformOrigin: 'center center',
          pointerEvents: 'none',
        }}
      >
        {/* ── RACE TRACK LANES ── */}
        <div
          style={{
            position: 'absolute',
            top: TRACK_TOP,
            left: 0,
            width: V_W,
            height: TRACK_HEIGHT,
          }}
        >
          {gameState.horses.map((horse, i) => {
            const scale = LANE_SCALES[i % LANE_SCALES.length]
            const isLeading = horse.id === leaderId && isRacing

            const visualPos = Math.pow(horse.position / 100, 3.2) * 100
            const horseX = (isRacing || isFinished)
              ? HORSE_START_X + (visualPos / 100) * (HORSE_END_X - HORSE_START_X)
              : HORSE_START_X

            return (
              <div
                key={horse.id}
                style={{
                  position: 'absolute',
                  top: i * laneHeight,
                  left: 0,
                  width: '100%',
                  height: laneHeight,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    left: horseX,
                    transform: `scale(${scale})`,
                    transformOrigin: 'bottom left',
                    zIndex: LANE_ZINDEX[i % LANE_ZINDEX.length],
                    transition: raceStarting ? 'left 0.8s ease-out' : 'opacity 2s ease-out',
                    opacity: horse.isEliminated ? 0 : 1,
                  }}
                >
                  {/* Number badge — centered on horse body */}
                  <div
                    className="absolute flex items-center justify-center font-mono font-bold text-white"
                    style={{
                      top: 240,
                      left: 260,
                      width: 38,
                      height: 38,
                      fontSize: 22,
                      backgroundColor: HORSE_COLORS[horse.lane % HORSE_COLORS.length],
                      borderRadius: '50%',
                      border: '3px solid rgba(255,255,255,0.9)',
                      boxShadow: `0 2px 8px rgba(0,0,0,0.7), 0 0 14px ${HORSE_COLORS[horse.lane % HORSE_COLORS.length]}80`,
                      zIndex: 50,
                    }}
                  >
                    {horse.lane + 1}
                  </div>
                  <RaceHorse
                    number={horse.lane + 1}
                    variantIndex={variantMap.get(horse.id) ?? 0}
                    speed={horse.effectiveSpeed}
                    isRacing={isRacing && !horse.isEliminated && !gameState.racePaused}
                    isFrozen={isFinished || horse.isEliminated || gameState.racePaused}
                    isStunned={false}
                    isLeading={isLeading && !horse.isEliminated}
                    colorIndex={horse.lane}
                    scale={1}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── RANKING HUD (outside virtual viewport — uses its own responsive layout) ── */}
      {(isRacing || isFinished) && (
        <RaceRankingHUD horses={gameState.horses} raceProgress={raceProgress} />
      )}

      {/* ── ACTIVE EVENT OVERLAY ── */}
      {activeEvent && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" style={{ pointerEvents: 'auto' }}>
          <div className="glass-panel px-16 py-10 text-center max-w-3xl">
            <h1 className="text-6xl text-pmu-alert font-rye uppercase tracking-wider leading-tight animate-pulse">
              {activeEvent.title}
            </h1>
            <p className="text-2xl text-pmu-dark/80 mt-6 font-mono leading-relaxed">
              {activeEvent.description}
            </p>
            <div className="mt-6 text-4xl font-bold text-pmu-alert">
              {activeEvent.sipsAmount} GORGEE{activeEvent.sipsAmount > 1 ? 'S' : ''} A BOIRE !
            </div>
            {eventResolution ? (
              <div className={`mt-8 text-3xl font-rye ${eventResolution.horseEliminated ? 'text-pmu-alert' : 'text-green-700'}`}>
                {eventResolution.horseEliminated
                  ? `${eventResolution.horseName} EST ELIMINE !`
                  : 'VALIDE ! La course reprend...'}
              </div>
            ) : (
              <div className="mt-8">
                <p className="text-lg text-pmu-dark/50 font-mono mb-3">EN ATTENTE DES VOTES...</p>
                <div className="flex justify-center gap-8 text-2xl font-mono">
                  <span className="text-green-700 font-bold">
                    VALIDE: {Object.values(activeEvent.votes).filter((v) => v).length}
                  </span>
                  <span className="text-pmu-alert font-bold">
                    PAS VALIDE: {Object.values(activeEvent.votes).filter((v) => !v).length}
                  </span>
                  <span className="text-pmu-dark/30">
                    / {activeEvent.nonAffectedPlayerIds.length}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
