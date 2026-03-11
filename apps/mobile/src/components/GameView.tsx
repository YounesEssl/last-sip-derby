'use client'

import type { GameState, Player } from '@last-sip-derby/shared'
import { HorseSelector } from './HorseSelector'
import { DrinkNotification } from './DrinkNotification'
import { TapBoost } from './TapBoost'
import { PlayerStats } from './PlayerStats'

interface GameViewProps {
  gameState: GameState | null
  player: Player
  drinkNotification: { sips: number; reason: string } | null
  boostWindow: { horseId: string; durationMs: number } | null
  onBet: (horseId: string, amount: number) => void
  onConfirmDrink: () => void
  onTapBoost: (horseId: string) => void
  noSleepEnabled: boolean
}

export function GameView({
  gameState,
  player,
  drinkNotification,
  boostWindow,
  onBet,
  onConfirmDrink,
  onTapBoost,
  noSleepEnabled,
}: GameViewProps) {
  if (!gameState) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-gray-400 animate-pulse">Chargement...</p>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col relative">
      {/* NoSleep warning */}
      {!noSleepEnabled && (
        <div className="bg-derby-red/80 px-3 py-1 text-center text-xs">
          Touche l'ecran pour garder ton telephone allume
        </div>
      )}

      {/* Drink notification overlay */}
      {drinkNotification && (
        <DrinkNotification
          sips={drinkNotification.sips}
          reason={drinkNotification.reason}
          onConfirm={onConfirmDrink}
        />
      )}

      {/* Boost overlay */}
      {boostWindow && (
        <TapBoost
          horseId={boostWindow.horseId}
          durationMs={boostWindow.durationMs}
          horseName={gameState.horses.find((h) => h.id === boostWindow.horseId)?.name ?? ''}
          onTap={onTapBoost}
        />
      )}

      {/* Header */}
      <div className="bg-derby-dark px-4 py-3 border-b border-gray-800 flex items-center justify-between">
        <div>
          <span className="text-derby-gold font-display text-lg">{player.pseudo}</span>
          {player.debt > 0 && (
            <span className="ml-2 bg-derby-red text-white text-xs px-2 py-0.5 rounded-full font-bold">
              {player.debt}G dette
            </span>
          )}
        </div>
        <div className="text-right">
          <span className="text-xs text-gray-400 uppercase font-display tracking-wider">
            {gameState.phase === 'BETTING' && 'Paris ouverts'}
            {gameState.phase === 'RACING' && 'Course en cours'}
            {gameState.phase === 'RESULTS' && 'Resultats'}
            {gameState.phase === 'IDLE' && 'En attente'}
          </span>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto">
        {gameState.phase === 'BETTING' && (
          <HorseSelector
            horses={gameState.horses}
            currentBet={player.currentBet}
            onBet={onBet}
          />
        )}

        {gameState.phase === 'RACING' && (
          <RacingView gameState={gameState} player={player} />
        )}

        {gameState.phase === 'RESULTS' && (
          <ResultsView gameState={gameState} player={player} />
        )}

        {gameState.phase === 'IDLE' && (
          <div className="flex items-center justify-center h-full p-6">
            <p className="text-gray-400 text-center text-lg">
              Prochaine course bientot...
            </p>
          </div>
        )}
      </div>

      {/* Bottom stats */}
      <PlayerStats player={player} />
    </div>
  )
}

function RacingView({ gameState, player }: { gameState: GameState; player: Player }) {
  const myHorse = gameState.horses.find((h) => h.id === player.currentBet?.horseId)
  const sorted = [...gameState.horses].sort((a, b) => b.position - a.position)
  const myPosition = myHorse ? sorted.findIndex((h) => h.id === myHorse.id) + 1 : null

  return (
    <div className="p-4 space-y-4">
      {myHorse ? (
        <div className="bg-derby-dark rounded-xl p-4 border border-derby-gold/30 text-center">
          <p className="text-gray-400 text-sm">Ton cheval</p>
          <p className="font-display text-3xl text-white">{myHorse.name}</p>
          <p className="font-display text-5xl text-derby-gold mt-2">
            {myPosition ? `${myPosition}${myPosition === 1 ? 'er' : 'e'}` : '-'}
          </p>
          <div className="mt-3 bg-gray-800 rounded-full h-3 overflow-hidden">
            <div
              className="h-full bg-derby-gold transition-all duration-100"
              style={{ width: `${myHorse.position}%` }}
            />
          </div>
        </div>
      ) : (
        <div className="bg-derby-dark rounded-xl p-4 border border-gray-800 text-center">
          <p className="text-gray-400">Pas de pari en cours</p>
        </div>
      )}

      {/* All horses ranking */}
      <div className="space-y-1">
        {sorted.map((horse, i) => (
          <div
            key={horse.id}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
              horse.id === myHorse?.id ? 'bg-derby-gold/10 border border-derby-gold/30' : 'bg-derby-dark'
            }`}
          >
            <span className="text-gray-500 w-5 font-mono text-sm">{i + 1}.</span>
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: horse.color }} />
            <span className="flex-1 text-sm truncate">{horse.name}</span>
            <span className="text-xs text-gray-500">{Math.round(horse.position)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function ResultsView({ gameState, player }: { gameState: GameState; player: Player }) {
  const winner = gameState.lastRaceWinner
  const didWin = winner && winner.pseudo === player.pseudo

  return (
    <div className="p-4 flex flex-col items-center justify-center min-h-[60vh]">
      {didWin ? (
        <div className="text-center">
          <div className="text-6xl mb-4">🏆</div>
          <p className="font-display text-4xl text-derby-gold mb-2">TU AS GAGNE !</p>
          <p className="text-xl text-white">
            Distribue <span className="text-derby-gold font-bold">{winner.sipsToDistribute}G</span>
          </p>
        </div>
      ) : winner ? (
        <div className="text-center">
          <div className="text-4xl mb-4">😵</div>
          <p className="font-display text-3xl text-gray-300 mb-2">Perdu !</p>
          {player.debt > 0 && (
            <p className="text-derby-red text-lg">
              Tu dois boire {player.debt}G
            </p>
          )}
          <p className="text-gray-500 mt-4">
            {winner.pseudo} a gagne sur {winner.horseName}
          </p>
        </div>
      ) : (
        <p className="text-gray-400">Resultats en cours...</p>
      )}
    </div>
  )
}
