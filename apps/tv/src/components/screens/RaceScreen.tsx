'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { GameEvent, GameState, Horse, Player } from '@last-sip-derby/shared'
import { RaceEngine } from '../../race/engine'
import { SilkDot, useNow } from '../shared'

interface Props {
  state: GameState
  activeEvent: GameEvent | null
  eventResolution: { horseEliminated: boolean; horseName: string } | null
  finished: boolean
}

function leadingHorse(horses: Horse[]): Horse | null {
  let best: Horse | null = null
  for (const h of horses) {
    if (h.isEliminated) continue
    if (!best || h.position > best.position) best = h
  }
  return best
}

export function RaceScreen({ state, activeEvent, eventResolution, finished }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<RaceEngine | null>(null)
  const [showStart, setShowStart] = useState(true)
  const celebratedRef = useRef(false)
  // phaseStartedAt flips to the RESULTS timestamp while we hold the finish
  // view — pin the race start so the clock stays meaningful.
  const raceStartRef = useRef(state.phaseStartedAt)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const engine = new RaceEngine(canvas, state.raceNumber * 1013 + 7)
    engineRef.current = engine
    engine.start()
    const t = setTimeout(() => setShowStart(false), 2400)
    return () => {
      clearTimeout(t)
      engine.destroy()
      engineRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    engineRef.current?.ingest(state.horses, state.raceProgress, state.racePaused)
  }, [state])

  useEffect(() => {
    const spotlight = activeEvent && !activeEvent.resolved ? activeEvent.targetHorseId : null
    engineRef.current?.setSpotlight(spotlight)
  }, [activeEvent])

  const winner = useMemo(() => (finished ? leadingHorse(state.horses) : null), [finished, state.horses])

  useEffect(() => {
    if (finished && !celebratedRef.current) {
      celebratedRef.current = true
      engineRef.current?.setSpotlight(null)
      engineRef.current?.celebrate(winner?.id ?? null)
    }
  }, [finished, winner])

  const ranking = useMemo(() => {
    const alive = state.horses.filter((h) => !h.isEliminated).sort((a, b) => b.position - a.position)
    const dead = state.horses.filter((h) => h.isEliminated)
    return [...alive, ...dead]
  }, [state.horses])

  // "X prend la tête !" callout, synced with the engine's punch-zoom
  const [leadChange, setLeadChange] = useState<{ name: string; color: string; key: number } | null>(null)
  const prevLeaderRef = useRef<string | null>(null)
  useEffect(() => {
    const leader = ranking[0]
    if (!leader || leader.isEliminated) return
    const prev = prevLeaderRef.current
    prevLeaderRef.current = leader.id
    if (prev && prev !== leader.id && leader.position > 12 && leader.position < 82 && !state.racePaused && !finished) {
      setLeadChange({ name: leader.name, color: leader.color, key: Date.now() })
      const timer = setTimeout(() => setLeadChange(null), 1700)
      return () => clearTimeout(timer)
    }
  }, [ranking, state.racePaused, finished])

  const winnerBettors = useMemo(() => {
    if (!winner) return []
    return state.players.filter((p) => p.currentBet?.horseId === winner.id).map((p) => p.pseudo)
  }, [winner, state.players])

  return (
    <div className="relative h-full overflow-hidden bg-derby-night">
      <canvas ref={canvasRef} className="absolute inset-0" />

      {/* ── Top bar ── */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between px-8 pt-5">
        <div className="flex items-center gap-4 rounded-xl bg-derby-night/75 px-5 py-3 backdrop-blur-sm">
          <span className="relative flex h-4 w-4">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-derby-red opacity-75" />
            <span className="relative inline-flex h-4 w-4 rounded-full bg-derby-red" />
          </span>
          <span className="font-headline text-2xl tracking-[0.25em] text-derby-cream">EN DIRECT</span>
          <span className="font-headline text-2xl tracking-[0.25em] text-derby-gold">COURSE N°{state.raceNumber}</span>
        </div>
        <RaceClock startedAt={raceStartRef.current} frozen={finished} />
      </div>

      {/* ── Minimap ── */}
      <div className="pointer-events-none absolute left-1/2 top-[9vh] z-20 w-[44vw] -translate-x-1/2">
        <div className="relative h-[4.6vh] rounded-full border-2 border-derby-gold/50 bg-derby-night/75 backdrop-blur-sm">
          <div className="absolute right-[2.2vh] top-1/2 h-[60%] w-[3px] -translate-y-1/2 bg-derby-cream/70" />
          <div className="absolute right-[1vh] top-1/2 -translate-y-1/2 font-headline text-[2vh] text-derby-cream/80">🏁</div>
          {state.horses.map((h) => (
            <div
              key={h.id}
              className="absolute top-1/2 flex h-[3.4vh] w-[3.4vh] -translate-y-1/2 items-center justify-center rounded-full font-headline text-[1.9vh] text-white shadow"
              style={{
                left: `calc(${Math.min(96, 1 + h.position * 0.95)}% - 1.7vh)`,
                background: h.isEliminated ? '#4a4a48' : h.color,
                opacity: h.isEliminated ? 0.55 : 1,
                transition: 'left 140ms linear',
                zIndex: Math.round(h.position),
              }}
            >
              {h.isEliminated ? '✕' : h.lane + 1}
            </div>
          ))}
        </div>
      </div>

      {/* ── Live ranking ── */}
      <div className="pointer-events-none absolute left-8 top-[20vh] z-20 w-[19vw] space-y-2">
        {ranking.map((h, i) => (
          <motion.div
            key={h.id}
            layout
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            className={`flex items-center gap-3 rounded-lg px-4 py-2 backdrop-blur-sm ${
              h.isEliminated ? 'bg-derby-night/50 opacity-50' : i === 0 ? 'bg-derby-gold/25' : 'bg-derby-night/70'
            }`}
          >
            <span className="w-8 font-headline text-[2.8vh] text-derby-gold">{h.isEliminated ? '—' : `${i + 1}${i === 0 ? 'ᵉʳ' : 'ᵉ'}`}</span>
            <SilkDot color={h.isEliminated ? '#4a4a48' : h.color} size={16} />
            <span className={`min-w-0 flex-1 truncate font-body text-[2vh] font-bold text-derby-cream ${h.isEliminated ? 'line-through' : ''}`}>
              {h.name}
            </span>
            <span className="font-terminal text-[2vh] text-derby-smoke">{h.odds}G</span>
          </motion.div>
        ))}
      </div>

      {/* ── Lead-change callout ── */}
      <AnimatePresence>
        {leadChange && !activeEvent && (
          <motion.div
            key={leadChange.key}
            initial={{ y: 40, opacity: 0, scale: 0.85 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -20, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 22 }}
            className="pointer-events-none absolute left-1/2 top-[16vh] z-30 -translate-x-1/2"
          >
            <div
              className="rounded-xl border-2 px-7 py-2 font-headline text-[2.8vh] font-medium tracking-[0.2em] text-derby-cream shadow-deep backdrop-blur-sm"
              style={{ borderColor: leadChange.color, background: 'rgba(14,10,6,0.82)' }}
            >
              🔥 {leadChange.name.toUpperCase()} PREND LA TÊTE !
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Start flash ── */}
      <AnimatePresence>
        {showStart && (
          <motion.div
            initial={{ scale: 3, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 18 }}
            className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center"
          >
            <div className="text-engraved font-display text-[10vw] drop-shadow-2xl">PARTEZ !</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Event banner ── */}
      <AnimatePresence>
        {activeEvent && !finished && (
          <EventBanner
            key={activeEvent.id}
            event={activeEvent}
            resolution={eventResolution}
            players={state.players}
          />
        )}
      </AnimatePresence>

      {/* ── Photo finish ── */}
      {finished && (
        <>
          <div className="pointer-events-none absolute inset-0 z-40 animate-[photo-flash_2s_ease-out_forwards] bg-white" />
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 1.1, type: 'spring', stiffness: 160, damping: 20 }}
            className="pointer-events-none absolute inset-x-0 bottom-[8vh] z-40 flex justify-center"
          >
            {winner && (
              <div className="paper -rotate-1 rounded-2xl px-12 py-6 text-center">
                <div className="font-headline text-2xl tracking-[0.4em] text-derby-red">PHOTO FINISH — VAINQUEUR</div>
                <div className="mt-1 flex items-center justify-center gap-4">
                  <span
                    className="flex h-14 w-14 items-center justify-center rounded-xl font-headline text-4xl text-white"
                    style={{ background: winner.color }}
                  >
                    {winner.lane + 1}
                  </span>
                  <span className="font-display text-6xl text-derby-coal">{winner.name}</span>
                </div>
                <div className="mt-2 font-mono text-lg text-derby-coal/80">
                  {winnerBettors.length > 0
                    ? `${winnerBettors.join(', ')} distribue${winnerBettors.length > 1 ? 'nt' : ''} ${winner.odds * 2} gorgées !`
                    : 'Personne ne l’avait joué... tout le monde trinque !'}
                </div>
              </div>
            )}
          </motion.div>
        </>
      )}
    </div>
  )
}

