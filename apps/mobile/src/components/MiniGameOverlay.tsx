'use client'

import { useEffect, useRef, useState } from 'react'
import type { MiniGameState } from '@last-sip-derby/shared'
import { MazeGame } from './mini-games/MazeGame'
import { PenaltyGame } from './mini-games/PenaltyGame'
import { PressureGame } from './mini-games/PressureGame'

interface Props {
  game: MiniGameState
  playerId: string
  paused?: boolean
  serverNow?: number
  onAction: (gameId: string, action: string, value?: number | string) => void
}

export function MiniGameOverlay({ game, playerId, paused = false, serverNow, onAction }: Props) {
  const me = game.players.find((row) => row.playerId === playerId)
  const [now, setNow] = useState(Date.now())
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 50); return () => clearInterval(timer) }, [])
  const clockNow = paused && serverNow !== undefined ? serverNow : now
  const seconds = Math.max(0, Math.ceil((game.endsAt - clockNow) / 1000))
  const active = !paused && game.status === 'PLAYING' && clockNow < game.endsAt
  const send = (action: string, value?: number | string) => onAction(game.id, action, value)
  const keepPressureResultVisible = game.type === 'PRESSURE' && !!me?.finishedAt && game.status === 'PLAYING'

  return (
    <div className="fixed inset-0 z-[70] flex flex-col overflow-y-auto bg-[#100906] px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 text-center touch-manipulation">
      <div className="mx-auto flex w-full max-w-md items-center justify-between">
        <span className="font-headline text-sm tracking-[.3em] text-derby-red">DÉFI MIGNON</span>
        <span className="rounded-full bg-derby-red px-3 py-1 font-terminal text-xl">{seconds}s</span>
      </div>
      <div className="mt-1 font-display text-[clamp(2.3rem,7vh,3.75rem)] leading-none text-derby-gold">?</div>
      <h1 className="font-headline text-[clamp(1.55rem,5.6vw,1.9rem)] tracking-[.08em] text-derby-cream">{game.prompt}</h1>
      <p className="font-body text-sm text-derby-smoke">Le dernier est éliminé</p>
      <div className="mx-auto mt-4 flex w-full max-w-md flex-1 flex-col justify-center">
        {game.status === 'RESULTS' ? <MiniResults game={game} playerId={playerId} /> :
         (me?.finishedAt || me?.eliminated) && !keepPressureResultVisible ? <Qualified eliminated={!!me.eliminated} /> :
         game.type === 'GRID' ? <GridGame values={game.payload.values as number[]} target={game.payload.target as number} onPick={(v) => send('pick', v)} /> :
         game.type === 'CODE' ? <CodeGame prompt={game.prompt} answerLength={String(game.payload.answer).length} onAnswer={(v) => send('answer', v)} /> :
         game.type === 'CAPITAL' ? <CapitalGame choices={game.payload.choices as string[]} answer={game.payload.answer as string} lives={me?.lives ?? 2} paused={paused} onAnswer={(v) => send('answer', v)} /> :
         game.type === 'MAZE' ? <MazeGame key={game.id} mazeIndex={Number(game.payload.mazeIndex ?? 0)} active={active} paused={paused} onFinish={() => send('finish')} /> :
         game.type === 'CLICKER' ? <ClickerGame score={me?.score ?? 0} onClick={() => send('click')} /> :
         game.type === 'ORDER' ? <GridGame values={game.payload.values as number[]} target={(me?.progress ?? 0) + 1} onPick={(v) => send('pick', v)} order /> :
         game.type === 'PENALTY' ? <PenaltyGame key={game.id} shots={me?.progress ?? 0} goals={me?.score ?? 0} active={active} paused={paused} onShot={(centerPercent) => send('shot', centerPercent)} /> :
         <PressureGame key={game.id} active={active} paused={paused} confirmedScore={me?.finishedAt ? me.score : null} onScore={(score) => send('score', score)} />}
      </div>
    </div>
  )
}

function Qualified({ eliminated }: { eliminated: boolean }) {
  return <div className={`rounded-2xl border-4 p-8 font-display text-5xl ${eliminated ? 'border-derby-red bg-derby-red/20 text-derby-red' : 'border-derby-green bg-derby-green/30 text-white'}`}>{eliminated ? 'ÉLIMINÉ(E)' : 'QUALIFIÉ(E) ✓'}</div>
}

function MiniResults({ game, playerId }: { game: MiniGameState; playerId: string }) {
  return <div><div className="mb-3 font-headline text-xl tracking-[.2em] text-derby-gold">CLASSEMENT FINAL</div>{[...game.players].sort((a,b) => b.score-a.score || b.progress-a.progress || (a.finishedAt ?? Infinity)-(b.finishedAt ?? Infinity)).map((row, index) => <div key={row.playerId} className={`mb-2 flex justify-between rounded-xl border px-4 py-3 font-body text-lg ${row.eliminated ? 'border-derby-red bg-derby-red/20' : row.playerId === playerId ? 'border-derby-gold bg-derby-gold/15' : 'border-white/15'}`}><span>{index + 1}. {row.pseudo}</span><span>{row.eliminated ? 'ÉLIMINÉ' : game.type === 'CLICKER' ? `${row.score} clics` : game.type === 'PENALTY' ? `${row.score} buts` : game.type === 'PRESSURE' ? `${row.score.toFixed(1).replace('.', ',')} %` : row.finishedAt ? 'FINI' : `${row.progress}`}</span></div>)}</div>
}

