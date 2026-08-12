'use client'

import { useMemo, useState } from 'react'
import type { GameState, Player } from '@last-sip-derby/shared'
import { MiniRace } from '../MiniRace'
import { Header, SilkChip } from '../ui'

export function RaceScreen({ state, player, onBlackKnightKill }: { state: GameState; player: Player | null; onBlackKnightKill: (horseId: string) => void }) {
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
  const [targetId, setTargetId] = useState<string | null>(null)
  const knightReady = !!myHorse?.isBlackKnight && (player?.blackKnightKillsUsed ?? 0) < 2

  return (
    <div className={`flex h-full flex-col ${myHorse?.isBlackKnight ? 'bg-black' : ''}`}>
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
          <span className="flex items-center gap-1" aria-label={`${Math.round(state.raceProgress)} % de la course`}>
            {Array.from({ length: 10 }, (_, index) => (
              <span
                key={index}
                className={`h-1.5 w-1.5 rounded-full ${index < Math.ceil(state.raceProgress / 10) ? 'bg-derby-gold' : 'bg-derby-smoke/30'}`}
              />
            ))}
          </span>
        </div>
        <MiniRace horses={state.horses} myHorseId={myHorse?.id ?? null} paused={state.racePaused} />
      </div>

      {/* my horse status */}
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6">
        {myHorse ? (
          myHorse.isEliminated || player?.miniGameEliminated ? (
            <div className="paper w-full max-w-sm rounded-lg px-6 py-6 text-center">
              <SilkChip color="#5a544a" number={myHorse.lane + 1} size={52} />
              <div className="mt-2 font-body text-2xl font-bold text-derby-coal line-through">{myHorse.name}</div>
              <div className="mx-auto mt-3 w-fit animate-stamp border-4 border-derby-red px-5 py-1 font-headline text-3xl tracking-[0.2em] text-derby-red">
                ÉLIMINÉ
              </div>
              <p className="mt-3 font-mono text-sm text-derby-coal/70">{player?.miniGameEliminated && !myHorse.isEliminated ? 'Tu as perdu le défi. Le cheval continue sans toi.' : 'Ton canasson a rendu l’âme. Prépare ton verre...'}</p>
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
              {(myHorse.isGolden || myHorse.isDiamond || myHorse.isBlackKnight || myHorse.isAdrien || myHorse.jockeyFallen || myHorse.isReversed || myHorse.appearance !== 'HORSE') && (
                <div className="mt-2 font-headline text-sm tracking-[0.12em] text-derby-gold">
                  {myHorse.isGolden ? '✨ CHEVAL DORÉ · ' : ''}
                  {myHorse.isDiamond ? '💎 CHEVAL DIAMANT ×5 · ' : ''}
                  {myHorse.isBlackKnight ? '⚔️ CAVALIER NOIR · ' : ''}
                  {myHorse.appearance === 'CAMEL' ? '🐪 CHAMEAU · ' : myHorse.appearance === 'MOTORCYCLE' ? '🏍️ MOTO CROSS +5% · ' : myHorse.appearance === 'SCOOTER' ? '🛴 ADRIEN HOURMAND +15% · ' : ''}
                  {myHorse.jockeyFallen ? 'JOCKEY À TERRE +5% · ' : ''}
                  {myHorse.isReversed ? '↩ COURSE À L’ENVERS' : ''}
                </div>
              )}
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
              {knightReady && (
                <div className="mt-4 rounded-xl border-2 border-red-800 bg-black p-3 text-left">
                  <div className="text-center font-headline text-xl tracking-[.15em] text-red-600">⚔️ POUVOIR DU CAVALIER NOIR</div>
                  <div className="mt-2 grid grid-cols-2 gap-2">{state.horses.filter((horse) => horse.id !== myHorse.id && !horse.isEliminated).map((horse) => <button key={horse.id} onClick={() => setTargetId(horse.id)} className="rounded-lg border border-red-900 px-2 py-2 font-body text-sm text-white">{horse.name}<span className="block text-[10px] text-red-400">{state.players.filter((p) => p.currentBet?.horseId === horse.id).map((p) => p.pseudo).join(', ') || 'aucun parieur'}</span></button>)}</div>
                  <div className="mt-2 text-center font-terminal text-red-500">{2 - (player?.blackKnightKillsUsed ?? 0)} coup(s) de hache</div>
                </div>
              )}
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
      {targetId && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-5"><div className="w-full max-w-sm rounded-2xl border-2 border-red-700 bg-derby-coal p-5 text-center"><div className="font-display text-3xl text-red-500">VOULEZ-VOUS TUER CE CHEVAL ?</div><div className="mt-3 font-body text-xl text-white">{state.horses.find((h) => h.id === targetId)?.name}</div><div className="mt-1 font-mono text-sm text-red-300">Parieurs : {state.players.filter((p) => p.currentBet?.horseId === targetId).map((p) => p.pseudo).join(', ') || 'aucun'}</div><div className="mt-5 flex gap-3"><button onClick={() => setTargetId(null)} className="flex-1 rounded-xl border border-white/30 py-3">NON</button><button onClick={() => { onBlackKnightKill(targetId); setTargetId(null) }} className="flex-1 rounded-xl bg-red-700 py-3 font-bold">OUI ⚔️</button></div></div></div>}
    </div>
  )
}
