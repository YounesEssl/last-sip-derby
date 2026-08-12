'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { MiniGameState } from '@last-sip-derby/shared'

interface Props {
  game: MiniGameState
  playerId: string
  onAction: (gameId: string, action: string, value?: number | string) => void
}

function makeMaze(seed: number) {
  const size = 11, cells = Array.from({length:size},()=>Array(size).fill('#')) as string[][]
  let value = (seed || 1) >>> 0
  const random = () => { value = (value * 1664525 + 1013904223) >>> 0; return value / 4294967296 }
  const visit = (x:number,y:number) => {
    cells[y][x]='.'
    const dirs = [[2,0],[-2,0],[0,2],[0,-2]].sort(()=>random()-.5)
    for(const [dx,dy] of dirs){const nx=x+dx,ny=y+dy;if(nx>0&&ny>0&&nx<size-1&&ny<size-1&&cells[ny][nx]==='#'){cells[y+dy/2][x+dx/2]='.';visit(nx,ny)}}
  }
  visit(1,1); cells[size-1][size-2]='.'
  return cells
}

export function MiniGameOverlay({ game, playerId, onAction }: Props) {
  const me = game.players.find((row) => row.playerId === playerId)
  const [now, setNow] = useState(Date.now())
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 50); return () => clearInterval(timer) }, [])
  const seconds = Math.max(0, Math.ceil((game.endsAt - now) / 1000))
  const send = (action: string, value?: number | string) => onAction(game.id, action, value)

  return (
    <div className="fixed inset-0 z-[70] flex flex-col overflow-y-auto bg-[#100906] px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 text-center touch-manipulation">
      <div className="mx-auto flex w-full max-w-md items-center justify-between">
        <span className="font-headline text-sm tracking-[.3em] text-derby-red">DÉFI MIGNON</span>
        <span className="rounded-full bg-derby-red px-3 py-1 font-terminal text-xl">{seconds}s</span>
      </div>
      <div className="mt-2 text-6xl font-display text-derby-gold">?</div>
      <h1 className="font-headline text-3xl tracking-[.08em] text-derby-cream">{game.prompt}</h1>
      <p className="font-body text-sm text-derby-smoke">Le dernier est éliminé</p>
      <div className="mx-auto mt-4 flex w-full max-w-md flex-1 flex-col justify-center">
        {game.status === 'RESULTS' ? <MiniResults game={game} playerId={playerId} /> :
         me?.finishedAt || me?.eliminated ? <Qualified eliminated={!!me.eliminated} /> :
         game.type === 'GRID' ? <GridGame values={game.payload.values as number[]} target={game.payload.target as number} onPick={(v) => send('pick', v)} /> :
         game.type === 'CODE' ? <CodeGame prompt={game.prompt} answerLength={String(game.payload.answer).length} onAnswer={(v) => send('answer', v)} /> :
         game.type === 'CAPITAL' ? <CapitalGame choices={game.payload.choices as string[]} answer={game.payload.answer as string} lives={me?.lives ?? 2} onAnswer={(v) => send('answer', v)} /> :
         game.type === 'MAZE' ? <MazeGame seed={Number(game.payload.seed) + Number(game.payload.level)} onFinish={() => send('finish')} /> :
         game.type === 'CLICKER' ? <ClickerGame score={me?.score ?? 0} onClick={() => send('click')} /> :
         game.type === 'ORDER' ? <GridGame values={game.payload.values as number[]} target={(me?.progress ?? 0) + 1} onPick={(v) => send('pick', v)} order /> :
         game.type === 'PENALTY' ? <PenaltyGame shots={me?.progress ?? 0} goals={me?.score ?? 0} onShot={(goal) => send('shot', goal ? 1 : 0)} /> :
         <PressureGame onScore={(score) => send('score', score)} />}
      </div>
    </div>
  )
}

function Qualified({ eliminated }: { eliminated: boolean }) {
  return <div className={`rounded-2xl border-4 p-8 font-display text-5xl ${eliminated ? 'border-derby-red bg-derby-red/20 text-derby-red' : 'border-derby-green bg-derby-green/30 text-white'}`}>{eliminated ? 'ÉLIMINÉ(E)' : 'QUALIFIÉ(E) ✓'}</div>
}

