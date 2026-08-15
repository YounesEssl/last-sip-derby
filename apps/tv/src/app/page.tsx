'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { GamePhase } from '@last-sip-derby/shared'
import { useGameSocket } from '@/hooks/useGameSocket'
import { IdleScreen } from '@/components/screens/IdleScreen'
import { BettingScreen } from '@/components/screens/BettingScreen'
import { RaceScreen } from '@/components/screens/RaceScreen'
import { ResultsScreen } from '@/components/screens/ResultsScreen'
import { ExperienceControls } from '@/components/ExperienceControls'
import { RulebookViewer } from '@/components/RulebookViewer'

// After the winner crosses the line, hold the race view for the photo-finish
// celebration before cutting to the podium.
const FINISH_HOLD_MS = 5200

export default function TVPage() {
  const { gameState, activeEvent, eventResolution, connected, startRace, resetRace, resetSession, setRulesOpen } = useGameSocket()
  const [displayPhase, setDisplayPhase] = useState<GamePhase | null>(null)
  const [finishHold, setFinishHold] = useState(false)
  const prevPhaseRef = useRef<GamePhase | null>(null)
  const gameLayerRef = useRef<HTMLDivElement>(null)
  const pausedAnimationsRef = useRef<Animation[]>([])
  const finishTimerRef = useRef<number | null>(null)
  const finishDeadlineRef = useRef(0)
  const finishRemainingRef = useRef(FINISH_HOLD_MS)
  const finishHoldRef = useRef(false)
  const gamePausedRef = useRef(false)

  const phase = gameState?.phase ?? null
  gamePausedRef.current = gameState?.isGamePaused ?? false

  const completeFinishHold = useCallback(() => {
    if (finishTimerRef.current !== null) window.clearTimeout(finishTimerRef.current)
    finishTimerRef.current = null
    finishHoldRef.current = false
    setFinishHold(false)
    setDisplayPhase('RESULTS')
  }, [])

  const armFinishHold = useCallback((durationMs: number) => {
    finishRemainingRef.current = Math.max(0, durationMs)
    if (finishTimerRef.current !== null) window.clearTimeout(finishTimerRef.current)
    finishTimerRef.current = null
    if (gamePausedRef.current) return
    if (finishRemainingRef.current <= 0) {
      completeFinishHold()
      return
    }
    finishDeadlineRef.current = performance.now() + finishRemainingRef.current
    finishTimerRef.current = window.setTimeout(completeFinishHold, finishRemainingRef.current)
  }, [completeFinishHold])

  useEffect(() => {
    if (!phase) return
    const prev = prevPhaseRef.current
    prevPhaseRef.current = phase

    if (prev === 'RACING' && phase === 'RESULTS') {
      finishHoldRef.current = true
      setFinishHold(true)
      armFinishHold(FINISH_HOLD_MS)
      return
    }
    if (finishTimerRef.current !== null) window.clearTimeout(finishTimerRef.current)
    finishTimerRef.current = null
    finishHoldRef.current = false
    setFinishHold(false)
    setDisplayPhase(phase)
  }, [armFinishHold, phase])

  useEffect(() => {
    if (!finishHoldRef.current) return
    if (gameState?.isGamePaused) {
      if (finishTimerRef.current !== null) {
        finishRemainingRef.current = Math.max(0, finishDeadlineRef.current - performance.now())
        window.clearTimeout(finishTimerRef.current)
        finishTimerRef.current = null
      }
      return
    }
    if (finishTimerRef.current === null) armFinishHold(finishRemainingRef.current)
  }, [armFinishHold, gameState?.isGamePaused])

  useEffect(() => () => {
    if (finishTimerRef.current !== null) window.clearTimeout(finishTimerRef.current)
  }, [])

  useEffect(() => {
    const layer = gameLayerRef.current
    if (!layer) return
    if (gameState?.isGamePaused) {
      pausedAnimationsRef.current = layer
        .getAnimations({ subtree: true })
        .filter((animation) => animation.playState === 'running')
      pausedAnimationsRef.current.forEach((animation) => animation.pause())
      return
    }
    pausedAnimationsRef.current.forEach((animation) => {
      if (animation.playState === 'paused') animation.play()
    })
    pausedAnimationsRef.current = []
  }, [gameState?.isGamePaused])

  // Hidden dev shortcuts: S = force race start, R = reset
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (gamePausedRef.current) return
      if (e.key === 's') startRace()
      if (e.key === 'r') resetRace()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [startRace, resetRace])

  if (!gameState || !displayPhase) {
    return (
      <div className="flex h-full items-center justify-center bg-derby-night">
        <div className="text-center">
          <div className="text-engraved font-display text-6xl animate-flicker">L&apos;APÉRODROME</div>
          <div className="mt-4 font-terminal text-2xl text-derby-smoke animate-pulse-soft">
            {connected ? 'Chargement de l’hippodrome...' : 'Connexion au serveur...'}
          </div>
        </div>
      </div>
    )
  }

  const showRace = displayPhase === 'RACING' || finishHold

  return (
    <div className="relative h-full">
      <div ref={gameLayerRef} data-game-frozen={gameState.isGamePaused ? 'true' : 'false'} className="h-full">
        {/*
          Phase screens must swap atomically. AnimatePresence with mode="wait"
          first removed the race screen, then waited for its exit animation
          before mounting results. If that animation was interrupted by the
          browser, the TV could remain on the bare black app background until
          a reload. The photo-finish already provides the visual transition,
          so keeping an empty interstitial frame brings no value here.
        */}
        <div key={showRace ? 'RACING' : displayPhase} data-tv-phase={showRace ? 'RACING' : displayPhase} className="h-full">
          {showRace ? (
            <RaceScreen
              state={gameState}
              activeEvent={activeEvent}
              eventResolution={eventResolution}
              finished={finishHold}
            />
          ) : displayPhase === 'BETTING' ? (
            <BettingScreen state={gameState} />
          ) : displayPhase === 'RESULTS' ? (
            <ResultsScreen state={gameState} />
          ) : (
            <IdleScreen state={gameState} />
          )}
        </div>
      </div>

      <ExperienceControls
        state={gameState}
        activeEventId={activeEvent?.id ?? null}
        showReset={!showRace}
        onResetSession={resetSession}
        onRulesOpen={() => setRulesOpen(true)}
      />

      {!connected && (
        <div className="absolute inset-x-0 top-0 z-50 bg-derby-red py-1 text-center font-headline tracking-[0.3em] text-derby-cream">
          CONNEXION AU SERVEUR PERDUE — RECONNEXION...
        </div>
      )}

      <RulebookViewer open={gameState.isRulesOpen} onClose={() => setRulesOpen(false)} />
    </div>
  )
}
