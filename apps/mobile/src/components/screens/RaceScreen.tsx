'use client'

import { useMemo } from 'react'
import type { GameState, Player } from '@last-sip-derby/shared'
import { MiniRace } from '../MiniRace'
import { Header, SilkChip } from '../ui'

export function RaceScreen({ state, player }: { state: GameState; player: Player | null }) {
  const myHorse = player?.currentBet ? state.horses.find((h) => h.id === player.currentBet!.horseId) ?? null : null

  const rank = useMemo(() => {
    if (!myHorse || myHorse.isEliminated) return null
    const alive = state.horses.filter((h) => !h.isEliminated).sort((a, b) => b.position - a.position)
    return alive.findIndex((h) => h.id === myHorse.id) + 1
  }, [state.horses, myHorse])

  const leader = useMemo(() => {
    const alive = state.horses.filter((h) => !h.isEliminated)
    return alive.sort((a, b) => b.position - a.position)[0] ?? null
  }, [state.horses])

  return (
    <div className="flex h-full flex-col">
      <Header
        raceNumber={state.raceNumber}
        right={
          <div className="flex items-center gap-2 rounded-full bg-derby-red/20 px-3 py-1.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute h-full w-full animate-ping rounded-full bg-derby-red opacity-75" />
              <span className="relative h-2.5 w-2.5 rounded-full bg-derby-red" />
            </span>
            <span className="font-headline text-sm tracking-[0.25em] text-derby-red">EN DIRECT</span>
          </div>
        }
      />

      {/* live preview */}
      <div className="mx-4 mt-3 rounded-xl panel-gold p-3">
        <div className="flex items-center justify-between px-1 pb-1">
          <span className="font-headline text-xs tracking-[0.3em] text-derby-brass">APERÇU DE LA PISTE</span>
          <span className="font-terminal text-sm text-derby-smoke">{Math.round(state.raceProgress)}%</span>
        </div>
        <MiniRace horses={state.horses} myHorseId={myHorse?.id ?? null} paused={state.racePaused} />
      </div>

      {/* my horse status */}
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6">
        {myHorse ? (
          myHorse.isEliminated ? (
            <div className="paper w-full max-w-sm rounded-lg px-6 py-6 text-center">
              <SilkChip color="#5a544a" number={myHorse.lane + 1} size={52} />
              <div className="mt-2 font-body text-2xl font-bold text-derby-coal line-through">{myHorse.name}</div>
              <div className="mx-auto mt-3 w-fit animate-stamp border-4 border-derby-red px-5 py-1 font-headline text-3xl tracking-[0.2em] text-derby-red">
                ÉLIMINÉ
              </div>
              <p className="mt-3 font-mono text-sm text-derby-coal/70">Ton canasson a rendu l&apos;âme. Prépare ton verre...</p>
            </div>
          ) : (
            <div className="w-full max-w-sm text-center">
              <div className={`mx-auto flex h-28 w-28 items-center justify-center rounded-full border-4 ${rank === 1 ? 'border-derby-gold bg-derby-gold/20' : 'border-derby-gold/40 bg-derby-ink'}`}>
                <div>
                  <div className={`font-display text-5xl leading-none ${rank === 1 ? 'text-derby-gold' : 'text-derby-cream'}`}>
                    {rank}
                    <span className="text-2xl">{rank === 1 ? 'ᵉʳ' : 'ᵉ'}</span>
                  </div>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-center gap-3">
                <SilkChip color={myHorse.color} number={myHorse.lane + 1} size={36} />
                <span className="font-body text-xl font-bold text-derby-cream">{myHorse.name}</span>
              </div>
              <p className="mt-2 font-mono text-sm text-derby-smoke">
                {state.racePaused
                  ? '⚠️ Incident sur la piste !'
                  : rank === 1
                    ? 'EN TÊTE ! Commence à choisir tes victimes 🍺'
                    : rank && rank <= 2
                      ? 'Bien placé, accroche-toi !'
                      : leader && myHorse.position > leader.position - 8
                        ? 'Dans le paquet, ça peut le faire.'
                        : 'Aïe... hydrate-toi en prévision.'}
              </p>
            </div>
          )
        ) : (
          <div className="text-center">
            <div className="font-display text-3xl text-derby-smoke">Spectateur</div>
            <p className="mt-2 font-body text-sm text-derby-smoke">
              Pas de ticket cette course. Profite du spectacle sur le grand écran 📺
            </p>
          </div>
        )}
      </div>

      <div className="pb-[max(1rem,env(safe-area-inset-bottom))] text-center font-mono text-xs text-derby-smoke/60">
        garde l&apos;œil sur la TV — ici c&apos;est juste le moniteur des stands
      </div>
    </div>
  )
}