function MiniResults({ game, playerId }: { game: MiniGameState; playerId: string }) {
  return <div><div className="mb-3 font-headline text-xl tracking-[.2em] text-derby-gold">CLASSEMENT FINAL</div>{[...game.players].sort((a,b) => b.score-a.score || b.progress-a.progress || (a.finishedAt ?? Infinity)-(b.finishedAt ?? Infinity)).map((row, index) => <div key={row.playerId} className={`mb-2 flex justify-between rounded-xl border px-4 py-3 font-body text-lg ${row.eliminated ? 'border-derby-red bg-derby-red/20' : row.playerId === playerId ? 'border-derby-gold bg-derby-gold/15' : 'border-white/15'}`}><span>{index + 1}. {row.pseudo}</span><span>{row.eliminated ? 'ÉLIMINÉ' : game.type === 'CLICKER' ? `${row.score} clics` : game.type === 'PENALTY' ? `${row.score} buts` : game.type === 'PRESSURE' ? `${row.score.toFixed(1)} %` : row.finishedAt ? 'FINI' : `${row.progress}`}</span></div>)}</div>
}

function GridGame({ values, target, onPick, order = false }: { values: number[]; target: number; onPick: (value: number) => void; order?: boolean }) {
  return <><div className="mb-3 font-display text-3xl text-derby-gold">{order ? `Trouve le ${target}` : `Cible : ${target}`}</div><div className={`grid ${order ? 'grid-cols-4' : 'grid-cols-6'} gap-2`}>{values.map((value) => <button key={value} onClick={() => onPick(value)} className="btn-big aspect-square rounded-lg border border-derby-gold/40 bg-derby-ink font-terminal text-2xl text-derby-cream">{value < target && order ? '✓' : value}</button>)}</div></>
}

function CodeGame({ prompt, answerLength, onAnswer }: { prompt: string; answerLength: number; onAnswer: (value: number) => void }) {
  const [digits,setDigits] = useState('')
  const push = (digit: number) => { const next = `${digits}${digit}`.slice(0, answerLength); setDigits(next); onAnswer(Number(next)) }
  return <><div className="font-display text-5xl text-derby-gold">{prompt} =</div><div className="my-4 h-14 rounded-xl border-2 border-derby-gold bg-black/40 font-terminal text-4xl tracking-[.3em]">{digits || '•••'}</div><div className="grid grid-cols-3 gap-3">{[1,2,3,4,5,6,7,8,9].map(n => <button key={n} onClick={() => push(n)} className="btn-big rounded-xl bg-derby-cream py-4 font-terminal text-3xl text-derby-coal">{n}</button>)}<button onClick={() => setDigits(digits.slice(0,-1))} className="rounded-xl bg-derby-red py-4 text-2xl">⌫</button><button onClick={() => push(0)} className="rounded-xl bg-derby-cream py-4 font-terminal text-3xl text-derby-coal">0</button></div></>
}

function CapitalGame({ choices, answer, lives, onAnswer }: { choices: string[]; answer: string; lives: number; onAnswer: (value: string) => void }) {
  const [wrong, setWrong] = useState<string | null>(null)
  const choose = (choice: string) => {
    if (choice !== answer) {
      setWrong(choice)
      setTimeout(() => setWrong((current) => current === choice ? null : current), 650)
    }
    onAnswer(choice)
  }
  return <><div className="mb-4 font-headline text-2xl text-derby-red">{'❤️'.repeat(lives)}{lives === 0 ? '💀' : ''}</div><div className="space-y-3">{choices.map(choice => <button key={choice} onClick={() => choose(choice)} className={`btn-big w-full rounded-xl border-2 py-4 font-body text-xl transition-colors ${wrong === choice ? 'border-derby-red bg-derby-red text-white' : 'border-derby-gold/50 bg-derby-ink'}`}>{choice}</button>)}</div></>
}

function MazeGame({ seed, onFinish }: { seed: number; onFinish: () => void }) {
  const maze = useMemo(() => makeMaze(seed), [seed])
  const [pos,setPos] = useState<[number,number]>([1,1])
  const move = (dx:number,dy:number) => setPos(([x,y]) => { const nx=x+dx, ny=y+dy; if (ny === 10 && nx === 9) { setTimeout(onFinish,0); return [nx,ny] } return maze[ny]?.[nx] === '.' ? [nx,ny] : [x,y] })
  return <><div className="mx-auto grid aspect-square w-full max-w-[340px] overflow-hidden rounded-xl border-4 border-derby-gold" style={{gridTemplateColumns:'repeat(11,1fr)'}}>{maze.flatMap((row,y) => row.map((cell,x) => <div key={`${x}-${y}`} className={`relative ${cell === '#' ? 'bg-derby-coal' : 'bg-derby-cream/15'} ${x===9&&y===10 ? 'bg-derby-green' : ''}`}>{pos[0]===x&&pos[1]===y&&<span className="absolute inset-[2px] rounded-full bg-derby-red shadow-lg" />}</div>))}</div><div className="mx-auto mt-5 grid w-48 grid-cols-3 gap-2"> <span/><Pad label="▲" onClick={()=>move(0,-1)}/><span/><Pad label="◀" onClick={()=>move(-1,0)}/><Pad label="▼" onClick={()=>move(0,1)}/><Pad label="▶" onClick={()=>move(1,0)}/></div></>
}
function Pad({label,onClick}:{label:string;onClick:()=>void}) { return <button onClick={onClick} className="btn-big rounded-xl bg-derby-gold py-4 text-derby-coal">{label}</button> }

