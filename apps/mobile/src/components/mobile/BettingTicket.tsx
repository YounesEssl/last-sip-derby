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
    <div className="flex flex-col h-full bg-pmu-paper text-pmu-dark font-mono p-4">
      {/* HEADER */}
      <div className="border-b-4 border-pmu-dark pb-4 mb-6 text-center">
        <h2 className="text-4xl font-display font-bold uppercase tracking-wider">
          TICKET DE PARI
        </h2>
        <p className="text-xl mt-1">COURSE N°{gameState.raceNumber}</p>
      </div>

      {hasBet ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <div className="stamped text-5xl font-display mb-8 p-4">
            PARI VALIDÉ
          </div>
          <p className="text-3xl font-bold mb-2">CHEVAL CHOISI :</p>
          <div className="w-24 h-24 bg-pmu-dark text-white rounded-full flex flex-col items-center justify-center mb-8">
            <span className="text-5xl font-display">
              {gameState.horses.find(h => h.id === player.currentBet?.horseId)?.lane}
            </span>
          </div>
          <p className="text-2xl animate-pulse">ATTENTE DU DÉPART...</p>
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <p className="text-2xl font-bold mb-6 text-center uppercase">CHOISISSEZ VOTRE MONTURE :</p>
          <div className="flex flex-col gap-4">
            {gameState.horses.map((horse) => (
              <button
                key={horse.id}
                onClick={() => onBet({ horseId: horse.id, amount: 1 })}
                className="flex items-center bg-white border-4 border-pmu-dark p-4 active:bg-pmu-dark active:text-white transition-colors"
                style={{ boxShadow: '4px 4px 0px #0f0a07' }}
              >
                <div className="w-16 h-16 bg-pmu-dark text-white flex items-center justify-center font-display text-4xl mr-6">
                  {horse.lane}
                </div>
                <div className="text-left flex-1">
                  <h3 className="text-3xl font-bold uppercase">{horse.name}</h3>
                  <p className="text-xl">{horse.odds} GORGÉE{horse.odds > 1 ? 'S' : ''}</p>
                </div>
                <div className="text-right border-l-2 border-pmu-dark pl-4">
                  <span className="font-display text-4xl">PARIER</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* FOOTER */}
      <div className="mt-8 text-center text-sm border-t-2 border-dashed border-pmu-dark pt-4">
        <p>CONSERVEZ CE TICKET - PMU OFFICIEL</p>
      </div>
    </div>
  )
}
