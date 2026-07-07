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

export default function MobilePage() {
  const {
    gameState,
    player,
    connected,
    drinkNotification,
    voteRequest,
    pseudo,
    join,
    placeBet,
    confirmDrink,
    vote,
    distributeSips,
  } = usePlayerSocket()
  useNoSleep()

  // The server drops everyone at the end of RESULTS — quietly re-enter with
  // the saved pseudo whenever we're missing from the roster (any phase:
  // mid-race rejoiners become voters for the next incident).
  const lastRejoinKeyRef = useRef('')
  useEffect(() => {
    if (!gameState || !pseudo) return
    const amIn = gameState.players.some((p) => p.pseudo === pseudo)
    const key = `${gameState.phase}-${gameState.raceNumber}`
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
        screen = <RaceScreen state={gameState} player={player} />
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
      {screen}

      {voteRequest && !voteRequest.resolved && (
        <VoteOverlay
          event={voteRequest}
          players={gameState?.players ?? []}
          onVote={(v) => vote(voteRequest.id, v)}
        />
      )}
      {drinkNotification && (
        <DrinkOverlay
          sips={drinkNotification.sips}
          reason={drinkNotification.reason}
          deadline={drinkNotification.deadline}
          onConfirm={confirmDrink}
        />
      )}

      {!connected && pseudo && (
        <div className="absolute inset-x-0 top-0 z-[60] bg-derby-red py-1 text-center font-headline text-sm tracking-[0.25em] text-derby-cream">
          RECONNEXION EN COURS...
        </div>
      )}
    </div>
  )
}
