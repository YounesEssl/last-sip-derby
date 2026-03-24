'use client'

import { GameState, HORSE_COLORS } from '@last-sip-derby/shared'
import { useCountdown } from '@/hooks/useCountdown'

export const BettingBoard = ({ gameState }: { gameState: GameState }) => {
  const timeLeft = useCountdown(gameState.phaseStartedAt, gameState.phaseDuration)
  const connectedPlayers = gameState.players.filter((p) => p.isConnected)

  return (
    <div className="relative w-full h-full flex flex-col overflow-hidden"
      style={{ background: 'radial-gradient(ellipse at 50% 20%, #1a2e1a 0%, #0a0f0a 70%, #000 100%)' }}
    >
      {/* Subtle grid */}
      <div className="absolute inset-0 opacity-[0.03]"
        style={{ backgroundImage: 'linear-gradient(rgba(123,198,126,1) 1px, transparent 1px), linear-gradient(90deg, rgba(123,198,126,1) 1px, transparent 1px)', backgroundSize: '60px 60px' }}
      />

      {/* Header */}
      <div className="relative z-10 flex justify-between items-center px-12 pt-8 pb-6">
        <div>
          <h1 className="font-rye text-5xl" style={{ color: '#D4A843', textShadow: '0 0 20px rgba(212,168,67,0.2)' }}>
            Course N.{gameState.raceNumber}
          </h1>
          <p className="font-mono text-lg text-white/30 mt-1 tracking-widest uppercase">
            Placez vos paris
          </p>
        </div>
        <div className="text-center px-8 py-4 rounded-xl"
          style={{ background: 'rgba(212,168,67,0.08)', border: '2px solid rgba(212,168,67,0.25)' }}
        >
          <p className="font-mono text-sm text-white/40 uppercase tracking-widest">Depart dans</p>
          <p className="font-rye text-6xl mt-1" style={{ color: timeLeft <= 10 ? '#E63946' : '#D4A843' }}>
            {timeLeft}s
          </p>
        </div>
      </div>

      {/* Separator */}
      <div className="relative z-10 mx-12 h-[1px] opacity-30" style={{ background: 'linear-gradient(90deg, transparent, #D4A843, transparent)' }} />

      {/* Horse list */}
      <div className="relative z-10 flex-1 px-12 py-6 flex flex-col gap-4">
        {gameState.horses.map((horse, i) => {
          const betsOnHorse = connectedPlayers.filter((p) => p.currentBet?.horseId === horse.id)
          const color = HORSE_COLORS[horse.lane % HORSE_COLORS.length]

          return (
            <div
              key={horse.id}
              className="flex items-center gap-6 px-6 py-4 rounded-xl transition-all"
              style={{
                background: betsOnHorse.length > 0 ? 'rgba(123,198,126,0.06)' : 'rgba(255,255,255,0.02)',
                border: `1px solid ${betsOnHorse.length > 0 ? 'rgba(123,198,126,0.2)' : 'rgba(255,255,255,0.06)'}`,
              }}
            >
              {/* Lane badge */}
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center font-mono text-lg font-bold text-white shrink-0"
                style={{ backgroundColor: color, boxShadow: `0 0 12px ${color}40` }}
              >
                {horse.lane + 1}
              </div>

              {/* Name */}
              <div className="flex-1 min-w-0">
                <h3 className="font-rye text-2xl text-white truncate">{horse.name}</h3>
                {/* Bettors */}
                {betsOnHorse.length > 0 && (
                  <div className="flex gap-2 mt-1 flex-wrap">
                    {betsOnHorse.map((p) => (
                      <span key={p.id} className="font-mono text-xs px-2 py-0.5 rounded-full text-white/60"
                        style={{ background: 'rgba(123,198,126,0.15)' }}
                      >
                        {p.pseudo}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Sips odds */}
              <div className="text-right shrink-0">
                <span className="font-rye text-4xl" style={{ color: '#D4A843' }}>
                  {horse.odds}G
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div className="relative z-10 px-12 pb-6 flex justify-between items-center">
        <p className="font-mono text-sm text-white/20">
          {connectedPlayers.length} joueur{connectedPlayers.length > 1 ? 's' : ''} connecte{connectedPlayers.length > 1 ? 's' : ''}
        </p>
        <p className="font-mono text-sm animate-pulse" style={{ color: '#7BC67E' }}>
          SCANNEZ LE QR POUR REJOINDRE
        </p>
      </div>
    </div>
  )
}
