'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  MINI_GAME_DURATIONS,
  MINI_GAME_TYPES,
  applyMiniGameAction,
  resolveMiniGameState,
  shouldEndMiniGameEarly,
  type MiniGameState,
  type MiniGameType,
} from '@last-sip-derby/shared'
import { MiniGameOverlay } from '@/components/MiniGameOverlay'

const LAB_CHANNEL = 'aperodrome:minigame-lab'

function standaloneFixture(type: MiniGameType): MiniGameState {
  const now = Date.now()
  let prompt = ''
  let payload: Record<string, unknown> = {}
  if (type === 'GRID') {
    const values = Array.from({ length: 36 }, (_, index) => ((index * 13) % 36) + 1)
    prompt = 'Trouvez le 29'
    payload = { values, target: 29 }
  } else if (type === 'CODE') {
    prompt = '7 × 8'
    payload = { a: 7, b: 8, answer: 56 }
  } else if (type === 'CAPITAL') {
    prompt = 'Capitale : Australie'
    payload = { country: 'Australie', answer: 'Canberra', choices: ['Sydney', 'Canberra', 'Melbourne', 'Perth'] }
  } else if (type === 'MAZE') {
    prompt = 'Sortez du labyrinthe'
    payload = { mazeIndex: 7 }
  } else if (type === 'CLICKER') prompt = 'Cliquez le plus vite possible'
  else if (type === 'ORDER') {
    prompt = '1 → 16'
    payload = { values: [11, 2, 15, 4, 8, 1, 13, 6, 9, 16, 3, 12, 5, 14, 7, 10] }
  } else if (type === 'PENALTY') prompt = '10 tirs — visez entre les poteaux'
  else prompt = 'Arrêtez la jauge au plus près de 100 %'

  return {
    id: `standalone-${type}-${now}`,
    type,
    startedAt: now,
    endsAt: now + MINI_GAME_DURATIONS[type],
    status: 'PLAYING',
    resultsEndAt: null,
    prompt,
    payload,
    players: ['Toi', 'Bot PMU', 'Tatie Ginette', 'Jean-Miche'].map((pseudo, index) => ({
      playerId: `standalone-player-${index + 1}`,
      pseudo,
      score: type === 'CLICKER' && index > 0 ? 8 + index * 7 : type === 'PENALTY' && index > 0 ? index + 2 : type === 'PRESSURE' && index > 0 ? 55 + index * 11 : 0,
      progress: type === 'PENALTY' && index > 0 ? 10 : type === 'PRESSURE' && index > 0 ? 100 : 0,
      finishedAt: type === 'PRESSURE' && index > 0 ? now - index * 200 : null,
      lives: 2,
      eliminated: false,
    })),
  }
}