function RaceClock({ startedAt, frozen }: { startedAt: number; frozen: boolean }) {
  const now = useNow(120)
  const frozenAtRef = useRef<number | null>(null)
  if (frozen && frozenAtRef.current === null) frozenAtRef.current = now
  if (!frozen) frozenAtRef.current = null
  const elapsed = Math.max(0, ((frozenAtRef.current ?? now) - startedAt) / 1000)
  const m = Math.floor(elapsed / 60)
  const s = (elapsed % 60).toFixed(1).padStart(4, '0')
  return (
    <div className="rounded-xl bg-derby-night/75 px-5 py-3 font-terminal text-3xl text-derby-gold backdrop-blur-sm">
      ⏱ {m}:{s}
    </div>
  )
}

function EventBanner({
  event,
  resolution,
  players,
}: {
  event: GameEvent
  resolution: { horseEliminated: boolean; horseName: string } | null
  players: Player[]
}) {
  const now = useNow(200)
  const voteSeconds = Math.max(0, Math.ceil((event.votingDeadline - now) / 1000))
  const votes = Object.values(event.votes)
  const yes = votes.filter(Boolean).length
  const no = votes.length - yes
  const totalVoters = event.nonAffectedPlayerIds.length
  const suspects = event.affectedPlayerIds
    .map((id) => players.find((p) => p.id === id)?.pseudo)
    .filter((p): p is string => !!p)

  return (
    <motion.div
      initial={{ y: -260, rotate: -2 }}
      animate={{ y: 0, rotate: -1 }}
      exit={{ y: -300, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 210, damping: 22 }}
      className="absolute left-1/2 top-[16vh] z-30 w-[46vw] -translate-x-1/2"
    >
      <div className="paper relative rounded-2xl px-8 py-6">
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-md bg-derby-red px-6 py-1 font-headline text-xl tracking-[0.3em] text-derby-cream shadow-deep">
          INCIDENT DE COURSE
        </div>
        <div className="mt-2 text-center font-display text-4xl text-derby-red">{event.title}</div>
        <div className="mt-3 text-center font-body text-2xl font-bold leading-snug text-derby-coal">
          {event.description}
        </div>

        {suspects.length > 0 && (
          <div className="mx-auto mt-4 w-fit rounded-lg border-2 border-dashed border-derby-red/60 bg-derby-red/10 px-6 py-2 text-center">
            <div className="font-headline text-lg font-medium tracking-[0.25em] text-derby-red">
              🍺 SES PARIEURS DOIVENT BOIRE {event.sipsAmount} GORGÉE{event.sipsAmount > 1 ? 'S' : ''} — MAINTENANT
            </div>
            <div className="font-hand text-3xl font-bold leading-tight text-derby-coal">
              {suspects.join(' · ')}
            </div>
            <div className="font-body text-sm text-derby-coal/70">
              Public : surveillez-les. Ils boivent vraiment ? Sauvez le canasson. Sinon... éliminé.
            </div>
          </div>
        )}

        {!resolution ? (
          <div className="mt-5 flex items-center justify-center gap-8">
            <div className="text-center">
              <div className="font-headline text-lg font-medium tracking-[0.2em] text-derby-green">ONT BU → SAUVÉ</div>
              <div className="font-terminal text-5xl text-derby-green">{yes}</div>
            </div>
            <div className="text-center">
              <div className="font-headline text-lg tracking-[0.2em] text-derby-coal/70">
                LE PUBLIC VOTE · {votes.length}/{totalVoters}
              </div>
              <div className="font-terminal text-6xl leading-none text-derby-coal">{voteSeconds}s</div>
            </div>
            <div className="text-center">
              <div className="font-headline text-lg font-medium tracking-[0.2em] text-derby-red">PAS BU → ÉLIMINÉ</div>
              <div className="font-terminal text-5xl text-derby-red">{no}</div>
            </div>
          </div>
        ) : (
          <div className="mt-5 flex justify-center">
            <div
              className={`animate-stamp rounded-lg border-4 px-8 py-2 font-display text-4xl ${
                resolution.horseEliminated
                  ? 'border-derby-red text-derby-red'
                  : 'border-derby-green text-derby-green'
              }`}
            >
              {resolution.horseEliminated ? 'ÉLIMINÉ !' : 'IL REPART !'}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  )
}
