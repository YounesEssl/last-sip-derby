'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  MINI_GAME_DURATIONS,
  type MiniGameState,
  type MiniGameType,
} from '@last-sip-derby/shared'
import { MiniGameBoard } from '@/components/MiniGameBoard'
import { mobileUrl } from '@/components/shared'
import {
  GAME_ORDER,
  GAME_SPECS,
  SCENARIOS,
  applyLabAction,
  cloneMiniGame,
  createBotActions,
  createLabGame,
  resolveLabGame,
  type LabScenario,
} from './lab'

const LAB_CHANNEL = 'aperodrome:minigame-lab'

const VIEWPORTS = [
  { id: 'se', label: 'Petit téléphone · 320 × 568', width: 320, height: 568 },
  { id: 'standard', label: 'Téléphone standard · 390 × 844', width: 390, height: 844 },
  { id: 'large', label: 'Grand téléphone · 430 × 932', width: 430, height: 932 },
] as const

const SPEEDS = [
  { value: 1100, label: 'Bots lents' },
  { value: 650, label: 'Bots normaux' },
  { value: 300, label: 'Bots rapides' },
] as const

const DURATIONS = [5_000, 10_000, 15_000, 20_000, 30_000, 45_000, 60_000] as const

interface LabLog {
  id: number
  at: number
  actor: string
  label: string
  tone: 'ok' | 'warn' | 'info'
}

