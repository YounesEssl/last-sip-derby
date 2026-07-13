'use client'

import type { GameState } from '@last-sip-derby/shared'
import { AmbientScene } from '../AmbientScene'
import { Bulbs, JoinQR, Ticker, usePhaseCountdown } from '../shared'

export function IdleScreen({ state }: { state: GameState }) {
  const seconds = usePhaseCountdown(state.phaseStartedAt, state.phaseDuration, state.serverNow)
  const players = state.players
  const hasPlayers = players.length > 0
  const board = [...state.eveningLeaderboard].sort((a, b) => b.totalSipsDrunk - a.totalSipsDrunk).slice(0, 7)

  return (
    <div className="relative h-full overflow-hidden bg-derby-night">
      <AmbientScene />

      <div className="relative z-10 flex h-full flex-col items-center">
        {/* ── Marquee ── */}
        <div className="mt-[5vh] flex flex-col items-center animate-rise">
          <div className="flex items-center gap-5 font-headline text-[2.2vh] font-light tracking-[0.55em] text-derby-parch/90">
            <span className="text-derby-gold">✦</span>
            HIPPODROME DU DERNIER VERRE
            <span className="text-derby-gold">✦</span>
          </div>
          <div className="mt-[2vh]">
            <Bulbs count={30} />
          </div>
          <h1 className="text-engraved mt-2 text-center font-display text-[10vh] leading-[1.04] animate-flicker">
            L&apos;Apérodrome
          </h1>
          <div className="mt-2">
            <Bulbs count={30} />
          </div>
          <div className="mt-[1.6vh] font-hand text-[3.2vh] text-derby-parch/80 -rotate-1">
            courses truquées &amp; gorgées garanties depuis 1892
          </div>
        </div>

        {/* ── QR + leaderboard ── */}
        <div className="mt-auto mb-[3vh] flex w-full items-end justify-between px-[6vw]">
          <div className="animate-rise" style={{ animationDelay: '0.2s' }}>
            <JoinQR size={180} />
          </div>

          <div className="flex flex-col items-center gap-[1.4vh] pb-[1vh]">
            {hasPlayers ? (
              <>
                <div className="font-headline text-[2.4vh] font-light tracking-[0.45em] text-derby-parch">
                  DÉPART IMMINENT
                </div>
                <div className="font-terminal text-[9vh] leading-none text-derby-gold [text-shadow:0_0_30px_rgba(217,169,63,0.45)]">
                  {String(Math.floor(seconds / 60)).padStart(2, '0')}:{String(seconds % 60).padStart(2, '0')}
                </div>
                <div className="font-body text-[1.8vh] text-derby-parch/70">
                  {players.length} turfiste{players.length > 1 ? 's' : ''} en tribune — les paris ouvrent bientôt
                </div>
              </>
            ) : (
              <>
                <div className="font-headline text-[2.6vh] font-light tracking-[0.45em] text-derby-parch animate-pulse-soft">
                  SCANNEZ POUR ENTRER
                </div>
                <div className="font-hand text-[2.6vh] text-derby-parch/70 rotate-1">
                  la première course part dès qu&apos;un turfiste arrive
                </div>
              </>
            )}
          </div>

          <div
            className="panel-gold w-[26vw] rounded-xl px-6 py-5 animate-rise backdrop-blur-[2px]"
            style={{ animationDelay: '0.35s' }}
          >
            <div className="flex items-baseline justify-between border-b border-derby-gold/30 pb-2">
              <span className="font-headline text-[2vh] font-medium tracking-[0.3em] text-derby-gold">
                {hasPlayers ? 'AU DÉPART' : 'TABLEAU DES DÉGÂTS'}
              </span>
              <span className="font-hand text-[2.2vh] text-derby-parch/70">soirée en cours</span>
            </div>
            <div className="mt-3 space-y-[1.1vh]">
              {board.length === 0 && (
                <div className="font-body text-[1.9vh] leading-snug text-derby-smoke">
                  Les box sont vides...
                  <br />
                  Scannez le QR code et venez perdre avec panache.
                </div>
              )}
              {board.map((p, i) => (
                <div key={p.pseudo} className="flex items-baseline gap-3">
                  <span className="w-6 font-display text-[2vh] text-derby-brass">{i + 1}</span>
                  <span className="flex-1 truncate font-body text-[2.1vh] font-bold text-derby-cream">{p.pseudo}</span>
                  <span className="font-terminal text-[2.1vh] text-derby-red">{p.totalSipsDrunk}🍺</span>
                  <span className="font-terminal text-[2.1vh] text-derby-gold">{p.totalSipsGiven}🎁</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="h-[5.5vh]" />
      </div>

      <Ticker />
    </div>
  )
}