function ClickerGame({ score, onClick }: { score: number; onClick: () => void }) {
  return <><div className="mb-4 font-terminal text-6xl text-derby-gold">{score}</div><button onPointerDown={(event) => { event.preventDefault(); onClick() }} className="h-64 w-full select-none rounded-3xl border-8 border-derby-cream bg-derby-red font-display text-5xl text-white" style={{ touchAction: 'none', WebkitUserSelect: 'none' }}>CLIQUE !</button></>
}

function PenaltyGame({ shots, goals, onShot }: { shots:number; goals:number; onShot:(goal:boolean)=>void }) {
  const [now,setNow] = useState(performance.now()); useEffect(()=>{let id=0;const tick=()=>{setNow(performance.now());id=requestAnimationFrame(tick)};id=requestAnimationFrame(tick);return()=>cancelAnimationFrame(id)},[])
  const x = (Math.sin(now / 115) + 1) * 50
  const [marks,setMarks] = useState<Array<{id:number;x:number;goal:boolean}>>([])
  const shoot = () => {
    if (shots >= 10) return
    const goal = x >= 32 && x <= 68
    setMarks((current) => [...current, { id: Date.now(), x, goal }])
    onShot(goal)
  }
  return <div onPointerDown={shoot} className="relative h-72 overflow-hidden rounded-2xl border-4 border-white/60 bg-derby-green touch-none"><div className="absolute left-[30%] right-[30%] top-10 h-40 border-8 border-b-0 border-white"/>{marks.map((mark) => <span key={mark.id} className={`absolute top-24 h-7 w-7 -translate-x-1/2 rounded-full border-4 ${mark.goal ? 'border-green-950 bg-green-400' : 'border-red-950 bg-red-500'}`} style={{left:`${mark.x}%`}}><span className="absolute inset-0 animate-ping rounded-full bg-current opacity-50" /></span>)}<div className="absolute bottom-7 h-12 w-12 -translate-x-1/2 rounded-full border-2 border-black bg-white text-3xl" style={{left:`${x}%`}}>⚽</div><div className="absolute inset-x-0 bottom-1 font-headline">BUTS {goals} · BALLONS {10-shots}</div></div>
}

function PressureGame({ onScore }: { onScore: (score:number)=>void }) {
  const start = useRef(performance.now()); const [now,setNow] = useState(start.current); const [score,setScore] = useState<number|null>(null)
  useEffect(()=>{let id=0;const tick=()=>{setNow(performance.now());id=requestAnimationFrame(tick)};id=requestAnimationFrame(tick);return()=>cancelAnimationFrame(id)},[])
  const value = ((now-start.current)%700)/7
  const displayed = score ?? value
  const message = displayed < 20 ? 'Ptdrrr la honte' : displayed < 40 ? "T’es vraiment mauvais" : displayed < 60 ? "C’est moyen tout ça chef" : displayed < 80 ? 'Pas trop mal' : displayed < 90 ? 'Bien !' : displayed < 95 ? 'Excellent !!' : displayed < 98 ? 'INCROYABLE !!!' : displayed < 100 ? "C’est EXCEPTIONNEL." : 'TU ES LE GOAT'
  const stop=()=>{if(score!==null)return;const rounded=Math.round(value*10)/10;setScore(rounded);onScore(rounded)}
  return <button onClick={stop} className="relative mx-auto h-[55vh] w-64 overflow-hidden bg-black/50" style={{clipPath:'polygon(0 0, 100% 0, 50% 100%)'}}><div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-red-700 via-yellow-400 to-green-800 transition-[height]" style={{height:`${displayed}%`}}/><div className="absolute inset-0 flex flex-col items-center justify-center px-8 font-display text-3xl drop-shadow-lg"><span>{score === null ? 'STOP !' : message}</span><span className="text-5xl">{displayed.toFixed(1)}%</span></div></button>
}
