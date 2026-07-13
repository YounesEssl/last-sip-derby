'use client'

import { useMemo } from 'react'
import type { GameState } from '@last-sip-derby/shared'
import { PodiumCanvas } from '../PodiumCanvas'
import { SilkDot, Ticker, usePhaseCountdown } from '../shared'

export function ResultsScreen({ state }: { state: GameState }) {
  const seconds = usePhaseCountdown(state.phaseStartedAt, state.phaseDuration, state.serverNow)

  const ranking = useMemo(() => {
    const alive = [...state.horses].filter((h) => !h.isEliminated).sort((a, b) => b.position - a.position)
    const dead = state.horses.filter((h) => h.isEliminated)
    return [...alive, ...dead]
  }, [state.horses])

  const winner = ranking[0]
  const winnerBettors = state.players.filter((p) => p.currentBet?.horseId === winner?.id)
  const losers = state.roundDrinks
    .map((drink) => {
      const player = state.players.find((p) => p.pseudo === drink.pseudo)
      const horse = player?.currentBet ? state.horses.find((h) => h.id === player.currentBet!.horseId) : undefined
      return { pseudo: drink.pseudo, horse, sips: drink.sips }
    })
    .sort((a, b) => b.sips - a.sips)

  return (
    <div className="bg-hippodrome relative flex h-full flex-col overflow-hidden pt-[3.6vh]">
      {/* headline */}
      <div className="relative z-10 text-center animate-rise">
        <div className="flex items-center justify-center gap-4 font-headline text-[1.9vh] font-light tracking-[0.5em] text-derby-gold">
          <span>✦</span> COURSE N°{state.raceNumber} — RÉSULTATS OFFICIELS <span>✦</span>
        </div>
        {winner && (
          <h1 className="text-engraved mt-1 font-display text-[6.6vh] leading-tight">
            {winner.name} l&apos;emporte !
          </h1>
        )}
      </div>

      <div className="relative z-10 flex flex-1 items-stretch gap-[2vw] px-[3.6vw] pb-[6.5vh] pt-[1vh]">
        {/* winners' circle */}
        <div className="relative flex-1 animate-rise" style={{ animationDelay: '0.15s' }}>
          <PodiumCanvas top3={ranking.slice(0, 3)} />
        </div>

        {/* the bill */}
        <div className="flex w-[44vw] flex-col justify-center gap-[1.5vh]">
          <div className="paper ticket-edge rotate-1 animate-rise rounded-lg border-4 border-derby-red/70 px-9 py-6 shadow-deep" style={{ animationDelay: '0.3s' }}>
            <div className="border-b-2 border-dashed border-derby-coal/40 pb-2 text-center">
              <div className="font-headline text-[4.5vh] font-medium tracking-[0.2em] text-derby-red">QUI BOIT QUOI ?</div>
              <div className="font-hand text-[2.5vh] font-bold text-derby-coal/70">la tournée — affichage public et sans appel</div>
            </div>

            <div className="mt-3">
              <div className="font-headline text-[1.7vh] font-medium tracking-[0.3em] text-derby-green">ILS RÉGALENT</div>
              {winnerBettors.length === 0 && (
                <div className="font-hand text-[2.4vh] leading-tight text-derby-coal/70">
                  personne n&apos;avait misé sur le bon canasson...
                </div>
              )}
              {winnerBettors.map((p) => (
                <div key={p.pseudo} className="flex items-baseline justify-between">
                  <span className="font-hand text-[3vh] font-bold text-derby-coal">{p.pseudo}</span>
                  <span className="font-body text-[2vh] font-bold text-derby-green">
                    distribue {(winner?.odds ?? 1) * (winner?.isGolden ? 3 : 2)} gorgées{winner?.isGolden ? ' ✨ ×3' : ''}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-3 border-t border-dashed border-derby-coal/30 pt-2">
              <div className="font-headline text-[2.7vh] font-medium tracking-[0.3em] text-derby-red">🍺 À BOIRE MAINTENANT 🍺</div>
              {losers.length === 0 && (
                <div className="font-hand text-[2.4vh] text-derby-coal/70">aucun perdant... suspect.</div>
              )}
              {losers.map((l) => (
                <div key={l.pseudo} className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2">
                    {l.horse && <SilkDot color={l.horse.color} size={11} />}
                    <span className="truncate font-hand text-[4.4vh] font-bold text-derby-coal">{l.pseudo}</span>
                  </span>
                  <span className="whitespace-nowrap rounded-md bg-derby-red px-3 py-1 font-body text-[3.2vh] font-bold text-derby-cream">
                    {l.sips} gorgée{l.sips > 1 ? 's' : ''} 🍺
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-3 border-t-2 border-dashed border-derby-coal/40 pt-2 text-center font-body text-[1.4vh] text-derby-coal/60">
              L&apos;hippodrome décline toute responsabilité en cas de lendemain difficile.
            </div>
          </div>

          <div className="text-center animate-rise" style={{ animationDelay: '0.45s' }}>
            <span className="font-headline text-[1.8vh] font-light tracking-[0.4em] text-derby-parch/80">
              PROCHAINE COURSE DANS{' '}
            </span>
            <span className="font-terminal text-[3.6vh] text-derby-gold">{seconds}s</span>
          </div>
        </div>
      </div>

      <Ticker />
    </div>
  )
}
