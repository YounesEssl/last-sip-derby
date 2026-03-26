import { GameState, Player } from '@last-sip-derby/shared'

interface Props {
  gameState: GameState
  player: Player
  onBet: (bet: { horseId: string; amount: number }) => void
}

export const BettingTicket = ({ gameState, player, onBet }: Props) => {
  const isBetting = gameState.phase === 'BETTING'
  
  if (!isBetting) return null

  const hasBet = !!player.currentBet

  return (
    <div className="flex flex-col h-full bg-pmu-paper text-pmu-dark font-mono p-3">
      {/* HEADER */}
      <div className="border-b-4 border-pmu-dark pb-2 mb-3 text-center">
        <h2 className="text-2xl font-display font-bold uppercase tracking-wider">
          TICKET DE PARI
        </h2>
        <p className="text-sm mt-1">COURSE N°{gameState.raceNumber}</p>
      </div>

      {hasBet ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <div className="stamped text-3xl font-display mb-6 p-3">
            PARI VALIDÉ
          </div>
          <p className="text-xl font-bold mb-3">CHEVAL CHOISI :</p>
          <p className="text-xl font-display text-pmu-alert uppercase mb-1">
            {gameState.horses.find(h => h.id === player.currentBet?.horseId)?.name}
          </p>
          <p className="text-base text-pmu-dark/60 mb-6">
            {gameState.horses.find(h => h.id === player.currentBet?.horseId)?.odds}G
          </p>
          <p className="text-lg animate-pulse">ATTENTE DU DEPART...</p>
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <p className="text-base font-bold mb-3 text-center uppercase">CHOISISSEZ VOTRE MONTURE :</p>
          <div className="flex flex-col gap-2">
            {gameState.horses.map((horse) => (
              <button
                key={horse.id}
                onClick={() => onBet({ horseId: horse.id, amount: 1 })}
                className="flex items-center bg-white border-3 border-pmu-dark p-3 active:bg-pmu-dark active:text-white transition-colors"
                style={{ boxShadow: '3px 3px 0px #0f0a07' }}
              >
                <div className="w-10 h-10 shrink-0 bg-pmu-dark text-white flex items-center justify-center font-display text-xl mr-3">
                  {horse.lane + 1}
                </div>
                <div className="text-left flex-1 min-w-0">
                  <h3 className="text-lg font-bold uppercase truncate">{horse.name}</h3>
                  <p className="text-sm">{horse.odds} GORGÉE{horse.odds > 1 ? 'S' : ''}</p>
                </div>
                <div className="text-right border-l-2 border-pmu-dark pl-3 shrink-0">
                  <span className="font-display text-xl">PARIER</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* FOOTER */}
      <div className="mt-4 text-center text-xs border-t-2 border-dashed border-pmu-dark pt-2">
        <p>CONSERVEZ CE TICKET - PMU OFFICIEL</p>
      </div>
    </div>
  )
}
