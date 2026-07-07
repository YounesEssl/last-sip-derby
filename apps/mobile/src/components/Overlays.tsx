'use client'

import { useEffect, useState } from 'react'
import type { GameEvent } from '@last-sip-derby/shared'
import { useNow } from './ui'

const DRINK_TIMEOUT_S = 10

export function DrinkOverlay({
  sips,
  reason,
  deadline: deadlineProp,
  onConfirm,
}: {
  sips: number
  reason: string
  deadline?: number
  onConfirm: () => void
}) {
  // Server-provided deadline (events: the whole 30s voting window;
  // tournée: 15s) or the default 10s local window.
  const [deadline] = useState(() => deadlineProp ?? Date.now() + DRINK_TIMEOUT_S * 1000)
  const [totalS] = useState(() => Math.max(1, (deadline - Date.now()) / 1000))
  const now = useNow(100)
  const left = Math.max(0, (deadline - now) / 1000)
  const frac = left / totalS
  const isEventDrink = totalS > 16 // event drinks ride the 30s vote window

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-derby-red/95 px-6 backdrop-blur-sm">
      <div className="animate-shake text-7xl">🍺</div>
      <div className="mt-4 text-center font-display text-5xl text-derby-cream">À BOIRE !</div>
      <div className="mt-2 text-center font-body text-lg text-derby-cream/90">{reason}</div>
      <div className="mt-6 text-center">
        <span className="font-terminal text-[6rem] leading-none text-derby-cream">{sips}</span>
        <span className="ml-3 font-headline text-3xl tracking-[0.2em] text-derby-cream">
          GORGÉE{sips > 1 ? 'S' : ''}
        </span>
      </div>

      <button
        onClick={onConfirm}
        className="btn-big relative mt-8 w-full max-w-xs overflow-hidden rounded-2xl border-4 border-derby-cream bg-derby-night py-5 font-headline text-3xl tracking-[0.2em] text-derby-cream shadow-2xl"
      >
        <span
          className="absolute inset-y-0 left-0 bg-derby-cream/20 transition-[width] duration-100 ease-linear"
          style={{ width: `${frac * 100}%` }}
        />
        <span className="relative">C&apos;EST BU ✓</span>
      </button>
      <p className="mt-3 text-center font-mono text-sm text-derby-cream/80">
        {isEventDrink
          ? left > 0
            ? `${Math.ceil(left)}s — le public te regarde et vote : bois VRAIMENT ou ton cheval y passe !`
            : 'le vote est clos...'
          : left > 0
            ? `confirme dans les ${Math.ceil(left)}s !`
            : 'trop tard...'}
      </p>
    </div>
  )
}

export function VoteOverlay({
  event,
  players,
  onVote,
}: {
  event: GameEvent
  players: { id: string; pseudo: string }[]
  onVote: (valid: boolean) => void
}) {
  const now = useNow(200)
  const left = Math.max(0, Math.ceil((event.votingDeadline - now) / 1000))
  const suspects = event.affectedPlayerIds
    .map((id) => players.find((p) => p.id === id)?.pseudo)
    .filter((p): p is string => !!p)

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center overflow-y-auto bg-derby-night/95 px-6 py-4 backdrop-blur-sm">
      <div className="font-headline text-lg tracking-[0.35em] text-derby-red">⚠ INCIDENT — LE PUBLIC DÉCIDE ⚠</div>
      <div className="paper mt-3 w-full max-w-sm rounded-lg px-5 py-4 text-center">
        <div className="font-display text-2xl text-derby-red">{event.title}</div>
        <div className="mt-2 font-body text-base font-bold leading-snug text-derby-coal">{event.description}</div>
      </div>

      {suspects.length > 0 && (
        <div className="mt-3 w-full max-w-sm rounded-xl border-2 border-dashed border-derby-red/70 bg-derby-red/15 px-4 py-3 text-center">
          <div className="font-headline text-sm font-medium tracking-[0.2em] text-derby-red">
            🍺 DOI{suspects.length > 1 ? 'VENT' : 'T'} BOIRE {event.sipsAmount} GORGÉE{event.sipsAmount > 1 ? 'S' : ''} MAINTENANT :
          </div>
          <div className="font-hand text-3xl font-bold text-derby-cream">{suspects.join(' · ')}</div>
          <div className="mt-1 font-body text-xs text-derby-cream/75">
            Lève les yeux de ton téléphone et regarde-{suspects.length > 1 ? 'les' : 'le'} boire. Puis juge.
          </div>
        </div>
      )}

      <div className="mt-2 font-terminal text-4xl text-derby-gold">{left}s</div>

      <div className="mt-3 flex w-full max-w-sm gap-3">
        <button
          onClick={() => onVote(true)}
          className="btn-big flex-1 rounded-2xl border-4 border-derby-green bg-derby-green/20 py-5 text-center"
        >
          <span className="block text-3xl">🍻</span>
          <span className="font-headline text-lg tracking-[0.1em] text-derby-cream">
            {suspects.length > 1 ? 'ILS ONT' : 'IL A'} BU
          </span>
          <span className="block font-body text-[11px] text-derby-cream/70">le cheval est sauvé</span>
        </button>
        <button
          onClick={() => onVote(false)}
          className="btn-big flex-1 rounded-2xl border-4 border-derby-red bg-derby-red/20 py-5 text-center"
        >
          <span className="block text-3xl">☠️</span>
          <span className="font-headline text-lg tracking-[0.1em] text-derby-cream">PAS BU</span>
          <span className="block font-body text-[11px] text-derby-cream/70">cheval éliminé</span>
        </button>
      </div>
      <p className="mt-2 text-center font-mono text-xs text-derby-smoke">
        Tu n&apos;as pas parié sur ce cheval — sois juste. Ou pas.
      </p>
    </div>
  )
}