export default function MiniGamesPhoneHarnessPage() {
  const [game, setGame] = useState<MiniGameState | null>(null)
  const [playerId, setPlayerId] = useState('standalone-player-1')
  const [embedded, setEmbedded] = useState(true)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const parentOriginRef = useRef('*')

  const postToParent = useCallback((message: Record<string, unknown>) => {
    if (window.parent === window) return
    window.parent.postMessage({ channel: LAB_CHANNEL, ...message }, parentOriginRef.current)
  }, [])

  useEffect(() => {
    const isEmbedded = window.parent !== window || new URLSearchParams(window.location.search).get('embedded') === '1'
    setEmbedded(isEmbedded)
    if (document.referrer) {
      try { parentOriginRef.current = new URL(document.referrer).origin } catch { parentOriginRef.current = '*' }
    }

    const onMessage = (event: MessageEvent) => {
      if (event.source !== window.parent) return
      const data = event.data as { channel?: string; kind?: string; game?: MiniGameState; playerId?: string }
      if (data?.channel !== LAB_CHANNEL || data.kind !== 'state' || !data.game || !data.playerId) return
      setGame(data.game)
      setPlayerId(data.playerId)
    }
    window.addEventListener('message', onMessage)

    if (isEmbedded) {
      postToParent({ kind: 'ready' })
      const readyTimer = window.setInterval(() => postToParent({ kind: 'ready' }), 800)
      return () => {
        window.clearInterval(readyTimer)
        window.removeEventListener('message', onMessage)
      }
    }

    const initial = standaloneFixture('GRID')
    setGame(initial)
    setPlayerId(initial.players[0].playerId)
    return () => window.removeEventListener('message', onMessage)
  }, [postToParent])

  useEffect(() => {
    if (embedded) return
    const timer = window.setInterval(() => {
      setGame((current) => {
        if (!current || current.status !== 'PLAYING' || Date.now() < current.endsAt) return current
        const next = { ...current, payload: { ...current.payload }, players: current.players.map((row) => ({ ...row })) }
        resolveMiniGameState(next)
        return next
      })
    }, 200)
    return () => window.clearInterval(timer)
  }, [embedded])

  const action = (gameId: string, actionName: string, value?: number | string) => {
    if (embedded) {
      postToParent({ kind: 'action', gameId, playerId, action: actionName, value })
      return
    }
    setGame((current) => {
      if (!current) return current
      const next = { ...current, payload: { ...current.payload }, players: current.players.map((row) => ({ ...row })) }
      applyMiniGameAction(next, playerId, gameId, actionName, value)
      if (shouldEndMiniGameEarly(next)) resolveMiniGameState(next)
      return next
    })
  }

  const selectStandaloneType = (type: MiniGameType) => {
    const next = standaloneFixture(type)
    setGame(next)
    setPlayerId(next.players[0].playerId)
    setDrawerOpen(false)
  }

  const forceResults = () => {
    setGame((current) => {
      if (!current) return current
      const next = { ...current, payload: { ...current.payload }, players: current.players.map((row) => ({ ...row })) }
      resolveMiniGameState(next)
      return next
    })
    setDrawerOpen(false)
  }

  if (!game) {
    return <main className="flex h-full items-center justify-center bg-[#100906] font-terminal text-2xl text-derby-gold" data-testid="mobile-mini-game-bridge">SYNCHRONISATION…</main>
  }

  return <main className="relative h-full bg-[#100906]" data-testid="mobile-mini-game-bridge">
    <MiniGameOverlay key={`${game.id}-${playerId}`} game={game} playerId={playerId} onAction={action} />

    {!embedded && <>
      <button type="button" onClick={() => setDrawerOpen(true)} className="fixed left-1/2 top-3 z-[90] -translate-x-1/2 rounded-full border border-derby-gold/60 bg-derby-coal/85 px-3 py-1 font-headline text-[10px] tracking-[.18em] text-derby-gold shadow-xl backdrop-blur">LAB</button>
      {drawerOpen && <div className="fixed inset-3 z-[95] overflow-y-auto rounded-2xl border-2 border-derby-gold bg-derby-night/98 p-4 shadow-2xl">
        <div className="flex items-center justify-between">
          <div><div className="font-headline text-xs tracking-[.3em] text-derby-red">MODE TÉLÉPHONE SEUL</div><div className="font-display text-2xl text-derby-cream">Choisir un mini-jeu</div></div>
          <button type="button" onClick={() => setDrawerOpen(false)} className="h-10 w-10 rounded-full border border-white/20 text-xl">×</button>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {MINI_GAME_TYPES.map((type) => <button key={type} type="button" onClick={() => selectStandaloneType(type)} className={`rounded-xl border px-3 py-4 font-headline tracking-[.08em] ${game.type === type ? 'border-derby-gold bg-derby-gold/20 text-derby-gold' : 'border-white/15 bg-black/20'}`}>{type}</button>)}
        </div>
        <button type="button" onClick={forceResults} className="mt-4 w-full rounded-xl bg-derby-red py-4 font-headline tracking-[.15em] text-white">FORCER LES RÉSULTATS</button>
        <p className="mt-3 font-body text-xs leading-relaxed text-derby-smoke">Pour la vue TV, les bots, les égalités, la latence et le rapport de test, ouvrez <b className="text-derby-gold">/mini-games</b> sur l’écran principal.</p>
      </div>}
    </>}
  </main>
}
