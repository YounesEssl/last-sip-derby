'use client'

import { useState } from 'react'
import type { GameState, Player } from '@last-sip-derby/shared'
import { Header, CountdownPill, SilkChip, usePhaseCountdown } from '../ui'

interface Props {
  state: GameState
  player: Player | null
  onBet: (horseId: string) => void
}

export function BetScreen({ state, player, onBet }: Props) {
  const seconds = usePhaseCountdown(state.phaseStartedAt, state.phaseDuration, state.serverNow)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const betHorse = player?.currentBet ? state.horses.find((h) => h.id === player.currentBet!.horseId) : null
  const selected = selectedId ? state.horses.find((h) => h.id === selectedId) : null

  // Ticket confirmed → stub view
  if (betHorse) {
    return (
      <div className="flex h-full flex-col">
        <Header raceNumber={state.raceNumber} right={<CountdownPill seconds={seconds} label="DÉPART" />} />
        <div className="flex flex-1 flex-col items-center justify-center gap-5 px-6">
          <div className="paper ticket-edge w-full max-w-sm rounded-lg px-6 py-7 text-center animate-rise">
            <div className="font-headline text-lg tracking-[0.35em] text-derby-coal">TICKET DE PARI N°{state.raceNumber}</div>
            <div className="mt-4 flex items-center justify-center gap-4">
              <SilkChip color={betHorse.color} number={betHorse.lane + 1} size={52} />
              <div className="text-left">
                <div className="font-body text-2xl font-bold leading-tight text-derby-coal">{betHorse.name}</div>
                <div className="font-mono text-sm text-derby-coal/70">cote : {betHorse.odds} gorgée{betHorse.odds > 1 ? 's' : ''}</div>
              </div>
            </div>
            <div className="mt-4 border-t-2 border-dashed border-derby-coal/30 pt-3 font-mono text-sm text-derby-coal">
              <div>
                🏆 il gagne → tu distribues <b>{betHorse.odds * 2} gorgées</b> (×3 s&apos;il devient doré)
              </div>
              <div className="mt-1">
                💀 il perd → tu bois <b>{betHorse.odds} gorgée{betHorse.odds > 1 ? 's' : ''}</b>
              </div>
            </div>
            <div className="mx-auto mt-5 w-fit animate-stamp border-4 border-derby-green px-5 py-1 font-headline text-2xl tracking-[0.25em] text-derby-green">
              VALIDÉ ✓
            </div>
          </div>
          <p className="font-body text-sm text-derby-smoke">
            Tu peux encore changer d&apos;avis : choisis un autre cheval ci-dessous.
          </p>
          <HorsePicker state={state} selectedId={betHorse.id} onSelect={(id) => id !== betHorse.id && onBet(id)} compact />
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <Header raceNumber={state.raceNumber} right={<CountdownPill seconds={seconds} label="FERMETURE" />} />
      <div className="px-5 pt-3">
        <h2 className="font-headline text-2xl tracking-[0.2em] text-derby-cream">CHOISIS TON CANASSON</h2>
        <p className="font-body text-xs text-derby-smoke">Gagnant : distribue 2× la cote (3× si doré) · Perdant : boit la cote</p>
      </div>

      <div className="mt-3 flex-1 overflow-y-auto px-5 pb-40">
        <HorsePicker state={state} selectedId={selectedId} onSelect={setSelectedId} />
      </div>

      {/* Confirm bar */}
      {selected && (
        <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-derby-night via-derby-night/95 to-transparent px-5 pb-[max(1.2rem,env(safe-area-inset-bottom))] pt-8">
          <button
            onClick={() => onBet(selected.id)}
            className="btn-big w-full rounded-xl bg-derby-red py-4 text-center shadow-lg"
          >
            <span className="font-headline text-2xl tracking-[0.15em] text-derby-cream">
              MISER SUR {selected.name.toUpperCase()}
            </span>
            <span className="mt-0.5 block font-mono text-xs text-derby-cream/80">
              risque : {selected.odds} gorgée{selected.odds > 1 ? 's' : ''} · gain : tu en distribues {selected.odds * 2}
            </span>
          </button>
        </div>
      )}
    </div>
  )
}

function HorsePicker({
  state,
  selectedId,
  onSelect,
  compact = false,
}: {
  state: GameState
  selectedId: string | null
  onSelect: (id: string) => void
  compact?: boolean
}) {
  return (
    <div className={`w-full space-y-2.5 ${compact ? 'max-w-sm' : ''}`}>
      {state.horses.map((h, i) => {
        const isSel = h.id === selectedId
        const bettors = state.players.filter((p) => p.currentBet?.horseId === h.id).length
        return (
          <button
            key={h.id}
            onClick={() => onSelect(h.id)}
            className={`btn-big flex w-full animate-rise items-center gap-3 rounded-xl border-2 px-4 ${compact ? 'py-2' : 'py-3'} text-left transition-colors ${
              isSel ? 'border-derby-gold bg-derby-gold/15' : 'border-derby-gold/25 bg-derby-ink'
            }`}
            style={{ animationDelay: `${i * 0.06}s` }}
          >
            <SilkChip color={h.color} number={h.lane + 1} size={compact ? 34 : 44} />
            <span className="min-w-0 flex-1">
              <span className={`block truncate font-body font-bold text-derby-cream ${compact ? 'text-base' : 'text-lg'}`}>
                {h.name}
              </span>
              {!compact && (
                <span className="font-mono text-xs text-derby-smoke">
                  {bettors > 0 ? `${bettors} parieur${bettors > 1 ? 's' : ''} dessus` : 'personne dessus'}
                </span>
              )}
            </span>
            <span className="text-right">
              <span className="font-terminal text-3xl leading-none text-derby-gold">{h.odds}</span>
              <span className="block font-headline text-[10px] tracking-[0.2em] text-derby-smoke">
                GORGÉE{h.odds > 1 ? 'S' : ''}
              </span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
