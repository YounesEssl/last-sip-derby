'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { GameState, HORSE_COLORS } from '@last-sip-derby/shared'

interface Props {
  gameState: GameState
  onComplete: () => void
}

export function RaceResults({ gameState, onComplete }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const hasRun = useRef(false)

  const winner = gameState.lastRaceWinner
  const rankedHorses = [...gameState.horses].sort((a, b) => b.position - a.position)
  const winnerHorse = rankedHorses[0]
  const winnerColor = winnerHorse
    ? HORSE_COLORS[winnerHorse.lane % HORSE_COLORS.length]
    : '#E83B3B'

  const runAnimation = useCallback(async () => {
    const container = containerRef.current
    if (!container || hasRun.current) return
    hasRun.current = true

    const wait = (ms: number) => new Promise<void>(r => setTimeout(r, ms))
    const $ = (sel: string) => container.querySelector(sel) as HTMLElement

    const backdrop = $('[data-el="backdrop"]')
    const badge = $('[data-el="badge"]')
    const horseName = $('[data-el="horse-name"]')
    const divider = $('[data-el="divider"]')
    const playerBlock = $('[data-el="player-block"]')
    const sipsBlock = $('[data-el="sips-block"]')
    const podium = $('[data-el="podium"]')

    // Step 1: Backdrop slides up from bottom
    backdrop.style.transition = 'transform 500ms cubic-bezier(0.22, 1.12, 0.58, 1)'
    backdrop.style.transform = 'translateY(0)'
    await wait(350)

    // Step 2: "VAINQUEUR" badge drops in
    badge.style.transition = 'transform 400ms cubic-bezier(0.22, 1.15, 0.58, 1), opacity 300ms ease-out'
    badge.style.transform = 'translateY(0) scale(1)'
    badge.style.opacity = '1'
    await wait(400)

    // Step 3: Horse name scales up
    horseName.style.transition = 'transform 450ms cubic-bezier(0.22, 1.2, 0.58, 1), opacity 350ms ease-out'
    horseName.style.transform = 'scale(1)'
    horseName.style.opacity = '1'
    await wait(350)

    // Step 4: Divider line expands
    divider.style.transition = 'transform 400ms ease-out, opacity 300ms ease-out'
    divider.style.transform = 'scaleX(1)'
    divider.style.opacity = '1'
    await wait(250)

    // Step 5: Player info fades in
    playerBlock.style.transition = 'transform 400ms cubic-bezier(0.22, 1.1, 0.58, 1), opacity 300ms ease-out'
    playerBlock.style.transform = 'translateY(0)'
    playerBlock.style.opacity = '1'
    await wait(300)

    // Step 6: Sips badge pops
    sipsBlock.style.transition = 'transform 400ms cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 250ms ease-out'
    sipsBlock.style.transform = 'scale(1)'
    sipsBlock.style.opacity = '1'
    await wait(400)

    // Step 7: Podium fades in
    podium.style.transition = 'opacity 500ms ease-out'
    podium.style.opacity = '1'

  }, [])

  useEffect(() => {
    const id = requestAnimationFrame(() => runAnimation())
    return () => cancelAnimationFrame(id)
  }, [runAnimation])

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 overflow-hidden pointer-events-none"
      style={{ zIndex: 90 }}
    >
      {/* ── Backdrop ── */}
      <div
        data-el="backdrop"
        className="absolute inset-0 flex flex-col items-center justify-center bg-pmu-paper"
        style={{
          transform: 'translateY(100%)',
          willChange: 'transform',
        }}
      >
        <div className="paper-texture"></div>

        {/* Decorative top border */}
        <div
          className="absolute top-0 left-0 right-0 h-3 bg-pmu-dark"
        />

        {/* ── Content container ── */}
        <div className="flex flex-col items-center relative z-10" style={{ marginTop: '-3vh' }}>

          {/* Badge: VAINQUEUR */}
          <div
            data-el="badge"
            className="font-rye tracking-[0.4em] uppercase text-pmu-wood"
            style={{
              transform: 'translateY(-60px) scale(0.8)',
              opacity: 0,
              fontSize: 'min(4vh, 2.5vw)',
              letterSpacing: '0.4em',
              willChange: 'transform, opacity',
            }}
          >
            ★ VAINQUEUR ★
          </div>

          {/* Horse name */}
          <div
            data-el="horse-name"
            className="font-rye"
            style={{
              transform: 'scale(0.5)',
              opacity: 0,
              fontSize: 'min(14vh, 9vw)',
              lineHeight: 1,
              color: winnerColor,
              textShadow: `0 4px 0 rgba(0,0,0,0.15)`,
              marginTop: '1vh',
              willChange: 'transform, opacity',
            }}
          >
            {winner?.horseName ?? winnerHorse?.name ?? '???'}
          </div>

          {/* Divider */}
          <div
            data-el="divider"
            className="bg-pmu-dark/20"
            style={{
              transform: 'scaleX(0)',
              opacity: 0,
              width: 'min(50vw, 600px)',
              height: 3,
              marginTop: '3vh',
              willChange: 'transform, opacity',
            }}
          />

          {/* Player block */}
          <div
            data-el="player-block"
            className="flex flex-col items-center"
            style={{
              transform: 'translateY(30px)',
              opacity: 0,
              marginTop: '3vh',
              willChange: 'transform, opacity',
            }}
          >
            {winner ? (
              <>
                <div
                  className="font-mono uppercase tracking-widest text-pmu-wood"
                  style={{ fontSize: 'min(2.5vh, 1.5vw)' }}
                >
                  Parieur gagnant
                </div>
                <div
                  className="font-bebas uppercase text-pmu-dark"
                  style={{
                    fontSize: 'min(10vh, 7vw)',
                    lineHeight: 1.1,
                    marginTop: '0.5vh',
                  }}
                >
                  {winner.pseudo}
                </div>
              </>
            ) : (
              <div
                className="font-mono uppercase tracking-widest text-pmu-dark/40"
                style={{ fontSize: 'min(3vh, 2vw)' }}
              >
                Aucun parieur gagnant
              </div>
            )}
          </div>

          {/* Sips badge */}
          <div
            data-el="sips-block"
            style={{
              transform: 'scale(0.5)',
              opacity: 0,
              marginTop: '3vh',
              willChange: 'transform, opacity',
            }}
          >
            {winner && winner.sipsToDistribute > 0 && (
              <div
                className="font-rye tracking-wide uppercase text-white"
                style={{
                  fontSize: 'min(4vh, 2.5vw)',
                  background: '#E83B3B',
                  padding: '1.2vh 3vw',
                  border: '4px solid #0f0a07',
                  boxShadow: '4px 4px 0px #3a2a1a',
                }}
              >
                Distribue {winner.sipsToDistribute} gorgées !
              </div>
            )}
          </div>
        </div>

        {/* ── Podium: top 3 at bottom ── */}
        <div
          data-el="podium"
          className="absolute bottom-0 left-0 right-0 flex justify-center gap-6 pb-8 z-10"
          style={{ opacity: 0, willChange: 'opacity' }}
        >
          {rankedHorses.slice(0, 3).map((horse, i) => {
            const color = HORSE_COLORS[horse.lane % HORSE_COLORS.length]
            const labels = ['1ER', '2E', '3E']

            return (
              <div
                key={horse.id}
                className="flex items-center gap-3 px-5 py-2.5 bg-white/50 border-2 border-pmu-dark/15"
              >
                <span className="font-rye text-lg text-pmu-dark">{labels[i]}</span>
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center font-mono font-bold text-white text-sm"
                  style={{ backgroundColor: color }}
                >
                  {horse.lane + 1}
                </div>
                <span className="font-mono text-pmu-dark font-bold text-base">
                  {horse.name}
                </span>
              </div>
            )
          })}
        </div>

        {/* Progress bar — time until next race */}
        <div
          className="absolute bottom-0 left-0 right-0 z-10"
          style={{ height: 6, background: 'rgba(15,10,7,0.1)' }}
        >
          <div
            style={{
              height: '100%',
              width: '100%',
              background: '#E83B3B',
              transformOrigin: 'left',
              animation: `shrink-bar ${gameState.phaseDuration}ms linear forwards`,
            }}
          />
        </div>
      </div>
    </div>
  )
}
