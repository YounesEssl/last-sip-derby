'use client'

import { QRCodeSVG } from 'qrcode.react'
import { GameState, HORSE_COLORS } from '@last-sip-derby/shared'
import { useCountdown } from '@/hooks/useCountdown'

export const WaitingSaloon = ({ gameState }: { gameState: GameState }) => {
  // QR points to mobile: in dev → hostname:3002, in prod → same origin + /play
  const joinUrl = typeof window !== 'undefined'
    ? (window.location.port === '3000'
      ? `${window.location.protocol}//${window.location.hostname}:3002`
      : `${window.location.origin}/play`)
    : ''
  const players = gameState.players.filter((p) => p.isConnected)
  const timeLeft = useCountdown(gameState.phaseStartedAt, gameState.phaseDuration)
  const hasCountdown = players.length > 0 && gameState.phaseDuration < 30_000

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden bg-pmu-paper">
      <div className="paper-texture"></div>

      {/* Title */}
      <div className="text-center mb-10 relative z-10">
        <h1 className="font-rye text-[90px] leading-none tracking-wide text-pmu-alert transform -rotate-1"
          style={{ textShadow: '0 4px 0 rgba(160,32,32,0.3)' }}
        >
          Last Sip Derby
        </h1>
        <div className="h-[3px] mx-auto mt-4 bg-pmu-dark/20" style={{ width: 500 }} />
        <p className="font-body text-xl text-pmu-wood tracking-[0.3em] uppercase font-bold mt-3">
          PMU OFFICIEL — SALLE D'ATTENTE
        </p>
      </div>

      {/* QR Code — centered */}
      <div className="flex flex-col items-center relative z-10 mb-8">
        <div className="relative p-1.5 border-4 border-pmu-dark" style={{ boxShadow: '6px 6px 0px #3a2a1a' }}>
          <div className="bg-white p-4">
            {joinUrl ? (
              <QRCodeSVG value={joinUrl} size={160} bgColor="#ffffff" fgColor="#0f0a07" />
            ) : (
              <div className="w-[160px] h-[160px] bg-gray-200" />
            )}
          </div>
        </div>
        <p className="font-mono text-sm text-pmu-dark/40 mt-3 tracking-widest uppercase font-bold">
          Scannez pour rejoindre
        </p>
      </div>

      {/* Players list — horizontal wrap, full width */}
      <div className="relative z-10 w-full max-w-4xl px-12">
        {players.length === 0 ? (
          <div className="text-center py-6">
            <p className="font-terminal text-2xl text-pmu-dark/30 animate-pulse uppercase">
              En attente de joueurs...
            </p>
          </div>
        ) : (
          <div className="flex flex-wrap justify-center gap-2">
            {players.map((p, i) => (
              <div
                key={p.pseudo}
                className="flex items-center gap-2 px-3 py-1.5 bg-white/50 border-2 border-pmu-dark/15"
              >
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center font-mono text-xs font-bold text-white"
                  style={{ backgroundColor: HORSE_COLORS[i % HORSE_COLORS.length] }}
                >
                  {i + 1}
                </div>
                <span className="font-terminal text-lg text-pmu-dark uppercase">
                  {p.pseudo}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom: countdown or invite */}
      <div className="mt-12 relative z-10">
        {hasCountdown ? (
          <div className="text-center">
            <div
              className="inline-block px-10 py-4 border-4 border-pmu-dark"
              style={{ boxShadow: '4px 4px 0px #3a2a1a' }}
            >
              <p className="font-rye text-4xl animate-pulse text-pmu-dark">
                La course commence dans {timeLeft}s
              </p>
            </div>
          </div>
        ) : (
          <p className="font-mono text-base text-pmu-dark/30 tracking-widest uppercase">
            La partie commence des qu'un joueur rejoint
          </p>
        )}
      </div>

      {/* Decorative footer */}
      <div className="absolute bottom-6 opacity-20 pointer-events-none text-center font-mono text-pmu-dark z-10">
        <p className="border-t-2 border-dashed border-pmu-dark pt-2">PMU — SOUMIS À LA RÉGLEMENTATION</p>
      </div>
    </div>
  )
}
