'use client'

import { useMemo } from 'react'
import { GameState, GameEvent, HORSE_COLORS } from '@last-sip-derby/shared'
import { useCountdown } from '@/hooks/useCountdown'
import { ParallaxBackground } from './ParallaxBackground'
import { RaceHorse } from './RaceHorse'

// Scale per lane: top (far) → bottom (close) — subtle perspective
const LANE_SCALES = [0.85, 0.88, 0.91, 0.94, 0.97, 1.0]

// Z-index per lane for depth effect with background layers (bg: 0-5, horses: 4-6)
const LANE_ZINDEX = [4, 4, 5, 5, 6, 6]

export const DirtTrack = ({ gameState, activeEvent }: { gameState: GameState, activeEvent: GameEvent | null }) => {
  const timeLeft = useCountdown(gameState.phaseStartedAt, gameState.phaseDuration)
  const isRacing = gameState.phase === 'RACING'
  const isFinished = gameState.phase === 'RESULTS'
  const timerColor = timeLeft < 10 ? '#FF4444' : '#7BC67E'

  const rankedHorses = useMemo(
    () => [...gameState.horses].sort((a, b) => b.position - a.position),
    [gameState.horses]
  )

  const leaderProgress = rankedHorses[0]?.position ?? 0
  const leaderId = rankedHorses[0]?.id
  const raceProgress = leaderProgress
  const horseCount = gameState.horses.length

  return (
    <div className="relative w-full h-full bg-black overflow-hidden">

      {/* ── PARALLAX BACKGROUND ── */}
      <div className="absolute inset-0 z-0">
        <ParallaxBackground isRacing={isRacing} raceProgress={raceProgress} isFinished={isFinished} />
      </div>


      {/* ── RACE TRACK — flex column lanes ── */}
      <div
        style={{
          position: 'absolute',
          top: '12%',
          left: 0,
          right: 0,
          height: '65%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-around',
        }}
      >
        {gameState.horses.map((horse, i) => {
          const scale = LANE_SCALES[i % LANE_SCALES.length]
          const isLeading = horse.id === leaderId && isRacing

          const maxVw = 0.72
          const translateX = (isRacing || isFinished)
            ? `calc(-60px + ${horse.position * maxVw}vw)`
            : '-60px'

          return (
            <div
              key={horse.id}
              style={{
                position: 'relative',
                height: `${100 / horseCount}%`,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  transform: `translateX(${translateX}) scale(${scale})`,
                  transformOrigin: 'bottom left',
                  zIndex: LANE_ZINDEX[i % LANE_ZINDEX.length],
                }}
              >
                <RaceHorse
                  number={horse.lane + 1}
                  speed={horse.effectiveSpeed}
                  isRacing={isRacing}
                  isFrozen={isFinished}
                  isStunned={horse.isStunned}
                  isLeading={isLeading}
                  colorIndex={horse.lane}
                  scale={1}
                />
              </div>
              {/* Number badge — positioned independently */}
              <div
                className="absolute flex items-center justify-center font-mono font-bold text-white"
                style={{
                  transform: `translateX(calc(${translateX} + 80px))`,
                  width: 32,
                  height: 32,
                  fontSize: 18,
                  backgroundColor: HORSE_COLORS[horse.lane % HORSE_COLORS.length],
                  borderRadius: '50%',
                  border: '2px solid rgba(255,255,255,0.6)',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.5)',
                  zIndex: 50,
                }}
              >
                {horse.lane + 1}
              </div>
            </div>
          )
        })}
      </div>


      {/* ── FLOATING RACE PANEL ── */}
      {(isRacing || isFinished) && (
        <RacePanel
          horses={gameState.horses}
          rankedHorses={rankedHorses}
          leaderId={leaderId}
          raceProgress={raceProgress}
        />
      )}


      {/* ── ACTIVE EVENT OVERLAY ── */}
      {activeEvent && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm pointer-events-none">
          <div className="glass-panel px-16 py-10 text-center shadow-2xl">
            <h1 className="text-5xl text-prairie-accent font-rye uppercase tracking-wider leading-tight">
              {activeEvent.type.replace(/_/g, ' ')}
            </h1>
            <p className="text-2xl text-white/80 mt-4 font-mono">{activeEvent.message}</p>
          </div>
        </div>
      )}

      {/* ── VICTORY OVERLAY ── */}
      {gameState.phase === 'RESULTS' && gameState.lastRaceWinner && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm pointer-events-none">
          <div className="glass-panel text-center px-20 py-14" style={{ boxShadow: '0 0 80px rgba(120,200,80,0.2)' }}>
            <h2 className="text-3xl font-mono text-prairie-accent/60 mb-2 tracking-[0.3em] uppercase">
              VAINQUEUR
            </h2>
            <div
              className="font-rye text-prairie-accent pb-4 pt-2"
              style={{ fontSize: '100px', lineHeight: '1', textShadow: '0 0 40px rgba(120,200,80,0.5)' }}
            >
              {gameState.lastRaceWinner.horseName}
            </div>
            <div className="mt-8 pt-8 border-t border-prairie-accent/20">
              <div className="text-4xl text-white/50 font-mono mb-3">Gagnant</div>
              <div className="text-7xl text-red-500 font-bold uppercase leading-none mb-8 font-bebas">
                {gameState.lastRaceWinner.pseudo}
              </div>
              <div className="bg-prairie-accent text-black font-bold px-12 py-5 rounded-lg text-3xl inline-block font-bebas tracking-wide">
                DISTRIBUE {gameState.lastRaceWinner.sipsToDistribute} GORGEES !
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Race Panel — centered top 3 ── */
function RacePanel({
  rankedHorses,
}: {
  horses: GameState['horses']
  rankedHorses: GameState['horses']
  leaderId: string | undefined
  raceProgress: number
}) {
  const top3 = rankedHorses.slice(0, 3)
  const medals = ['🥇', '🥈', '🥉']

  return (
    <div
      className="absolute z-40 flex justify-center items-center gap-4 py-3"
      style={{
        top: 0,
        left: 0,
        right: 0,
        background: 'linear-gradient(180deg, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0) 100%)',
      }}
    >
      {top3.map((horse, rank) => {
        const color = HORSE_COLORS[horse.lane % HORSE_COLORS.length]

        return (
          <div
            key={horse.id}
            className="flex items-center gap-2 px-4 py-2 rounded-xl"
            style={{
              background: rank === 0 ? 'rgba(255,215,0,0.15)' : 'rgba(255,255,255,0.08)',
              border: rank === 0 ? '1px solid rgba(255,215,0,0.4)' : '1px solid rgba(255,255,255,0.1)',
            }}
          >
            <span className="text-lg">{medals[rank]}</span>
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center font-mono font-bold text-white text-base"
              style={{ backgroundColor: color }}
            >
              {horse.lane + 1}
            </div>
            <span className="font-mono text-white text-base font-bold">
              {horse.name}
            </span>
          </div>
        )
      })}
    </div>
  )
}

/* ── Odds Panel ── */
function OddsPanel({ gameState }: { gameState: GameState }) {
  return (
    <div
      className="absolute z-40 glass-panel"
      style={{
        top: '56px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '520px',
        maxHeight: '320px',
        padding: '0',
        overflow: 'hidden',
      }}
    >
      <div
        className="px-4 py-1.5 text-center"
        style={{ background: 'linear-gradient(135deg, #0f2e0f, #1a4d1a)' }}
      >
        <span className="font-rye text-prairie-accent text-base tracking-wider uppercase">
          {gameState.phase === 'BETTING' ? 'Paris ouverts' : 'Prochaine course'}
          {' '} — N°{gameState.raceNumber}
        </span>
      </div>

      <div className="px-3 py-1.5">
        {gameState.horses.map((horse) => {
          const color = HORSE_COLORS[horse.lane % HORSE_COLORS.length]
          const betsOnHorse = gameState.players.filter(p => p.currentBet?.horseId === horse.id)
          const totalBet = betsOnHorse.reduce((sum, p) => sum + (p.currentBet?.amount || 0), 0)

          return (
            <div key={horse.id} className="flex items-center gap-2.5 py-1 border-b border-prairie-accent/10 last:border-0">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center font-mono font-bold text-white text-xs shrink-0"
                style={{ backgroundColor: color }}
              >
                {horse.lane + 1}
              </div>
              <span className="text-white text-sm font-mono flex-1 truncate">
                {horse.name}
              </span>
              {totalBet > 0 && (
                <span className="text-prairie-accent/40 text-[11px] font-mono">
                  {betsOnHorse.length}j · {totalBet}G
                </span>
              )}
              <span className="font-mono text-FFD700 text-base font-bold min-w-[44px] text-right">
                {horse.odds}:1
              </span>
            </div>
          )
        })}
      </div>

      <div className="px-3 py-1.5 border-t border-prairie-accent/10 flex justify-between items-center">
        <span className="font-mono text-[11px] text-prairie-accent/30">
          {gameState.players.filter(p => p.isConnected).length} joueurs connectes
        </span>
        {gameState.phase === 'BETTING' && (
          <span className="font-mono text-[11px] text-prairie-accent animate-pulse">
            PLACEZ VOS PARIS
          </span>
        )}
      </div>
    </div>
  )
}
