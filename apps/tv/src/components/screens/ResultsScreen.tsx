'use client'

import { useMemo } from 'react'
import { getWinSips, type GameState } from '@last-sip-derby/shared'
import { PodiumCanvas } from '../PodiumCanvas'
import { SilkDot, Ticker, usePhaseCountdown } from '../shared'

export function ResultsScreen({ state }: { state: GameState }) {
  const seconds = usePhaseCountdown(state.phaseStartedAt, state.phaseDuration, state.serverNow, state.isGamePaused)

  const ranking = useMemo(() => {
    const alive = [...state.horses].filter((h) => !h.isEliminated).sort((a, b) => b.position - a.position)
    const dead = state.horses.filter((h) => h.isEliminated)
    return [...alive, ...dead]
  }, [state.horses])

  const winner = ranking[0]
  const winnerBettors = state.players.filter((p) => p.currentBet?.horseId === winner?.id && !p.miniGameEliminated)
  const drinkers = state.roundDrinks
    .map((drink) => {
      const player = state.players.find((p) => p.pseudo === drink.pseudo)
      const horse = player?.currentBet ? state.horses.find((h) => h.id === player.currentBet!.horseId) : undefined
      return { ...drink, horse }
    })
    .sort((a, b) => b.sips - a.sips)
  const compactWinners = winnerBettors.length > 5
  const compactLosers = drinkers.length > 5
  const denseTicket = compactWinners || compactLosers

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
        <div className="relative w-[30vw] shrink-0 animate-rise" style={{ animationDelay: '0.15s' }}>
          <PodiumCanvas top3={ranking.slice(0, 3)} paused={state.isGamePaused} />
        </div>

        {/* the bill */}
        <div className="flex flex-1 flex-col justify-center gap-[1vh]">
          <div className={`paper ticket-edge rotate-1 animate-rise rounded-lg border-4 border-derby-red/70 shadow-deep ${denseTicket ? 'px-7 py-3' : 'px-9 py-5'}`} style={{ animationDelay: '0.3s' }}>
            <div className="border-b-2 border-dashed border-derby-coal/40 pb-2 text-center">
              <div className={`font-headline font-medium tracking-[0.2em] text-derby-red ${denseTicket ? 'text-[4.4vh]' : 'text-[5.5vh]'}`}>QUI BOIT QUOI ?</div>
              <div className={`font-hand font-bold text-derby-coal/70 ${denseTicket ? 'text-[1.9vh]' : 'text-[2.5vh]'}`}>la tournée — affichage public et sans appel</div>
            </div>

            <div className={denseTicket ? 'mt-2' : 'mt-3'}>
              <div className="font-headline text-[1.7vh] font-medium tracking-[0.3em] text-derby-green">ILS RÉGALENT</div>
              {winnerBettors.length === 0 && (
                <div className="font-hand text-[2.4vh] leading-tight text-derby-coal/70">
                  personne n&apos;avait misé sur le bon canasson...
                </div>
              )}
              <div className={compactWinners ? 'grid grid-cols-2 gap-x-6 gap-y-[.2vh]' : ''}>
                {winnerBettors.map((p) => (
                  <div key={p.pseudo} className="flex min-w-0 items-baseline justify-between gap-2">
                    <span className={`truncate font-hand font-bold text-derby-coal ${denseTicket ? 'text-[2.35vh]' : 'text-[3vh]'}`}>{p.pseudo}</span>
                    <span className={`shrink-0 font-body font-bold text-derby-green ${denseTicket ? 'text-[1.55vh]' : 'text-[2vh]'}`}>
                      {denseTicket ? 'donne' : 'distribue'} {getWinSips(winner?.odds ?? 1, winner?.isDiamond ? 5 : winner?.isGolden ? 3 : 2)}{denseTicket ? '' : ' gorgées'}{winner?.isDiamond ? ' ×5' : winner?.isGolden ? ' ×3' : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className={`${denseTicket ? 'mt-2 pt-1' : 'mt-3 pt-2'} border-t border-dashed border-derby-coal/30`}>
              <div className={`font-headline font-medium tracking-[0.3em] text-derby-red ${denseTicket ? 'text-[2.15vh]' : 'text-[2.7vh]'}`}>🍺 À BOIRE MAINTENANT 🍺</div>
              {drinkers.length === 0 && (
                <div className="font-hand text-[2.4vh] text-derby-coal/70">aucun perdant... suspect.</div>
              )}
              <div className={compactLosers ? 'grid grid-cols-2 gap-x-6 gap-y-[.35vh]' : ''}>
                {drinkers.map((l) => (
                  <div key={l.pseudo} className="flex min-w-0 items-center justify-between gap-2 border-b border-derby-coal/10 py-[.15vh] last:border-b-0">
                    <span className="flex min-w-0 items-center gap-2">
                      {l.horse && <SilkDot color={l.horse.color} size={denseTicket ? 9 : 11} />}
                      <span className={`truncate font-hand font-bold text-derby-coal ${denseTicket ? 'text-[2.75vh]' : 'text-[4.4vh]'}`}>{l.pseudo}</span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end leading-tight">
                      {l.betSavedBySecondPlace && (
                        <span className={`font-headline font-bold tracking-[.08em] text-derby-green ${denseTicket ? 'text-[1.15vh]' : 'text-[1.45vh]'}`}>2e · MISE SAUVÉE</span>
                      )}
                      <span className={`whitespace-nowrap rounded-md font-body font-bold ${l.sips > 0 ? 'bg-derby-red text-derby-cream' : 'bg-derby-green/20 text-derby-green'} ${denseTicket ? 'px-2 py-[.2vh] text-[1.9vh]' : 'px-3 py-1 text-[3.2vh]'}`}>
                        {l.sips} gorgée{l.sips > 1 ? 's' : ''}
                      </span>
                      {(l.betSavedBySecondPlace || l.eventSips > 0 || l.receivedSips > 0) && (
                        <span className={`whitespace-nowrap font-body text-derby-coal/60 ${denseTicket ? 'text-[.85vh]' : 'text-[1.05vh]'}`}>
                          mise {l.betSips} · événement {l.eventSips} · reçues {l.receivedSips}
                        </span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className={`${denseTicket ? 'mt-2 pt-1 text-[1.1vh]' : 'mt-3 pt-2 text-[1.4vh]'} border-t-2 border-dashed border-derby-coal/40 text-center font-body text-derby-coal/60`}>
              L&apos;hippodrome décline toute responsabilité en cas de lendemain difficile.
            </div>
          </div>

          <div className="rounded-lg border border-derby-gold/35 bg-derby-night/70 px-5 py-2">
            <div className="flex items-center justify-between gap-4">
              <div className="font-headline text-[1.5vh] tracking-[.3em] text-derby-gold/80">BILAN GLOBAL DE LA SOIRÉE</div>
              <div className="font-body text-[1.05vh] uppercase tracking-[.16em] text-derby-parch/55">Comparatif par joueur</div>
            </div>
            <div className="mt-1 grid grid-flow-col grid-rows-3 auto-cols-fr gap-x-[1vw] gap-y-[.45vh]">
              {state.eveningLeaderboard.map((player, index) => (
                <div key={player.pseudo} className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-[.35vw] rounded border border-white/10 bg-black/15 px-[.45vw] py-[.25vh] font-body">
                  <span className="text-[1.15vh] text-derby-gold/70">{index + 1}.</span>
                  <span className="truncate text-[1.35vh] text-derby-parch/80">{player.pseudo}</span>
                  <span className="rounded bg-derby-red/20 px-[.3vw] py-[.12vh] text-[1.1vh] text-derby-parch/70"><b className="mr-[.25vw] text-derby-red">BUES</b>{player.totalSipsDrunk}</span>
                  <span className="rounded bg-derby-green/25 px-[.3vw] py-[.12vh] text-[1.1vh] text-derby-parch/70"><b className="mr-[.25vw] text-emerald-300">DONNÉES</b>{player.totalSipsGiven}</span>
                </div>
              ))}
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
