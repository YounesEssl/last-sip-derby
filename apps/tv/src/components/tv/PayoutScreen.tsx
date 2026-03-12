import { GameState } from '@last-sip-derby/shared'

export const PayoutScreen = ({ gameState }: { gameState: GameState }) => {
  const winner = gameState.lastRaceWinner

  return (
    <div className="flex flex-col w-full h-full text-pmu-board font-terminal p-12 bg-[#0f0a07] border-4 border-[#39FF14] rounded-xl shadow-[inset_0_0_100px_rgba(0,0,0,0.9)]">
      
      {/* HEADER */}
      <div className="text-center border-b-8 border-pmu-board pb-8 mb-12 border-dashed">
        <h2 className="text-8xl led-glow mb-4">RACE OVER</h2>
        {winner ? (
          <p className="text-5xl text-pmu-amber led-glow-amber leading-relaxed">
            WINNER: <span className="font-bold text-white">{winner.horseName}</span>
          </p>
        ) : (
          <p className="text-5xl text-pmu-alert led-glow">
            NO WINNER DETECTED
          </p>
        )}
      </div>

      <div className="flex-1 overflow-auto">
        {/* DRINK DEBT LIST */}
        <h3 className="text-5xl text-white mb-8 border-l-8 border-pmu-alert pl-6 bg-pmu-alert/20 py-4">OUTSTANDING DRINK DEBTS</h3>
        <div className="grid grid-cols-2 gap-x-16 gap-y-6">
          {gameState.players.map((player) => (
            <div key={player.id} className="flex justify-between items-center text-4xl border-b-2 border-pmu-board/30 pb-4">
              <span className={`uppercase ${player.debt > 0 ? 'text-pmu-alert' : 'text-pmu-board'} font-bold`}>
                {player.pseudo}
              </span>
              <div className="flex gap-4">
                <span className="text-pmu-amber">BET: {player.currentBet?.amount || 0}</span>
                <span className="text-white">|</span>
                <span className={player.debt > 0 ? 'text-pmu-alert animate-pulse' : 'text-pmu-board'}>
                  DEALS: {player.debt}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* WINNER SPOTLIGHT */}
        {winner && winner.sipsToDistribute > 0 && (
          <div className="mt-16 bg-[#39FF14] text-black p-8 text-center border-8 border-pmu-amber">
            <h4 className="text-6xl font-display font-bold mb-4 uppercase">{winner.pseudo} WINS THE POT</h4>
            <p className="text-5xl font-mono">DISTRIBUTES {winner.sipsToDistribute} SIPS</p>
          </div>
        )}
      </div>

    </div>
  )
}