function formatMs(value: number) {
  const seconds = Math.max(0, Math.ceil(value / 1000))
  return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`
}

function playerStateLabel(game: MiniGameState, playerId: string) {
  const row = game.players.find((candidate) => candidate.playerId === playerId)
  if (!row) return 'HORS PARTIE'
  if (row.eliminated) return 'ÉLIMINÉ'
  if (row.finishedAt) return 'QUALIFIÉ'
  return 'EN JEU'
}

function metric(game: MiniGameState, playerId: string) {
  const row = game.players.find((candidate) => candidate.playerId === playerId)
  if (!row) return '—'
  if (game.type === 'CLICKER') return `${row.score} clics`
  if (game.type === 'PENALTY') return `${row.score} buts · ${row.progress}/10 tirs`
  if (game.type === 'PRESSURE') return `${row.score.toFixed(1)} %`
  if (game.type === 'ORDER') return `${Math.min(row.progress, 16)}/16`
  if (game.type === 'CAPITAL') return `${Math.max(0, row.lives)} vie${row.lives > 1 ? 's' : ''}`
  return row.finishedAt ? 'Terminé' : 'En cours'
}

function panelClass(extra = '') {
  return `rounded-xl border border-derby-gold/25 bg-derby-night/85 shadow-deep ${extra}`
}

export default function MiniGamesLabPage() {
  const [game, setGame] = useState<MiniGameState | null>(null)
  const gameRef = useRef<MiniGameState | null>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const mainRef = useRef<HTMLElement>(null)
  const logSequence = useRef(0)
  const initialized = useRef(false)
  const initialScrollRestored = useRef(false)

  const [type, setType] = useState<MiniGameType>('GRID')
  const [scenario, setScenario] = useState<LabScenario>('fresh')
  const [playerCount, setPlayerCount] = useState(4)
  const [durationMs, setDurationMs] = useState(MINI_GAME_DURATIONS.GRID)
  const [seed, setSeed] = useState(2202)
  const [selectedPlayerId, setSelectedPlayerId] = useState('lab-player-1')
  const [botsEnabled, setBotsEnabled] = useState(false)
  const [botSpeed, setBotSpeed] = useState(650)
  const [latencyMs, setLatencyMs] = useState(0)
  const [viewportId, setViewportId] = useState<(typeof VIEWPORTS)[number]['id']>('standard')
  const [phoneUrl, setPhoneUrl] = useState('')
  const [phoneReady, setPhoneReady] = useState(false)
  const [clock, setClock] = useState(Date.now())
  const [logs, setLogs] = useState<LabLog[]>([])
  const [checks, setChecks] = useState<Record<string, boolean>>({})
  const [checksLoaded, setChecksLoaded] = useState(false)
  const [notes, setNotes] = useState('')
  const [copyStatus, setCopyStatus] = useState('')

  const addLog = useCallback((actor: string, label: string, tone: LabLog['tone'] = 'info') => {
    const entry: LabLog = { id: ++logSequence.current, at: Date.now(), actor, label, tone }
    setLogs((current) => [entry, ...current].slice(0, 40))
  }, [])

  const commitGame = useCallback((next: MiniGameState) => {
    gameRef.current = next
    setGame(next)
  }, [])

  const loadFixture = useCallback((
    nextType: MiniGameType,
    nextScenario: LabScenario,
    nextCount: number,
    nextSeed: number,
    nextDuration: number,
  ) => {
    const next = createLabGame(nextType, {
      playerCount: nextCount,
      seed: nextSeed,
      durationMs: nextDuration,
      scenario: nextScenario,
    })
    commitGame(next)
    setSelectedPlayerId(next.players[0]?.playerId ?? '')
    addLog('LAB', `${GAME_SPECS[nextType].label} · ${SCENARIOS.find((item) => item.id === nextScenario)?.label}`, 'info')
  }, [addLog, commitGame])

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true
    loadFixture('GRID', 'fresh', 4, 2202, MINI_GAME_DURATIONS.GRID)
  }, [loadFixture])

  useEffect(() => {
    setPhoneUrl(`${mobileUrl().replace(/\/$/, '')}/mini-games?embedded=1`)
  }, [])

  useEffect(() => {
    if (!game || !phoneUrl) return
    const frame = window.requestAnimationFrame(() => {
      if (mainRef.current) mainRef.current.scrollTop = 0
    })
    return () => window.cancelAnimationFrame(frame)
  }, [game, phoneUrl])

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('aperodrome-minigame-lab-checks')
      if (saved) setChecks(JSON.parse(saved) as Record<string, boolean>)
      const savedNotes = window.localStorage.getItem('aperodrome-minigame-lab-notes')
      if (savedNotes) setNotes(savedNotes)
    } catch {
      // The lab remains fully usable if private browsing blocks persistence.
    } finally {
      setChecksLoaded(true)
    }
  }, [])

  useEffect(() => {
    if (!checksLoaded) return
    try {
      window.localStorage.setItem('aperodrome-minigame-lab-checks', JSON.stringify(checks))
      window.localStorage.setItem('aperodrome-minigame-lab-notes', notes)
    } catch {
      // Ignore storage quotas and private-mode restrictions.
    }
  }, [checks, checksLoaded, notes])

  const dispatchAction = useCallback((playerId: string, action: string, value?: number | string, source = 'TÉLÉPHONE') => {
    const current = gameRef.current
    if (!current) return
    const actor = current.players.find((row) => row.playerId === playerId)?.pseudo ?? playerId
    const outcome = applyLabAction(current, playerId, action, value)
    commitGame(outcome.game)
    const suffix = value === undefined ? '' : ` · ${String(value)}`
    addLog(actor, `${source} · ${action}${suffix} — ${outcome.reason}`, outcome.accepted ? (outcome.changed ? 'ok' : 'warn') : 'warn')
    if (outcome.loserIds.length) {
      const losers = outcome.game.players.filter((row) => outcome.loserIds.includes(row.playerId)).map((row) => row.pseudo)
      addLog('ARBITRE', `Résolution anticipée · éliminé${losers.length > 1 ? 's' : ''} : ${losers.join(', ') || 'personne'}`, 'warn')
    }
  }, [addLog, commitGame])

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return
      const data = event.data as { channel?: string; kind?: string; playerId?: string; action?: string; value?: number | string }
      if (data?.channel !== LAB_CHANNEL) return
      if (data.kind === 'ready') {
        setPhoneReady(true)
        return
      }
      if (data.kind === 'action' && data.playerId && data.action) {
        window.setTimeout(() => dispatchAction(data.playerId!, data.action!, data.value), latencyMs)
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [dispatchAction, latencyMs])

  useEffect(() => {
    if (!game || !phoneReady || !phoneUrl || !iframeRef.current?.contentWindow) return
    const targetOrigin = new URL(phoneUrl).origin
    iframeRef.current.contentWindow.postMessage({
      channel: LAB_CHANNEL,
      kind: 'state',
      game,
      playerId: selectedPlayerId,
    }, targetOrigin)
  }, [game, phoneReady, phoneUrl, selectedPlayerId])

  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = Date.now()
      setClock(now)
      const current = gameRef.current
      if (!current || current.status !== 'PLAYING' || now < current.endsAt) return
      const outcome = resolveLabGame(current, now)
      commitGame(outcome.game)
      const losers = outcome.game.players.filter((row) => outcome.loserIds.includes(row.playerId)).map((row) => row.pseudo)
      addLog('CHRONO', `Temps écoulé · éliminé${losers.length > 1 ? 's' : ''} : ${losers.join(', ') || 'personne (égalité totale)'}`, losers.length ? 'warn' : 'ok')
    }, 200)
    return () => window.clearInterval(timer)
  }, [addLog, commitGame])

  useEffect(() => {
    if (!botsEnabled) return
    const timer = window.setInterval(() => {
      const current = gameRef.current
      if (!current) return
      const actions = createBotActions(current, selectedPlayerId)
      if (!actions.length) return
      let next = current
      let resolved = false
      for (const action of actions) {
        if (next.status !== 'PLAYING') break
        const outcome = applyLabAction(next, action.playerId, action.action, action.value)
        next = outcome.game
        if (outcome.loserIds.length) resolved = true
      }
      if (next !== current) commitGame(next)
      if (resolved) addLog('BOTS', 'La progression des adversaires a déclenché les résultats.', 'warn')
    }, botSpeed)
    return () => window.clearInterval(timer)
  }, [addLog, botSpeed, botsEnabled, commitGame, selectedPlayerId])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.matches('input, textarea, select, button')) return
      if (event.key.toLowerCase() === 'r') loadFixture(type, scenario, playerCount, seed + 1, durationMs)
      if (event.key.toLowerCase() === 'e') {
        const current = gameRef.current
        if (!current) return
        const outcome = resolveLabGame(current)
        commitGame(outcome.game)
        addLog('RACCOURCI', 'Résultats forcés avec la touche E.', 'warn')
      }
      if (event.key.toLowerCase() === 'n') {
        const index = GAME_ORDER.indexOf(type)
        const nextType = GAME_ORDER[(index + 1) % GAME_ORDER.length]
        setType(nextType)
        setScenario('fresh')
        setDurationMs(MINI_GAME_DURATIONS[nextType])
        loadFixture(nextType, 'fresh', playerCount, seed + 1, MINI_GAME_DURATIONS[nextType])
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [addLog, commitGame, durationMs, loadFixture, playerCount, scenario, seed, type])

  const viewport = VIEWPORTS.find((item) => item.id === viewportId) ?? VIEWPORTS[1]
  const selectedPlayer = game?.players.find((row) => row.playerId === selectedPlayerId)
  const currentChecks = GAME_SPECS[type].checks
  const completedChecks = useMemo(() => Object.values(checks).filter(Boolean).length, [checks])
  const totalChecks = GAME_ORDER.length * 4
  const currentCompleted = currentChecks.filter((_, index) => checks[`${type}:${index}`]).length
  const remainingMs = game ? (game.status === 'RESULTS' ? (game.resultsEndAt ?? clock) - clock : game.endsAt - clock) : 0

  const chooseType = (nextType: MiniGameType) => {
    const nextDuration = MINI_GAME_DURATIONS[nextType]
    setType(nextType)
    setScenario('fresh')
    setDurationMs(nextDuration)
    setSeed((current) => current + 1)
    loadFixture(nextType, 'fresh', playerCount, seed + 1, nextDuration)
  }

  const chooseScenario = (nextScenario: LabScenario) => {
    const nextCount = nextScenario === 'crowd' ? 12 : playerCount
    setScenario(nextScenario)
    if (nextScenario === 'crowd') setPlayerCount(12)
    setSeed((current) => current + 1)
    loadFixture(type, nextScenario, nextCount, seed + 1, durationMs)
  }

  const changePlayerCount = (amount: number) => {
    const nextCount = Math.max(1, Math.min(12, playerCount + amount))
    setPlayerCount(nextCount)
    setScenario('fresh')
    setSeed((current) => current + 1)
    loadFixture(type, 'fresh', nextCount, seed + 1, durationMs)
  }

  const forcePlayer = (mode: 'qualified' | 'eliminated' | 'active') => {
    const current = gameRef.current
    if (!current) return
    const next = cloneMiniGame(current)
    const row = next.players.find((candidate) => candidate.playerId === selectedPlayerId)
    if (!row) return
    row.eliminated = mode === 'eliminated'
    row.finishedAt = mode === 'active' ? null : Date.now()
    row.progress = mode === 'active' ? 0 : 100
    if (mode === 'active') {
      row.score = 0
      row.lives = 2
      next.status = 'PLAYING'
      next.resultsEndAt = null
      next.endsAt = Date.now() + durationMs
    }
    commitGame(next)
    addLog('LAB', `${row.pseudo} affiché en état « ${mode} ».`, mode === 'eliminated' ? 'warn' : 'info')
  }

  const addTenSeconds = () => {
    const current = gameRef.current
    if (!current) return
    const next = cloneMiniGame(current)
    if (next.status === 'RESULTS') next.resultsEndAt = (next.resultsEndAt ?? Date.now()) + 10_000
    else next.endsAt += 10_000
    commitGame(next)
    addLog('CHRONO', '10 secondes ajoutées.', 'info')
  }

  const forceResults = () => {
    const current = gameRef.current
    if (!current) return
    const outcome = resolveLabGame(current)
    commitGame(outcome.game)
    const losers = outcome.game.players.filter((row) => outcome.loserIds.includes(row.playerId)).map((row) => row.pseudo)
    addLog('ARBITRE', `Résultats forcés · ${losers.join(', ') || 'aucun perdant'}.`, losers.length ? 'warn' : 'ok')
  }

  const validateCurrent = () => {
    setChecks((current) => {
      const next = { ...current }
      currentChecks.forEach((_, index) => { next[`${type}:${index}`] = true })
      return next
    })
  }

  const buildReport = () => ({
    generatedAt: new Date().toISOString(),
    page: window.location.href,
    miniGame: type,
    scenario,
    viewport,
    latencyMs,
    botsEnabled,
    playerCount: game?.players.length ?? 0,
    selectedPlayer: selectedPlayer?.pseudo ?? null,
    checklist: Object.fromEntries(GAME_ORDER.map((gameType) => [gameType, GAME_SPECS[gameType].checks.map((label, index) => ({ label, checked: !!checks[`${gameType}:${index}`] }))])),
    notes,
    state: game,
    recentEvents: logs.slice(0, 20).map((entry) => ({ at: new Date(entry.at).toISOString(), actor: entry.actor, label: entry.label })),
    userAgent: navigator.userAgent,
  })

  const copyReport = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(buildReport(), null, 2))
      setCopyStatus('Rapport copié')
    } catch {
      setCopyStatus('Copie refusée par le navigateur')
    }
    window.setTimeout(() => setCopyStatus(''), 2_500)
  }

  const downloadReport = () => {
    const blob = new Blob([JSON.stringify(buildReport(), null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `aperodrome-mini-jeux-${type.toLowerCase()}-${Date.now()}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  if (!game) {
    return <div className="flex h-full items-center justify-center bg-derby-night font-terminal text-3xl text-derby-gold">PRÉPARATION DU LABORATOIRE…</div>
  }

  return (
    <main ref={mainRef} className="relative z-10 h-full cursor-auto select-text overflow-auto bg-[#090d0a] text-derby-cream" data-testid="mini-games-lab" style={{ overflowAnchor: 'none' }}>
      <div className="min-w-[1180px] p-5">
        <header className="mb-4 flex items-center justify-between gap-6 border-b border-derby-gold/30 pb-4">
          <div className="flex min-w-0 items-center gap-5">
            <Link href="/" className="shrink-0 rounded-lg border border-derby-gold/40 px-3 py-2 font-headline text-sm tracking-[.18em] text-derby-gold transition hover:bg-derby-gold/10">← COURSE</Link>
            <div>
              <div className="font-headline text-xs tracking-[.45em] text-derby-red">OUTIL QUALITÉ · VUE TV + TÉLÉPHONE RÉELS</div>
              <h1 className="font-display text-4xl text-derby-cream">Laboratoire des mini-jeux</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-lg border border-derby-gold/30 bg-black/30 px-4 py-2 text-right">
              <div className="font-headline text-xs tracking-[.25em] text-derby-smoke">COUVERTURE MANUELLE</div>
              <div className="font-terminal text-3xl text-derby-gold">{completedChecks}/{totalChecks}</div>
            </div>
            <div className={`rounded-lg border px-4 py-2 text-right ${phoneReady ? 'border-derby-green/70 bg-derby-green/15' : 'border-derby-red/60 bg-derby-red/10'}`}>
              <div className="font-headline text-xs tracking-[.25em] text-derby-smoke">TÉLÉPHONE</div>
              <div className={`font-terminal text-xl ${phoneReady ? 'text-emerald-300' : 'text-derby-red'}`}>{phoneReady ? 'SYNCHRONISÉ' : 'CONNEXION…'}</div>
            </div>
          </div>
        </header>

        <section className="mb-4 grid grid-cols-8 gap-2" aria-label="Choix du mini-jeu">
          {GAME_ORDER.map((gameType) => {
            const spec = GAME_SPECS[gameType]
            const done = spec.checks.filter((_, index) => checks[`${gameType}:${index}`]).length
            return <button
              key={gameType}
              type="button"
              onClick={() => chooseType(gameType)}
              aria-pressed={type === gameType}
              data-testid={`game-${gameType.toLowerCase()}`}
              className={`relative min-w-0 rounded-xl border px-3 py-3 text-left transition ${type === gameType ? 'border-derby-gold bg-derby-gold/15 shadow-gold-glow' : 'border-derby-gold/20 bg-derby-night hover:border-derby-gold/55'}`}
            >
              <span className="font-display text-3xl text-derby-gold">{spec.icon}</span>
              <span className="ml-2 font-headline text-sm tracking-[.08em]">{spec.label}</span>
              <span className={`absolute right-2 top-2 rounded-full px-1.5 font-terminal text-xs ${done === 4 ? 'bg-derby-green text-white' : 'bg-black/40 text-derby-smoke'}`}>{done}/4</span>
            </button>
          })}
        </section>

        <div className="grid grid-cols-[300px_minmax(520px,1fr)_450px] items-start gap-4">
          <aside className="space-y-4">
            <section className={panelClass('p-4')}>
              <h2 className="font-headline text-sm tracking-[.3em] text-derby-gold">SCÉNARIOS DE TEST</h2>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {SCENARIOS.map((item) => <button
                  key={item.id}
                  type="button"
                  onClick={() => chooseScenario(item.id)}
                  title={item.description}
                  aria-pressed={scenario === item.id}
                  className={`rounded-lg border px-2 py-2 text-left font-headline text-xs tracking-[.05em] ${scenario === item.id ? 'border-derby-gold bg-derby-gold/15 text-derby-gold' : 'border-white/10 bg-black/20 text-derby-cream/75 hover:border-derby-gold/50'}`}
                >{item.label}</button>)}
              </div>
              <p className="mt-2 min-h-10 font-body text-xs leading-relaxed text-derby-smoke">{SCENARIOS.find((item) => item.id === scenario)?.description}</p>
            </section>

            <section className={panelClass('space-y-4 p-4')}>
              <div className="flex items-center justify-between">
                <label className="font-headline text-xs tracking-[.22em] text-derby-smoke">JOUEURS</label>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => changePlayerCount(-1)} className="h-8 w-8 rounded border border-derby-gold/35 bg-black/30" aria-label="Retirer un joueur">−</button>
                  <span className="w-7 text-center font-terminal text-2xl text-derby-gold">{playerCount}</span>
                  <button type="button" onClick={() => changePlayerCount(1)} className="h-8 w-8 rounded border border-derby-gold/35 bg-black/30" aria-label="Ajouter un joueur">+</button>
                </div>
              </div>

              <label className="block">
                <span className="font-headline text-xs tracking-[.22em] text-derby-smoke">JOUEUR AFFICHÉ</span>
                <select value={selectedPlayerId} onChange={(event) => setSelectedPlayerId(event.target.value)} className="mt-1 w-full rounded border border-derby-gold/30 bg-derby-coal px-3 py-2 font-body text-sm text-derby-cream">
                  {game.players.map((row) => <option key={row.playerId} value={row.playerId}>{row.pseudo}</option>)}
                </select>
              </label>

              <label className="block">
                <span className="font-headline text-xs tracking-[.22em] text-derby-smoke">DURÉE AU REDÉMARRAGE</span>
                <select value={durationMs} onChange={(event) => setDurationMs(Number(event.target.value))} className="mt-1 w-full rounded border border-derby-gold/30 bg-derby-coal px-3 py-2 font-terminal text-lg text-derby-cream">
                  {DURATIONS.map((value) => <option key={value} value={value}>{value / 1000} secondes</option>)}
                </select>
              </label>

              <div className="grid grid-cols-2 gap-2">
                <button type="button" data-testid="restart-game" onClick={() => { const nextSeed = seed + 1; setSeed(nextSeed); loadFixture(type, scenario, playerCount, nextSeed, durationMs) }} className="rounded-lg bg-derby-red px-3 py-2 font-headline text-sm tracking-[.08em] text-white">↻ RELANCER</button>
                <button type="button" onClick={addTenSeconds} className="rounded-lg border border-derby-gold/40 px-3 py-2 font-headline text-sm text-derby-gold">+ 10 SEC</button>
              </div>
            </section>

            <section className={panelClass('space-y-3 p-4')}>
              <h2 className="font-headline text-sm tracking-[.3em] text-derby-gold">SIMULATION</h2>
              <label className="flex items-center justify-between gap-3 font-body text-sm">
                Adversaires automatiques
                <input type="checkbox" checked={botsEnabled} onChange={(event) => setBotsEnabled(event.target.checked)} className="h-5 w-5 accent-[#D9A943]" />
              </label>
              <select value={botSpeed} onChange={(event) => setBotSpeed(Number(event.target.value))} disabled={!botsEnabled} className="w-full rounded border border-derby-gold/30 bg-derby-coal px-3 py-2 font-body text-sm disabled:opacity-40">
                {SPEEDS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
              <label className="block">
                <span className="font-headline text-xs tracking-[.2em] text-derby-smoke">LATENCE ACTIONS</span>
                <select value={latencyMs} onChange={(event) => setLatencyMs(Number(event.target.value))} className="mt-1 w-full rounded border border-derby-gold/30 bg-derby-coal px-3 py-2 font-body text-sm">
                  <option value={0}>Aucune</option>
                  <option value={250}>250 ms · Wi-Fi moyen</option>
                  <option value={800}>800 ms · réseau lent</option>
                  <option value={1500}>1 500 ms · cas extrême</option>
                </select>
              </label>
            </section>

            <section className={panelClass('p-4')}>
              <h2 className="font-headline text-sm tracking-[.3em] text-derby-gold">ÉTATS FORCÉS</h2>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => forcePlayer('active')} className="rounded border border-white/20 px-2 py-2 font-headline text-xs">EN JEU</button>
                <button type="button" onClick={() => forcePlayer('qualified')} className="rounded border border-derby-green/80 bg-derby-green/20 px-2 py-2 font-headline text-xs">QUALIFIÉ</button>
                <button type="button" onClick={() => forcePlayer('eliminated')} className="rounded border border-derby-red/80 bg-derby-red/20 px-2 py-2 font-headline text-xs">ÉLIMINÉ</button>
                <button type="button" data-testid="force-results" onClick={forceResults} className="rounded border border-derby-gold/60 bg-derby-gold/10 px-2 py-2 font-headline text-xs text-derby-gold">RÉSULTATS</button>
              </div>
            </section>
          </aside>

          <div className="space-y-4">
            <section className={panelClass('overflow-hidden')}>
              <div className="flex items-center justify-between border-b border-derby-gold/20 bg-black/30 px-4 py-2">
                <div>
                  <span className="font-headline text-xs tracking-[.28em] text-derby-red">SORTIE TV · 16:9</span>
                  <span className="ml-3 font-body text-xs text-derby-smoke">composant réellement diffusé</span>
                </div>
                <span className="font-terminal text-xl text-derby-gold">{game.status === 'RESULTS' ? 'RÉSULTATS' : formatMs(remainingMs)}</span>
              </div>
              <div className="relative aspect-video overflow-hidden bg-black" style={{ containerType: 'size' }}>
                <MiniGameBoard key={`${game.id}-${game.status}`} game={game} embedded />
              </div>
            </section>

            <section className={panelClass('p-4')}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="font-headline text-xs tracking-[.28em] text-derby-red">RÈGLE ATTENDUE · {GAME_SPECS[type].label.toUpperCase()}</div>
                  <p className="mt-1 font-body text-sm leading-relaxed text-derby-cream/85">{GAME_SPECS[type].rule}</p>
                </div>
                <button type="button" onClick={validateCurrent} className="shrink-0 rounded-lg border border-derby-green/60 bg-derby-green/15 px-3 py-2 font-headline text-xs tracking-[.08em] text-emerald-200">TOUT VALIDER</button>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {currentChecks.map((label, index) => {
                  const key = `${type}:${index}`
                  return <label key={key} className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 font-body text-sm ${checks[key] ? 'border-derby-green/60 bg-derby-green/15 text-emerald-100' : 'border-white/10 bg-black/20 text-derby-smoke'}`}>
                    <input type="checkbox" checked={!!checks[key]} onChange={(event) => setChecks((current) => ({ ...current, [key]: event.target.checked }))} className="h-4 w-4 accent-[#1E5C43]" />
                    {label}
                  </label>
                })}
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3 font-terminal text-lg">
                <span className="text-derby-smoke">Validation de ce jeu</span>
                <span className={currentCompleted === 4 ? 'text-emerald-300' : 'text-derby-gold'}>{currentCompleted}/4</span>
              </div>
            </section>

            <section className={panelClass('p-4')}>
              <div className="flex items-center justify-between">
                <h2 className="font-headline text-sm tracking-[.28em] text-derby-gold">JOURNAL DES ACTIONS</h2>
                <button type="button" onClick={() => setLogs([])} className="font-headline text-xs tracking-[.12em] text-derby-smoke hover:text-derby-cream">EFFACER</button>
              </div>
              <div className="mt-2 max-h-48 overflow-y-auto rounded-lg bg-black/35">
                {logs.length === 0 ? <p className="p-4 font-body text-xs text-derby-smoke">Les clics, erreurs, qualifications et résolutions apparaîtront ici.</p> : logs.map((entry) => <div key={entry.id} className="grid grid-cols-[64px_110px_1fr] gap-2 border-b border-white/5 px-3 py-2 font-body text-xs last:border-0">
                  <span className="font-terminal text-derby-smoke">{new Date(entry.at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                  <span className="truncate text-derby-gold">{entry.actor}</span>
                  <span className={entry.tone === 'ok' ? 'text-emerald-300' : entry.tone === 'warn' ? 'text-orange-300' : 'text-derby-cream/75'}>{entry.label}</span>
                </div>)}
              </div>
            </section>
          </div>

          <aside className="space-y-4">
            <section className={panelClass('p-4')}>
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <div className="font-headline text-xs tracking-[.28em] text-derby-red">ÉCRAN JOUEUR</div>
                  <div className="font-body text-sm text-derby-cream">{selectedPlayer?.pseudo}</div>
                </div>
                <div className="text-right">
                  <div className={`font-headline text-sm tracking-[.12em] ${playerStateLabel(game, selectedPlayerId) === 'ÉLIMINÉ' ? 'text-derby-red' : playerStateLabel(game, selectedPlayerId) === 'QUALIFIÉ' ? 'text-emerald-300' : 'text-derby-gold'}`}>{playerStateLabel(game, selectedPlayerId)}</div>
                  <div className="font-terminal text-lg text-derby-smoke">{metric(game, selectedPlayerId)}</div>
                </div>
              </div>
              <select value={viewportId} onChange={(event) => setViewportId(event.target.value as (typeof VIEWPORTS)[number]['id'])} className="mb-3 w-full rounded border border-derby-gold/30 bg-derby-coal px-3 py-2 font-body text-xs">
                {VIEWPORTS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
              </select>
              <div className="mx-auto overflow-auto rounded-[2rem] border-[8px] border-[#1b1d1c] bg-black shadow-2xl" style={{ width: viewport.width + 16, maxHeight: 760 }}>
                {phoneUrl ? <iframe
                  ref={iframeRef}
                  src={phoneUrl}
                  title="Prévisualisation interactive du mini-jeu mobile"
                  data-testid="mini-game-phone"
                  onLoad={() => {
                    setPhoneReady(false)
                    if (initialScrollRestored.current) return
                    initialScrollRestored.current = true
                    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
                      if (!mainRef.current) return
                      mainRef.current.scrollTop = 0
                      mainRef.current.scrollLeft = 0
                    }))
                  }}
                  style={{ width: viewport.width, height: viewport.height, border: 0, display: 'block' }}
                  allow="clipboard-write"
                /> : <div className="flex h-96 items-center justify-center font-terminal text-derby-gold">CONNEXION…</div>}
              </div>
              <p className="mt-3 text-center font-body text-[11px] leading-relaxed text-derby-smoke">La vue utilise le vrai composant mobile. Changez de joueur pour vérifier les états individuels.</p>
            </section>

            <section className={panelClass('p-4')}>
              <h2 className="font-headline text-sm tracking-[.28em] text-derby-gold">NOTES DU TESTEUR</h2>
              <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Bug observé, appareil, étapes de reproduction…" className="mt-3 h-28 w-full resize-y select-text rounded-lg border border-derby-gold/25 bg-black/35 p-3 font-body text-sm text-derby-cream outline-none placeholder:text-derby-smoke/60 focus:border-derby-gold" />
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => void copyReport()} className="rounded-lg border border-derby-gold/45 px-3 py-2 font-headline text-xs text-derby-gold">COPIER RAPPORT</button>
                <button type="button" onClick={downloadReport} className="rounded-lg bg-derby-gold px-3 py-2 font-headline text-xs text-derby-coal">TÉLÉCHARGER JSON</button>
              </div>
              {copyStatus && <p role="status" className="mt-2 text-center font-body text-xs text-emerald-300">{copyStatus}</p>}
            </section>

            <details className={panelClass('p-4')}>
              <summary className="cursor-pointer font-headline text-sm tracking-[.22em] text-derby-gold">ÉTAT BRUT & DIAGNOSTIC</summary>
              <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap rounded bg-black/50 p-3 select-text font-mono text-[10px] leading-relaxed text-derby-cream/70">{JSON.stringify(game, null, 2)}</pre>
            </details>

            <section className="rounded-xl border border-dashed border-derby-gold/25 p-4 font-body text-xs leading-relaxed text-derby-smoke">
              <div className="font-headline tracking-[.2em] text-derby-cream">RACCOURCIS</div>
              <p className="mt-1"><b className="text-derby-gold">R</b> relancer · <b className="text-derby-gold">N</b> jeu suivant · <b className="text-derby-gold">E</b> forcer les résultats</p>
              <button type="button" onClick={() => setChecks({})} className="mt-3 text-derby-red underline decoration-derby-red/50 underline-offset-4">Réinitialiser toute la checklist</button>
            </section>
          </aside>
        </div>
      </div>
    </main>
  )
}
