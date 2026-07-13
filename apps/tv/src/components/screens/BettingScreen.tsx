'use client'

import type { GameState } from '@last-sip-derby/shared'
import { JoinQR, Ticker, usePhaseCountdown } from '../shared'
import { RowHorse } from '../RowHorse'

const FLAVOR: Record<number, string> = {
  1: 'le chouchou du bookmaker',
  2: 'sérieux comme un percheron',
  3: 'capable du meilleur comme du pire',
  5: 'un pari de poète',
  7: 'le tocard au grand cœur',
}

export function BettingScreen({ state }: { state: GameState }) {
  const seconds = usePhaseCountdown(state.phaseStartedAt, state.phaseDuration, state.serverNow)
  const urgent = seconds <= 10

  const bettorsByHorse = new Map<string, string[]>()
  for (const p of state.players) {
    if (!p.currentBet) continue
    const list = bettorsByHorse.get(p.currentBet.horseId) ?? []
    list.push(p.pseudo)
    bettorsByHorse.set(p.currentBet.horseId, list)
  }
  const totalBets = state.players.filter((p) => p.currentBet).length

  return (
    <div className="bg-hippodrome relative flex h-full flex-col overflow-hidden px-[4vw] pt-[3.4vh]">
      {/* ── header ── */}
      <div className="relative z-10 flex items-end justify-between">
        <div className="animate-rise">
          <div className="flex items-center gap-4 font-headline text-[2vh] font-light tracking-[0.5em] text-derby-gold">
            <span>✦</span> COURSE N°{state.raceNumber} <span>✦</span>
          </div>
          <h1 className="text-engraved mt-1 font-display text-[6.4vh] leading-tight">Les paris sont ouverts</h1>
        </div>

        <div className="mb-1 flex items-center gap-5">
          <div className="text-right font-hand text-[2.4vh] leading-tight text-derby-parch/80 -rotate-2">
            misez vite,
            <br />
            le starter s&apos;impatiente...
          </div>
          <div
            className={`rounded-xl border-2 px-6 py-2 text-center ${
              urgent ? 'animate-pulse border-derby-red bg-derby-red/15' : 'border-derby-gold/50 bg-derby-night/60'
            }`}
          >
            <div className="font-headline text-[1.5vh] font-light tracking-[0.4em] text-derby-smoke">FERMETURE</div>
            <div className={`font-terminal text-[7.2vh] leading-none ${urgent ? 'text-derby-red' : 'text-derby-gold'}`}>
              {String(Math.floor(seconds / 60)).padStart(2, '0')}:{String(seconds % 60).padStart(2, '0')}
            </div>
          </div>
        </div>
      </div>

      <div className="relative z-10 mt-[2.6vh] flex flex-1 gap-[2.6vw]">
        {/* ── odds board ── */}
        <div className="relative flex-1 self-start rounded-2xl border-[3px] border-[#4a3018] bg-derby-night/70 p-5 shadow-deep [box-shadow:inset_0_0_0_2px_rgba(217,169,63,0.5),0_24px_60px_-16px_rgba(0,0,0,0.8)]">
          <div className="absolute -top-[2.2vh] left-1/2 -translate-x-1/2 rounded-md border-2 border-derby-gold/70 bg-[#4a3018] px-8 py-1 font-headline text-[2vh] font-medium tracking-[0.4em] text-derby-parch shadow-deep">
            TABLEAU DES COTES
          </div>

          {state.horses.map((h, i) => {
            const bettors = bettorsByHorse.get(h.id) ?? []
            return (
              <div
                key={h.id}
                className="grid animate-rise grid-cols-[7vw_1fr_11vw_1fr] items-center gap-x-[1.4vw] border-b border-derby-gold/15 py-[0.9vh] last:border-b-0"
                style={{ animationDelay: `${0.1 + i * 0.09}s` }}
              >
                <div className="flex items-center justify-center">
                  <RowHorse lane={h.lane} silk={h.color} size={74} />
                </div>
                <div className="min-w-0">
                  <div className="truncate font-body text-[2.9vh] font-bold text-derby-cream">{h.name}</div>
                  <div className="font-hand text-[2.2vh] leading-none text-derby-smoke">{FLAVOR[h.odds] ?? 'mystère total'}</div>
                </div>
                <div className="flex items-baseline justify-center gap-2 rounded-lg bg-derby-ink/80 py-[0.8vh] [box-shadow:inset_0_2px_8px_rgba(0,0,0,0.6)]">
                  <span className="font-terminal text-[4.8vh] leading-none text-derby-gold">{h.odds}</span>
                  <span className="font-headline text-[1.5vh] font-light tracking-[0.25em] text-derby-smoke">
                    GORGÉE{h.odds > 1 ? 'S' : ''}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {bettors.length === 0 && (
                    <span className="font-hand text-[2vh] text-derby-smoke/50 -rotate-2">personne n&apos;ose...</span>
                  )}
                  {bettors.map((b, bi) => (
                    <span
                      key={b}
                      className="animate-stamp paper rounded-sm px-3 py-0.5 font-hand text-[2.3vh] font-bold text-derby-coal"
                      style={{ rotate: `${((bi * 47) % 9) - 4}deg` }}
                    >
                      {b}
                    </span>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        {/* ── side panel ── */}
        <div className="flex w-[22vw] flex-col items-center gap-[2.4vh]">
          <JoinQR size={170} label="DERNIÈRE CHANCE" />
          <div className="panel-gold w-full rounded-xl px-5 py-4 text-center">
            <div className="font-headline text-[1.7vh] font-medium tracking-[0.35em] text-derby-gold">TICKETS VALIDÉS</div>
            <div className="font-terminal text-[6vh] leading-none text-derby-cream">
              {totalBets}
              <span className="text-derby-smoke">/{state.players.length}</span>
            </div>
            <div className="mt-2 border-t border-dashed border-derby-gold/30 pt-2 text-left font-body text-[1.7vh] leading-relaxed text-derby-smoke">
              → gagnant : distribue <b className="text-derby-gold">2× la cote</b> (3× si doré)
              <br />
              → perdant : boit <b className="text-derby-red">la cote</b> de son cheval
              <br />
              → sans ticket : simple spectateur
            </div>
          </div>
        </div>
      </div>

      <Ticker />
    </div>
  )
}
