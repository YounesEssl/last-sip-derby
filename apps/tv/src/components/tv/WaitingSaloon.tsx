'use client'

import { QRCodeSVG } from 'qrcode.react'
import { GameState, HORSE_COLORS } from '@last-sip-derby/shared'
import { useCountdown } from '@/hooks/useCountdown'

export const WaitingSaloon = ({ gameState }: { gameState: GameState }) => {
  const joinUrl = typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:3002` : ''
  const players = gameState.players.filter((p) => p.isConnected)
  const timeLeft = useCountdown(gameState.phaseStartedAt, gameState.phaseDuration)
  const hasCountdown = players.length > 0 && gameState.phaseDuration <= 30_000

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden"
      style={{ background: 'radial-gradient(ellipse at 50% 30%, #1a2e1a 0%, #0a0f0a 70%, #000 100%)' }}
    >
      {/* Subtle grid overlay */}
      <div className="absolute inset-0 opacity-[0.04]"
        style={{ backgroundImage: 'linear-gradient(rgba(123,198,126,1) 1px, transparent 1px), linear-gradient(90deg, rgba(123,198,126,1) 1px, transparent 1px)', backgroundSize: '60px 60px' }}
      />

      {/* Title */}
      <div className="text-center mb-10 relative z-10">
        <h1 className="font-rye text-[90px] leading-none tracking-wide"
          style={{ color: '#D4A843', textShadow: '0 0 40px rgba(212,168,67,0.3), 0 4px 0 #8B6914' }}
        >
          Last Sip Derby
        </h1>
        <div className="h-[2px] mx-auto mt-3 opacity-40" style={{ width: 400, background: 'linear-gradient(90deg, transparent, #D4A843, transparent)' }} />
      </div>

      {/* Main content */}
      <div className="flex items-start gap-16 relative z-10">

        {/* QR Code block */}
        <div className="flex flex-col items-center">
          <div className="relative p-1 rounded-xl" style={{ background: 'linear-gradient(135deg, #D4A843, #8B6914)' }}>
            <div className="bg-white p-5 rounded-lg">
              {joinUrl ? (
                <QRCodeSVG value={joinUrl} size={200} bgColor="#ffffff" fgColor="#0a0f0a" />
              ) : (
                <div className="w-[200px] h-[200px] bg-gray-200" />
              )}
            </div>
          </div>
          <p className="font-mono text-sm text-white/30 mt-4 tracking-widest uppercase">
            Scannez pour rejoindre
          </p>
        </div>

        {/* Players list */}
        <div className="min-w-[350px]">
          <div className="flex items-center gap-3 mb-5">
            <div className="h-[1px] flex-1" style={{ background: 'linear-gradient(90deg, rgba(123,198,126,0.4), transparent)' }} />
            <h2 className="font-rye text-2xl tracking-wider" style={{ color: '#7BC67E' }}>
              Joueurs
            </h2>
            <div className="h-[1px] flex-1" style={{ background: 'linear-gradient(90deg, transparent, rgba(123,198,126,0.4))' }} />
          </div>

          {players.length === 0 ? (
            <div className="text-center py-10">
              <p className="font-mono text-lg text-white/20 animate-pulse">
                En attente de joueurs...
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {players.map((p, i) => (
                <div
                  key={p.pseudo}
                  className="flex items-center gap-4 px-5 py-3 rounded-lg"
                  style={{
                    background: 'rgba(123,198,126,0.06)',
                    border: '1px solid rgba(123,198,126,0.15)',
                  }}
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center font-mono text-sm font-bold text-white"
                    style={{ backgroundColor: HORSE_COLORS[i % HORSE_COLORS.length] }}
                  >
                    {i + 1}
                  </div>
                  <span className="font-mono text-xl text-white/80 uppercase tracking-wide">
                    {p.pseudo}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bottom: countdown or invite */}
      <div className="mt-12 relative z-10">
        {hasCountdown ? (
          <div className="text-center">
            <div
              className="inline-block px-10 py-4 rounded-xl"
              style={{ background: 'rgba(212,168,67,0.1)', border: '2px solid rgba(212,168,67,0.3)' }}
            >
              <p className="font-rye text-4xl animate-pulse" style={{ color: '#D4A843' }}>
                La course commence dans {timeLeft}s
              </p>
            </div>
          </div>
        ) : (
          <p className="font-mono text-base text-white/20 tracking-widest uppercase">
            La partie commence des qu'un joueur rejoint
          </p>
        )}
      </div>
    </div>
  )
}
