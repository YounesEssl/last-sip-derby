'use client'

import { SlipForm } from '@/components/mobile/SlipForm'
import { BettingTicket } from '@/components/mobile/BettingTicket'
import { RaceRemote } from '@/components/mobile/RaceRemote'
import { DrinkAlert } from '@/components/mobile/DrinkAlert'
import { EventVote } from '@/components/mobile/EventVote'
import { usePlayerSocket } from '@/hooks/usePlayerSocket'
import { useNoSleep } from '@/hooks/useNoSleep'

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
  } = usePlayerSocket()

  useNoSleep()

  if (!connected) {
    return (
      <div className="flex flex-col h-screen items-center justify-center p-6 bg-pmu-paper relative">
        <div className="paper-texture"></div>
        <h1 className="font-display text-4xl text-pmu-alert mb-4 drop-shadow-md transform -rotate-2">DERBY PMU</h1>
        <p className="font-mono text-lg animate-pulse text-pmu-dark font-bold font-terminal uppercase border-4 border-pmu-dark p-2 text-center mt-6">
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
        <p className="font-mono text-lg animate-pulse text-pmu-dark font-bold font-terminal uppercase border-4 border-pmu-dark p-2 text-center mt-6">
          Synchronisation...
        </p>
      </div>
    )
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-pmu-paper text-pmu-dark relative flex flex-col">
      {/* HUD HEADER */}
      <div className="bg-[#0f0a07] text-white px-3 py-2 font-mono shadow-[0_4px_10px_rgba(0,0,0,0.5)] z-20">
        <div className="flex justify-between items-center text-sm">
          <span className="font-bold uppercase text-pmu-board truncate mr-2">{player.pseudo}</span>
          <span className="text-pmu-amber font-terminal shrink-0">{player.totalSipsDrunk}BU | {player.totalSipsGiven}DIST</span>
        </div>
      </div>

      {/* DYNAMIC VIEW */}
      <div className="flex-1 overflow-hidden relative">
        {/* IDLE: rejoin or waiting room */}
        {gameState.phase === 'IDLE' && (
          <div className="flex-1 flex flex-col items-center justify-center h-full bg-pmu-paper relative p-6 text-center">
            <div className="paper-texture"></div>
            {!gameState.players.some((p) => p.pseudo === pseudo) ? (
              <>
                <h2 className="font-display text-3xl text-pmu-dark mb-4">PROCHAINE COURSE</h2>
                <button
                  onClick={() => join(pseudo)}
                  className="px-8 py-4 bg-pmu-dark text-white font-display text-2xl uppercase tracking-wider active:scale-95 transition-transform"
                  style={{ boxShadow: '4px 4px 0px #3a2a1a' }}
                >
                  REJOINDRE
                </button>
                <p className="font-mono text-base text-pmu-dark/40 mt-4">{pseudo}</p>
              </>
            ) : (
              <>
                <h2 className="font-display text-2xl text-pmu-dark mb-4">SALLE D'ATTENTE</h2>
                <div className="w-full max-w-xs flex flex-col gap-2 mb-6">
                  {gameState.players.filter((p) => p.isConnected).map((p) => (
                    <div key={p.pseudo} className="flex items-center gap-2 bg-pmu-dark/10 px-3 py-2 border-2 border-pmu-dark/20">
                      <span className="text-pmu-dark font-bold">&#9658;</span>
                      <span className="font-terminal text-base text-pmu-dark uppercase">{p.pseudo}</span>
                      {p.pseudo === pseudo && <span className="font-mono text-xs text-pmu-dark/40 ml-auto">(toi)</span>}
                    </div>
                  ))}
                </div>
                <p className="font-mono text-base text-pmu-dark/40 animate-pulse">EN ATTENTE DES AUTRES...</p>
              </>
            )}
          </div>
        )}

        {/* BETTING: horse selection */}
        {gameState.phase === 'BETTING' && (
          <BettingTicket gameState={gameState} player={player} onBet={placeBet} />
        )}

        {gameState.phase === 'RACING' && (() => {
          const betHorse = player.currentBet ? gameState.horses.find(h => h.id === player.currentBet?.horseId) : null
          const isEliminated = betHorse?.isEliminated

          if (voteRequest) {
            return <EventVote event={voteRequest} onVote={vote} />
          }

          if (isEliminated) {
            return (
              <div className="flex flex-col items-center justify-center h-full p-6 text-center" style={{ background: '#2e0a0a' }}>
                <h2 className="text-2xl font-display text-red-400 mb-3">CHEVAL ÉLIMINÉ</h2>
                <p className="text-base font-mono text-white/70 mb-4">
                  {betHorse?.name} n'a pas réussi à repartir...
                </p>
                <div className="bg-red-900/50 border-4 border-red-400 px-6 py-4 rounded-xl mb-4">
                  <p className="text-base font-mono text-red-300 mb-1">Tu bois</p>
                  <p className="text-5xl font-display text-red-400">{betHorse?.odds}G</p>
                </div>
                <p className="text-sm font-mono text-white/30 animate-pulse">REGARDE L'ECRAN...</p>
              </div>
            )
          }

          return <RaceRemote horseName={betHorse?.name} />
        })()}

        {gameState.phase === 'RESULTS' && (() => {
          const myBet = player.currentBet
          const winnerInfo = gameState.lastRaceWinner
          const didWin = myBet && winnerInfo && gameState.horses.find(h => h.id === myBet.horseId)?.name === winnerInfo.horseName
          const betHorse = myBet ? gameState.horses.find(h => h.id === myBet.horseId) : null

          return (
            <div className="flex-1 flex flex-col items-center justify-center h-full p-6 text-center relative overflow-hidden"
              style={{ background: didWin ? '#0a2e0a' : '#2e0a0a' }}
            >
              {didWin ? (
                <>
                  <h2 className="text-3xl font-display text-green-400 mb-3">TU AS GAGNE !</h2>
                  <p className="text-base font-mono text-white/70 mb-4">{betHorse?.name} a gagne la course</p>
                  <div className="bg-green-900/50 border-4 border-green-400 px-6 py-4 rounded-xl">
                    <p className="text-base font-mono text-green-300 mb-1">Tu distribues</p>
                    <p className="text-5xl font-display text-green-400">{winnerInfo?.sipsToDistribute}G</p>
                  </div>
                </>
              ) : myBet ? (
                <>
                  <h2 className="text-3xl font-display text-red-400 mb-3">PERDU !</h2>
                  <p className="text-base font-mono text-white/70 mb-4">{betHorse?.name} n'a pas gagne</p>
                  <div className="bg-red-900/50 border-4 border-red-400 px-6 py-4 rounded-xl">
                    <p className="text-base font-mono text-red-300 mb-1">Tu bois</p>
                    <p className="text-5xl font-display text-red-400">{betHorse?.odds ?? myBet.amount}G</p>
                  </div>
                </>
              ) : (
                <>
                  <h2 className="text-2xl font-display text-white/50 mb-3">COURSE TERMINEE</h2>
                  <p className="text-base font-mono text-white/40">Tu n'as pas parie</p>
                </>
              )}
              {winnerInfo && (
                <p className="mt-6 text-sm font-mono text-white/40">
                  Gagnant : {winnerInfo.horseName} — {winnerInfo.pseudo}
                </p>
              )}
            </div>
          )
        })()}
      </div>

      <DrinkAlert notification={drinkNotification} />
    </div>
  )
}
