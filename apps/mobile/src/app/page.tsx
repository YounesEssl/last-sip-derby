'use client'

import { useState } from 'react'
import { PseudoForm } from '@/components/PseudoForm'
import { GameView } from '@/components/GameView'
import { usePlayerSocket } from '@/hooks/usePlayerSocket'
import { useNoSleep } from '@/hooks/useNoSleep'

export default function MobilePage() {
  const {
    gameState,
    player,
    connected,
    drinkNotification,
    boostWindow,
    pseudo,
    join,
    placeBet,
    confirmDrink,
    tapBoost,
  } = usePlayerSocket()

  const noSleepEnabled = useNoSleep()

  if (!connected) {
    return (
      <div className="flex h-screen items-center justify-center p-6">
        <div className="text-center">
          <h1 className="font-display text-4xl text-derby-gold mb-4">LAST SIP DERBY</h1>
          <p className="text-gray-400 animate-pulse">Connexion...</p>
        </div>
      </div>
    )
  }

  if (!pseudo || !player) {
    return <PseudoForm onJoin={join} />
  }

  return (
    <GameView
      gameState={gameState}
      player={player}
      drinkNotification={drinkNotification}
      boostWindow={boostWindow}
      onBet={placeBet}
      onConfirmDrink={confirmDrink}
      onTapBoost={tapBoost}
      noSleepEnabled={noSleepEnabled}
    />
  )
}