function GridGame({ values, target, onPick, order = false }: { values: number[]; target: number; onPick: (value: number) => void; order?: boolean }) {
  return <><div className="mb-3 font-display text-3xl text-derby-gold">{order ? `Trouve le ${target}` : `Cible : ${target}`}</div><div className={`grid ${order ? 'grid-cols-4' : 'grid-cols-6'} gap-2`}>{values.map((value) => <button key={value} onClick={() => onPick(value)} className="btn-big aspect-square rounded-lg border border-derby-gold/40 bg-derby-ink font-terminal text-2xl text-derby-cream">{value < target && order ? '✓' : value}</button>)}</div></>
}

function CodeGame({ prompt, answerLength, onAnswer }: { prompt: string; answerLength: number; onAnswer: (value: number) => void }) {
  const [digits,setDigits] = useState('')
  const push = (digit: number) => { const next = `${digits}${digit}`.slice(0, answerLength); setDigits(next); onAnswer(Number(next)) }
  return <><div className="font-display text-5xl text-derby-gold">{prompt} =</div><div className="my-4 h-14 rounded-xl border-2 border-derby-gold bg-black/40 font-terminal text-4xl tracking-[.3em]">{digits || '•••'}</div><div className="grid grid-cols-3 gap-3">{[1,2,3,4,5,6,7,8,9].map(n => <button key={n} onClick={() => push(n)} className="btn-big rounded-xl bg-derby-cream py-4 font-terminal text-3xl text-derby-coal">{n}</button>)}<button onClick={() => setDigits(digits.slice(0,-1))} className="rounded-xl bg-derby-red py-4 text-2xl">⌫</button><button onClick={() => push(0)} className="rounded-xl bg-derby-cream py-4 font-terminal text-3xl text-derby-coal">0</button></div></>
}

function CapitalGame({ choices, answer, lives, paused, onAnswer }: { choices: string[]; answer: string; lives: number; paused: boolean; onAnswer: (value: string) => void }) {
  const [wrong, setWrong] = useState<string | null>(null)
  const clearWrongTimer = useRef<number | null>(null)
  const wrongRemainingRef = useRef(650)
  useEffect(() => {
    if (!wrong || paused) return
    const startedAt = performance.now()
    clearWrongTimer.current = window.setTimeout(() => {
      wrongRemainingRef.current = 650
      setWrong(null)
    }, wrongRemainingRef.current)
    return () => {
      if (clearWrongTimer.current !== null) window.clearTimeout(clearWrongTimer.current)
      clearWrongTimer.current = null
      wrongRemainingRef.current = Math.max(0, wrongRemainingRef.current - (performance.now() - startedAt))
    }
  }, [paused, wrong])
  const choose = (choice: string) => {
    if (choice !== answer) {
      wrongRemainingRef.current = 650
      setWrong(choice)
    }
    onAnswer(choice)
  }
  return <><div className="mb-4 flex items-center justify-center gap-3" aria-label={`${lives} vie${lives > 1 ? 's' : ''} restante${lives > 1 ? 's' : ''}`}><span className="font-headline text-sm tracking-[.22em] text-derby-cream">VIES</span>{[0, 1].map((index) => <span key={index} className={`h-5 w-5 rotate-45 rounded-sm border-2 ${index < lives ? 'border-red-200 bg-derby-red shadow-[0_0_10px_rgba(210,42,46,.75)]' : 'border-white/20 bg-transparent'}`} />)}{lives === 0 && <span className="font-headline text-lg tracking-wider text-derby-red">PLUS AUCUNE VIE</span>}</div><div className="space-y-3">{choices.map(choice => <button key={choice} onClick={() => choose(choice)} className={`btn-big w-full rounded-xl border-2 py-4 font-body text-xl transition-colors ${wrong === choice ? 'border-derby-red bg-derby-red text-white' : 'border-derby-gold/50 bg-derby-ink'}`}>{choice}</button>)}</div></>
}

function ClickerGame({ score, onClick }: { score: number; onClick: () => void }) {
  return <><div className="mb-4 font-terminal text-6xl text-derby-gold">{score}</div><button onPointerDown={(event) => { event.preventDefault(); onClick() }} className="h-64 w-full select-none rounded-3xl border-8 border-derby-cream bg-derby-red font-display text-5xl text-white" style={{ touchAction: 'none', WebkitUserSelect: 'none' }}>CLIQUE !</button></>
}
