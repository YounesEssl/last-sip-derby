'use client'

import { SlipForm } from '@/components/mobile/SlipForm'
import { BettingTicket } from '@/components/mobile/BettingTicket'
import { RaceRemote } from '@/components/mobile/RaceRemote'
import { DrinkAlert } from '@/components/mobile/DrinkAlert'
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

  // Keeps the screen awake during the game
  useNoSleep()

  if (!connected) {
    return (
      <div className="flex flex-col h-screen items-center justify-center p-6 bg-pmu-paper relative">
        <div className="paper-texture"></div>
        <h1 className="font-display text-7xl text-pmu-alert mb-4 drop-shadow-md transform -rotate-2">DERBY PMU</h1>
        <p className="font-mono text-2xl animate-pulse text-pmu-dark font-bold font-terminal uppercase border-4 border-pmu-dark p-2 text-center mt-6">
          Recherche terminal...
        </p>
      </div>
    )
  }

  if (!pseudo || !player) {
    return <SlipForm onJoin={join} />
  }

  if (!gameState) {
    return (
      <div className="flex flex-col h-screen items-center justify-center p-6 bg-pmu-paper relative">
        <div className="paper-texture"></div>
        <p className="font-mono text-2xl animate-pulse text-pmu-dark font-bold font-terminal uppercase border-4 border-pmu-dark p-2 text-center mt-6">
          Synchronisation...
        </p>
      </div>
    )
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-pmu-paper text-pmu-dark relative flex flex-col">
      {/* HUD HEADER */}
      <div className="bg-[#0f0a07] text-white p-4 font-mono shadow-[0_4px_10px_rgba(0,0,0,0.5)] z-20">
        <div className="flex justify-between items-center text-xl">
          <span className="font-bold uppercase text-pmu-board">{player.pseudo}</span>
          <span className="text-pmu-amber font-terminal">SIPS: {player.totalSipsDrunk} BU | {player.totalSipsGiven} DISTRIBUÉS</span>
        </div>
      </div>

      {/* DYNAMIC VIEW */}
      <div className="flex-1 overflow-hidden relative">
        {(gameState.phase === 'BETTING' || gameState.phase === 'IDLE') && (
          <BettingTicket gameState={gameState} player={player} onBet={placeBet} />
        )}
        
        {gameState.phase === 'RACING' && (
          <RaceRemote 
            boostWindow={boostWindow} 
            onTapBoost={() => {
              if (boostWindow) tapBoost(boostWindow.horseId)
            }}
            horseLane={gameState.horses.find(h => h.id === player.currentBet?.horseId)?.lane}
          />
        )}

        {gameState.phase === 'RESULTS' && (
          <div className="flex-1 flex flex-col items-center justify-center h-full bg-[#1c1613] text-white p-6 text-center font-mono relative overflow-hidden">
            <div className="absolute inset-0 scanlines pointer-events-none"></div>
             <h2 className="text-6xl font-display text-pmu-board mb-6 tracking-widest led-glow transform rotate-2">COURSE TERMINÉE</h2>
             <div className="bg-black border-4 border-pmu-amber p-6 rounded relative z-10 w-full max-w-sm">
               <p className="text-3xl mb-4 font-terminal text-pmu-amber">REGARDE L'ÉCRAN PRINCIPAL</p>
               <p className="text-2xl text-pmu-alert font-bold uppercase animate-pulse">POUR VOIR QUI BOIT !</p>
             </div>
          </div>
        )}
      </div>

      <DrinkAlert notification={drinkNotification} onConfirm={confirmDrink} />
    </div>
  )
}
