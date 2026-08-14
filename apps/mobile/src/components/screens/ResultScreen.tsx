'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { getWinSips, type GameState, type Player, type RoundDrinkSummary } from '@last-sip-derby/shared'
import { Header, CountdownPill, SilkChip, usePhaseCountdown } from '../ui'

export function ResultScreen({
  state,
  player,
  onDistribute,
}: {
  state: GameState
  player: Player | null
  onDistribute: (allocations: { pseudo: string; sips: number }[]) => void
}) {
  const seconds = usePhaseCountdown(state.phaseStartedAt, state.phaseDuration, state.serverNow, state.isGamePaused)

  const ranking = useMemo(() => {
    const alive = state.horses.filter((h) => !h.isEliminated)
    return [...alive].sort((a, b) => b.position - a.position)
  }, [state.horses])
  const winner = ranking[0] ?? null
  const second = ranking[1] ?? null

  const myBetHorse = player?.currentBet ? state.horses.find((h) => h.id === player.currentBet!.horseId) : null
  const won = !!(winner && myBetHorse && winner.id === myBetHorse.id && !player?.miniGameEliminated)
  const myRound = state.roundDrinks.find((drink) => drink.pseudo === player?.pseudo)
  const savedBySecondPlace = !!(
    myBetHorse &&
    second &&
    myBetHorse.id === second.id &&
    myRound?.betSavedBySecondPlace
  )
  const myRoundSips = myRound?.sips ?? 0

  const losers = useMemo(
    () =>
      state.roundDrinks
        .map((drink) => {
          const drinker = state.players.find((p) => p.pseudo === drink.pseudo)
          const horse = drinker?.currentBet ? state.horses.find((h) => h.id === drinker.currentBet!.horseId) : undefined
          return { ...drink, color: horse?.color ?? '#5a544a' }
        })
        .sort((a, b) => b.sips - a.sips),
    [state.players, state.horses, state.roundDrinks],
  )

  return (
    <div className="flex h-full flex-col">
      <Header raceNumber={state.raceNumber} right={<CountdownPill seconds={seconds} label="PROCHAINE" />} />

      <div className="flex flex-1 flex-col items-center gap-4 overflow-y-auto px-5 py-4">
        {winner && (
          <div className="flex items-center gap-3 font-body text-sm text-derby-smoke animate-rise">
            <SilkChip color={winner.color} number={winner.lane + 1} size={26} />
            <span>
              vainqueur : <b className="text-derby-cream">{winner.name}</b>
            </span>
          </div>
        )}

        {myBetHorse ? (
          won ? (
            <WinnerPanel
              state={state}
              player={player}
              totalSips={getWinSips(winner?.odds ?? 1, winner?.isDiamond ? 5 : winner?.isGolden ? 3 : 2)}
              onDistribute={onDistribute}
            />
          ) : savedBySecondPlace ? (
            <div
              className="w-full max-w-sm rounded-2xl border-4 border-derby-gold bg-gradient-to-b from-derby-green/25 to-derby-ink px-5 py-5 text-center shadow-lg animate-rise"
              style={{ animationDelay: '0.1s' }}
            >
              <div className="font-display text-[1.8rem] leading-tight text-derby-gold">2e PLACE — MISE SAUVÉE</div>
              <div className="mt-1 font-hand text-xl text-derby-cream/90">{myBetHorse.name} sauve ton ticket</div>
              <div className="mt-4 font-headline text-base tracking-[0.14em] text-derby-cream">0 GORGÉE DE MISE À BOIRE</div>
              <RoundBreakdown summary={myRound!} saved />
            </div>
          ) : (
            <div
              className="w-full max-w-sm rounded-2xl border-4 border-derby-red bg-gradient-to-b from-derby-red/20 to-derby-ink px-6 py-6 text-center shadow-lg animate-rise"
              style={{ animationDelay: '0.1s' }}
            >
              <div className="font-display text-3xl text-derby-red">Perdu...</div>
              <div className="mt-1 font-hand text-xl text-derby-cream/90">
                {myBetHorse.name} {myBetHorse.isEliminated ? "s'est fait éliminer" : 'a couru comme une chèvre'}
              </div>
              <div className="mt-3 font-headline text-lg font-light tracking-[0.3em] text-derby-cream">TU BOIS</div>
              <div className="font-terminal text-[4.6rem] leading-none text-derby-red">{myRoundSips}</div>
              <div className="font-headline text-xl tracking-[0.35em] text-derby-cream">
                GORGÉE{myRoundSips > 1 ? 'S' : ''}
              </div>
              {myRound && <RoundBreakdown summary={myRound} />}
            </div>
          )
        ) : (
          <div className="pt-2 text-center font-body text-derby-smoke">
            <p className="font-display text-2xl text-derby-parch">Spectateur</p>
            <p className="mt-1 text-sm">Pas de ticket, pas de dégâts. Courage à la prochaine ?</p>
          </div>
        )}

        {/* Who drinks what — on every phone */}
        <div className="paper ticket-edge w-full max-w-sm rounded-lg px-5 py-5 animate-rise" style={{ animationDelay: '0.2s' }}>
          <div className="border-b-2 border-dashed border-derby-coal/40 pb-1.5 text-center">
            <span className="font-headline text-2xl font-medium tracking-[0.2em] text-derby-coal">QUI BOIT QUOI ?</span>
            <span className="mt-1 block font-hand text-lg text-derby-coal/60">la tournée officielle</span>
          </div>
          <div className="mt-2 space-y-1">
            {losers.length === 0 && (
              <div className="text-center font-hand text-xl text-derby-coal/70">personne ne boit... louche.</div>
            )}
            {losers.map((l) => (
              <div key={l.pseudo} className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: l.color }} />
                  <span className={`truncate font-hand text-2xl font-bold text-derby-coal ${l.pseudo === player?.pseudo ? 'underline decoration-derby-red decoration-2' : ''}`}>
                    {l.pseudo}
                    {l.pseudo === player?.pseudo ? ' (toi)' : ''}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end text-right">
                  {l.betSavedBySecondPlace && (
                    <span className="font-headline text-[11px] font-bold tracking-[.08em] text-derby-green">2e · MISE SAUVÉE</span>
                  )}
                  <span className={`whitespace-nowrap font-body text-base font-bold ${l.sips > 0 ? 'text-derby-red' : 'text-derby-green'}`}>
                    {l.sips} gorgée{l.sips > 1 ? 's' : ''}
                  </span>
                  {(l.betSavedBySecondPlace || l.eventSips > 0 || l.receivedSips > 0) && (
                    <span className="whitespace-nowrap font-mono text-[9px] text-derby-coal/60">
                      mise {l.betSips} · événement {l.eventSips} · reçues {l.receivedSips}
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>

        {player && (
          <div className="flex gap-6 pb-2 font-mono text-xs text-derby-smoke">
            <span>🍺 total bues : {player.totalSipsDrunk}</span>
            <span>🎁 total offertes : {player.totalSipsGiven}</span>
          </div>
        )}
      </div>
    </div>
  )
}

function RoundBreakdown({ summary, saved = false }: { summary: RoundDrinkSummary; saved?: boolean }) {
  return (
    <div className="mt-4 space-y-1.5 rounded-xl border border-derby-cream/20 bg-black/20 px-4 py-3 text-left font-body text-sm text-derby-cream/85">
      <div className="flex justify-between gap-3"><span>{saved ? 'Mise sauvée' : 'Mise à boire'}</span><b>{summary.betSips} gorgée{summary.betSips > 1 ? 's' : ''}</b></div>
      <div className="flex justify-between gap-3"><span>Événements / sanctions</span><b>{summary.eventSips}</b></div>
      <div className="flex justify-between gap-3"><span>Gorgées reçues</span><b>{summary.receivedSips}</b></div>
      <div className="flex justify-between gap-3 border-t border-derby-cream/20 pt-1.5 text-derby-gold"><span>Total à boire</span><b>{summary.sips} gorgée{summary.sips > 1 ? 's' : ''}</b></div>
    </div>
  )
}

/**
 * The winner's power: allocate the earned sips to chosen players (tap a name
 * to add one, tap its row to remove, or let the roulette pick), then send —
 * every victim's phone gets the "X t'envoie N gorgées" notification.
 */
function WinnerPanel({
  state,
  player,
  totalSips,
  onDistribute,
}: {
  state: GameState
  player: Player | null
  totalSips: number
  onDistribute: (allocations: { pseudo: string; sips: number }[]) => void
}) {
  const victims = useMemo(
    () => state.players.map((p) => p.pseudo).filter((p) => p !== player?.pseudo),
    [state.players, player],
  )
  const [assignments, setAssignments] = useState<Record<string, number>>({})
  const [spinning, setSpinning] = useState(false)
  const [display, setDisplay] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pausedRef = useRef(state.isGamePaused)
  pausedRef.current = state.isGamePaused

  const assigned = Object.values(assignments).reduce((a, b) => a + b, 0)
  const remaining = totalSips - assigned

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current)
  }, [])

  const addTo = (pseudo: string) => {
    if (pausedRef.current || sent || remaining <= 0) return
    setAssignments((a) => ({ ...a, [pseudo]: (a[pseudo] ?? 0) + 1 }))
    if (navigator.vibrate) navigator.vibrate(40)
  }

  const removeFrom = (pseudo: string) => {
    if (pausedRef.current || sent) return
    setAssignments((a) => {
      const n = (a[pseudo] ?? 0) - 1
      const next = { ...a }
      if (n <= 0) delete next[pseudo]
      else next[pseudo] = n
      return next
    })
  }

  const spin = () => {
    if (pausedRef.current || spinning || sent || remaining <= 0 || victims.length === 0) return
    setSpinning(true)
    let ticks = 0
    const total = 12 + Math.floor(Math.random() * 6)
    timerRef.current = setInterval(() => {
      if (pausedRef.current) return
      ticks++
      setDisplay(victims[ticks % victims.length])
      if (ticks >= total) {
        if (timerRef.current) clearInterval(timerRef.current)
        setSpinning(false)
        setDisplay(null)
        addTo(victims[total % victims.length])
        if (navigator.vibrate) navigator.vibrate([80, 40, 120])
      }
    }, 85)
  }

  const send = () => {
    if (pausedRef.current || sent || assigned === 0) return
    onDistribute(Object.entries(assignments).map(([pseudo, sips]) => ({ pseudo, sips })))
    setSent(true)
    if (navigator.vibrate) navigator.vibrate([120, 60, 200])
  }

  return (
    <div
      className="w-full max-w-sm rounded-2xl border-4 border-derby-gold bg-gradient-to-b from-derby-gold/25 to-derby-ink px-5 py-5 text-center shadow-lg animate-rise"
      style={{ animationDelay: '0.1s' }}
    >
      <div className="font-display text-3xl text-derby-gold">Jackpot !</div>
      <div className="mt-1 font-hand text-xl text-derby-cream/90">à toi de régaler la tribune 👑</div>

      <div className="mt-2 flex items-baseline justify-center gap-2">
        <span className="font-terminal text-[3.6rem] leading-none text-derby-gold">{remaining}</span>
        <span className="font-headline text-base tracking-[0.2em] text-derby-cream">
          GORGÉE{remaining > 1 ? 'S' : ''} À ENVOYER
        </span>
      </div>

      {victims.length === 0 ? (
        <p className="mt-3 font-body text-sm text-derby-cream/80">
          Personne d&apos;autre en tribune... distribue de vive voix !
        </p>
      ) : sent ? (
        <div className="mx-auto mt-3 w-fit animate-stamp border-4 border-derby-green px-4 py-1 font-headline text-xl tracking-[0.2em] text-derby-green">
          TOURNÉE ENVOYÉE ✓
        </div>
      ) : (
        <>
          {/* victims */}
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {victims.map((v) => (
              <button
                key={v}
                onClick={() => addTo(v)}
                disabled={remaining <= 0}
                className="btn-big rounded-full border-2 border-derby-cream/40 bg-derby-ink px-4 py-1.5 font-hand text-xl font-bold text-derby-cream disabled:opacity-40"
              >
                {v} {assignments[v] ? <span className="text-derby-red">×{assignments[v]}</span> : '+'}
              </button>
            ))}
            <button
              onClick={spin}
              disabled={spinning || remaining <= 0}
              className="btn-big rounded-full border-2 border-derby-gold/60 bg-derby-gold/15 px-4 py-1.5 font-headline text-sm tracking-[0.1em] text-derby-gold disabled:opacity-40"
            >
              {spinning ? <span className="font-hand text-lg">{display}...</span> : '🎲 AU HASARD'}
            </button>
          </div>
          <p className="mt-1.5 font-body text-[11px] text-derby-cream/60">
            tape un nom pour ajouter une gorgée · tape sa ligne pour retirer
          </p>

          {/* allocations */}
          {assigned > 0 && (
            <div className="mt-2 border-t border-dashed border-derby-cream/30 pt-1.5 text-left">
              {Object.entries(assignments)
                .sort((a, b) => b[1] - a[1])
                .map(([pseudo, n]) => (
                  <button
                    key={pseudo}
                    onClick={() => removeFrom(pseudo)}
                    className="flex w-full items-baseline justify-between"
                  >
                    <span className="font-hand text-2xl font-bold text-derby-cream">{pseudo}</span>
                    <span className="font-terminal text-xl text-derby-red">{n} 🍺</span>
                  </button>
                ))}
            </div>
          )}

          <button
            onClick={send}
            disabled={assigned === 0}
            className="btn-big mt-3 w-full rounded-xl bg-derby-red py-3.5 font-headline text-xl tracking-[0.15em] text-derby-cream shadow-lg disabled:opacity-40"
          >
            ENVOYER LA TOURNÉE 🍺
          </button>
        </>
      )}
    </div>
  )
}
