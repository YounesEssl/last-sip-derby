'use client'

import { useEffect, useRef, useState } from 'react'
import { usePlayerSocket } from '@/hooks/usePlayerSocket'
import { useNoSleep } from '@/hooks/useNoSleep'
import { JoinScreen } from '@/components/screens/JoinScreen'
import { LobbyScreen } from '@/components/screens/LobbyScreen'
import { BetScreen } from '@/components/screens/BetScreen'
import { RaceScreen } from '@/components/screens/RaceScreen'
import { ResultScreen } from '@/components/screens/ResultScreen'
import { DrinkOverlay, VoteOverlay } from '@/components/Overlays'
import { MiniGameOverlay } from '@/components/MiniGameOverlay'
import { setGameFeedbackPaused } from '@/components/mini-games/feedback'

export default function MobilePage() {
  const {
    gameState,
    player,
    connected,
    drinkNotification,
    voteRequest,
    eliminationNotice,
    pseudo,
    join,
    placeBet,
    confirmDrink,
    vote,
    distributeSips,
    miniGameAction,
    blackKnightKill,
  } = usePlayerSocket()
  const gameLayerRef = useRef<HTMLDivElement>(null)
  const pausedAnimationsRef = useRef<Animation[]>([])
  useNoSleep()

  useEffect(() => {
    setGameFeedbackPaused(gameState?.isGamePaused ?? false)
    if (gameState?.isGamePaused && navigator.vibrate) navigator.vibrate(0)
  }, [gameState?.isGamePaused])

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

  // The server drops everyone at the end of RESULTS — quietly re-enter with
  // the saved pseudo whenever we're missing from the roster (any phase:
  // mid-race rejoiners become voters for the next incident).
  const lastRejoinKeyRef = useRef('')
  useEffect(() => {
    if (!gameState || !pseudo) return
    const amIn = gameState.players.some((p) => p.pseudo === pseudo)
    const key = `${gameState.phase}-${gameState.raceNumber}-${gameState.isGamePaused ? 'paused' : 'running'}`
    if (!amIn && lastRejoinKeyRef.current !== key) {
      lastRejoinKeyRef.current = key
      join(pseudo)
    }
  }, [gameState, pseudo, join])

  const bet = (horseId: string) => {
    const horse = gameState?.horses.find((h) => h.id === horseId)
    if (!horse) return
    placeBet({ horseId, amount: horse.odds })
    if (navigator.vibrate) navigator.vibrate(60)
  }

  // The winner keeps the distribution panel through IDLE until the tournée
  // is sent (the server accepts it until the next betting opens).
  const [tourneeSentRace, setTourneeSentRace] = useState<number | null>(null)
  const distribute = (allocations: { pseudo: string; sips: number }[]) => {
    distributeSips(allocations)
    setTourneeSentRace(gameState?.raceNumber ?? null)
  }
  const isUnsentWinner =
    !!gameState &&
    !!pseudo &&
    gameState.lastRaceWinner?.pseudo === pseudo &&
    tourneeSentRace !== gameState.raceNumber

  let screen: React.ReactNode
  if (!pseudo || !gameState) {
    screen = <JoinScreen onJoin={join} connected={connected} />
  } else {
    switch (gameState.phase) {
      case 'BETTING':
        screen = <BetScreen state={gameState} player={player} onBet={bet} />
        break
      case 'RACING':
        screen = <RaceScreen state={gameState} player={player} onBlackKnightKill={blackKnightKill} />
        break
      case 'RESULTS':
        screen = <ResultScreen state={gameState} player={player} onDistribute={distribute} />
        break
      default:
        screen = isUnsentWinner ? (
          <ResultScreen state={gameState} player={player} onDistribute={distribute} />
        ) : (
          <LobbyScreen state={gameState} player={player} pseudo={pseudo} />
        )
    }
  }

  return (
    <div className="bg-hippodrome relative h-full overflow-hidden">
      <div
        ref={gameLayerRef}
        data-game-frozen={gameState?.isGamePaused ? 'true' : 'false'}
        aria-hidden={gameState?.isGamePaused || undefined}
        className={`h-full ${gameState?.isGamePaused ? 'pointer-events-none' : ''}`}
      >
        {screen}

        {gameState?.miniGame && player && gameState.miniGame.players.some((row) => row.playerId === player.id) && (
          <MiniGameOverlay
            game={gameState.miniGame}
            playerId={player.id}
            paused={gameState.isGamePaused}
            serverNow={gameState.serverNow}
            onAction={miniGameAction}
          />
        )}

        {voteRequest && !voteRequest.resolved && (
          <VoteOverlay
            event={voteRequest}
            players={gameState?.players ?? []}
            paused={gameState?.isGamePaused ?? false}
            serverNow={gameState?.serverNow}
            onVote={(v) => vote(voteRequest.id, v)}
          />
        )}
        {drinkNotification && (
          <DrinkOverlay
            sips={drinkNotification.sips}
            reason={drinkNotification.reason}
            deadline={drinkNotification.deadline}
            paused={gameState?.isGamePaused ?? false}
            serverNow={gameState?.serverNow}
            onConfirm={confirmDrink}
          />
        )}

        {eliminationNotice && (
          <div className="pointer-events-none fixed inset-x-4 top-20 z-[80] rounded-2xl border-4 border-derby-red bg-black/95 px-5 py-5 text-center shadow-2xl">
            <div className="font-display text-4xl text-derby-red">ÉLIMINÉ(E)</div>
            <div className="mt-2 font-body text-lg text-derby-cream">{eliminationNotice}</div>
          </div>
        )}

        {!connected && pseudo && (
          <div className="absolute inset-x-0 top-0 z-[60] bg-derby-red py-1 text-center font-headline text-sm tracking-[0.25em] text-derby-cream">
            RECONNEXION EN COURS...
          </div>
        )}
      </div>

      {gameState?.isGamePaused && <GamePauseOverlay />}
    </div>
  )
}

function GamePauseOverlay() {
  return (
    <div
      data-testid="game-pause-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Partie en pause"
      className="fixed inset-0 z-[200] flex items-center justify-center bg-derby-night/95 px-7 text-center backdrop-blur-md"
    >
      <div className="w-full max-w-sm rounded-2xl border-2 border-derby-gold bg-derby-ink px-6 py-8 shadow-2xl">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full border-2 border-derby-gold font-display text-4xl text-derby-gold">Ⅱ</div>
        <h1 className="font-display text-4xl leading-none text-derby-cream">PARTIE EN PAUSE</h1>
        <p className="mt-4 font-body text-lg leading-relaxed text-derby-cream/85">
          Les règles du jeu sont en cours de consultation sur la TV.
        </p>
        <div className="mt-6 font-headline text-sm tracking-[0.24em] text-derby-gold">REPRISE AUTOMATIQUE</div>
      </div>
    </div>
  )
}
