'use client'

import { QRCodeSVG } from 'qrcode.react'
import { GameState, HORSE_COLORS } from '@last-sip-derby/shared'
import { useCountdown } from '@/hooks/useCountdown'

export const BettingBoard = ({ gameState }: { gameState: GameState }) => {
  const timeLeft = useCountdown(gameState.phaseStartedAt, gameState.phaseDuration)
  const connectedPlayers = gameState.players.filter((p) => p.isConnected)
  const joinUrl = typeof window !== 'undefined'
    ? (window.location.port === '3000'
      ? `${window.location.protocol}//${window.location.hostname}:3002`
      : `${window.location.origin}/play`)
    : ''

  return (
    <div className="relative w-full h-full flex flex-col overflow-hidden bg-pmu-paper">
      <div className="paper-texture"></div>

      {/* Header */}
      <div className="relative z-10 flex justify-between items-center px-12 pt-8 pb-6">
        <div>
          <h1 className="font-rye text-5xl text-pmu-dark">
            Course N.{gameState.raceNumber}
          </h1>
          <p className="font-body text-lg text-pmu-wood mt-1 tracking-widest uppercase font-bold">
            Placez vos paris
          </p>
        </div>
        <div className="flex items-center gap-6">
          {/* QR Code */}
          {joinUrl && (
            <div className="border-3 border-pmu-dark bg-white p-2" style={{ boxShadow: '3px 3px 0px #3a2a1a' }}>
              <QRCodeSVG value={joinUrl} size={120} bgColor="#ffffff" fgColor="#0f0a07" />
            </div>
          )}
          {/* Timer */}
          <div className="text-center px-8 py-4 border-4 border-pmu-dark bg-white/40"
            style={{ boxShadow: '4px 4px 0px #3a2a1a' }}
          >
            <p className="font-mono text-sm text-pmu-dark/50 uppercase tracking-widest">Depart dans</p>
            <p className="font-rye text-6xl mt-1" style={{ color: timeLeft <= 10 ? '#E83B3B' : '#0f0a07' }}>
              {timeLeft}s
            </p>
          </div>
        </div>
      </div>

      {/* Separator */}
      <div className="relative z-10 mx-12 h-[3px] bg-pmu-dark/15" />

      {/* Horse list */}
      <div className="relative z-10 flex-1 px-12 py-6 flex flex-col gap-4">
        {gameState.horses.map((horse, i) => {
          const betsOnHorse = connectedPlayers.filter((p) => p.currentBet?.horseId === horse.id)
          const color = HORSE_COLORS[horse.lane % HORSE_COLORS.length]

          return (
            <div
              key={horse.id}
              className="flex items-center gap-6 px-6 py-4 transition-all bg-white/40 border-3 border-pmu-dark/15"
              style={{
                borderColor: betsOnHorse.length > 0 ? 'rgba(74, 48, 24, 0.4)' : undefined,
                boxShadow: betsOnHorse.length > 0 ? '3px 3px 0px rgba(74, 48, 24, 0.15)' : undefined,
              }}
            >
              {/* Lane badge */}
              <div
                className="w-12 h-12 flex items-center justify-center font-mono text-lg font-bold text-white shrink-0 border-2 border-pmu-dark/20"
                style={{ backgroundColor: color }}
              >
                {horse.lane + 1}
              </div>

              {/* Name */}
              <div className="flex-1 min-w-0">
                <h3 className="font-rye text-2xl text-pmu-dark truncate">{horse.name}</h3>
                {/* Bettors */}
                {betsOnHorse.length > 0 && (
                  <div className="flex gap-2 mt-1 flex-wrap">
                    {betsOnHorse.map((p) => (
                      <span key={p.id} className="font-mono text-xs px-2 py-0.5 bg-pmu-dark/10 text-pmu-dark/60 border border-pmu-dark/10">
                        {p.pseudo}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Sips odds */}
              <div className="text-right shrink-0">
                <span className="font-rye text-4xl text-pmu-alert">
                  {horse.odds}G
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div className="relative z-10 px-12 pb-6 flex justify-between items-center">
        <p className="font-mono text-sm text-pmu-dark/30">
          {connectedPlayers.length} joueur{connectedPlayers.length > 1 ? 's' : ''} connecte{connectedPlayers.length > 1 ? 's' : ''}
        </p>
        <p className="font-mono text-sm animate-pulse text-pmu-wood font-bold uppercase">
          SCANNEZ LE QR POUR REJOINDRE
        </p>
      </div>
    </div>
  )
}
