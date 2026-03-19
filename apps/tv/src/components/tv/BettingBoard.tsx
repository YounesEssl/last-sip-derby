import { GameState } from '@last-sip-derby/shared'
import { useCountdown } from '@/hooks/useCountdown'

export const BettingBoard = ({ gameState }: { gameState: GameState }) => {
  const timeLeft = useCountdown(gameState.phaseStartedAt, gameState.phaseDuration)

  return (
    <div className="flex flex-col w-full h-full text-pmu-board font-terminal p-8 bg-black/40 border-4 border-pmu-wood rounded-xl shadow-2xl">
      
      {/* HEADER */}
      <div className="flex justify-between items-center border-b-4 border-pmu-board pb-6 mb-8">
        <div>
          <h2 className="text-6xl led-glow">DERBY NO. {gameState.raceNumber}</h2>
          <p className="text-3xl text-pmu-board/70 mt-2">PARIS OUVERTS / BETS OPEN</p>
        </div>
        <div className="text-center bg-pmu-board text-black px-6 py-4 rounded shadow-[0_0_15px_#39FF14]">
          <p className="text-3xl font-bold">DÉPART DANS / START IN</p>
          <p className="text-8xl mt-2">{Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}</p>
        </div>
      </div>

      {/* HORSE ODDS TABLE */}
      <div className="grid grid-cols-2 gap-x-12 gap-y-6 flex-1 content-start">
        {gameState.horses.map((horse) => {
          // Find how many players bet on this horse and total sips
          const betsOnHorse = gameState.players.filter(p => p.currentBet?.horseId === horse.id)
          const totalBet = betsOnHorse.reduce((sum, p) => sum + (p.currentBet?.amount || 0), 0)

          return (
            <div key={horse.id} className="flex justify-between items-center border-b-2 border-pmu-board/30 pb-4">
              <div className="flex items-center gap-6">
                <div className="w-16 h-16 bg-pmu-board text-black flex items-center justify-center text-5xl font-bold shadow-[0_0_10px_#39FF14]">
                  {horse.lane}
                </div>
                <div>
                  <h3 className="text-5xl text-white mb-2">{horse.name}</h3>
                  <p className="text-3xl text-pmu-amber led-glow-amber">
                    {betsOnHorse.length} JOUEURS / {totalBet} GORGÉES
                  </p>
                </div>
              </div>
              <div className="text-7xl text-pmu-amber led-glow-amber ml-4">
                {horse.odds}G
              </div>
            </div>
          )
        })}
      </div>

      {/* FOOTER */}
      <div className="mt-8 pt-6 border-t-4 border-pmu-board flex justify-between items-end text-3xl">
        <p className="animate-pulse">ATTENTE DES JOCKEYS...</p>
        <p>JOUEURS CONNECTÉS: {gameState.players.filter(p => p.isConnected).length}</p>
      </div>

    </div>
  )
}
