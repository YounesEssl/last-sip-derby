'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { GamePhase } from '@last-sip-derby/shared'
import { useGameSocket } from '@/hooks/useGameSocket'
import { IdleScreen } from '@/components/screens/IdleScreen'
import { BettingScreen } from '@/components/screens/BettingScreen'
import { RaceScreen } from '@/components/screens/RaceScreen'
import { ResultsScreen } from '@/components/screens/ResultsScreen'
import { ExperienceControls } from '@/components/ExperienceControls'

// After the winner crosses the line, hold the race view for the photo-finish
// celebration before cutting to the podium.
const FINISH_HOLD_MS = 5200

export default function TVPage() {
  const { gameState, activeEvent, eventResolution, connected, startRace, resetRace } = useGameSocket()
  const [displayPhase, setDisplayPhase] = useState<GamePhase | null>(null)
  const [finishHold, setFinishHold] = useState(false)
  const prevPhaseRef = useRef<GamePhase | null>(null)

  const phase = gameState?.phase ?? null

  useEffect(() => {
    if (!phase) return
    const prev = prevPhaseRef.current
    prevPhaseRef.current = phase

    if (prev === 'RACING' && phase === 'RESULTS') {
      setFinishHold(true)
      const t = setTimeout(() => {
        setFinishHold(false)
        setDisplayPhase('RESULTS')
      }, FINISH_HOLD_MS)
      return () => clearTimeout(t)
    }
    setDisplayPhase(phase)
  }, [phase])

  // Hidden dev shortcuts: S = force race start, R = reset
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
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
      <AnimatePresence mode="wait">
        <motion.div
          key={showRace ? 'RACING' : displayPhase}
          className="h-full"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.45 }}
        >
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
        </motion.div>
      </AnimatePresence>

      <ExperienceControls state={gameState} activeEventId={activeEvent?.id ?? null} />

      {!connected && (
        <div className="absolute inset-x-0 top-0 z-50 bg-derby-red py-1 text-center font-headline tracking-[0.3em] text-derby-cream">
          CONNEXION AU SERVEUR PERDUE — RECONNEXION...
        </div>
      )}
    </div>
  )
}
