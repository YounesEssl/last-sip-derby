'use client'

import type { MiniGameState } from '@last-sip-derby/shared'
import { motion } from 'framer-motion'
import { useNow } from './shared'

export function MiniGameBoard({ game, embedded = false }: { game: MiniGameState; embedded?: boolean }) {
  const now = useNow(100)
  const seconds = Math.max(0, Math.ceil(((game.status === 'RESULTS' ? game.resultsEndAt ?? now : game.endsAt) - now) / 1000))
  const sorted = [...game.players].sort((a,b) => {
    if (game.type === 'CLICKER' || game.type === 'PENALTY' || game.type === 'PRESSURE') return b.score-a.score
    return b.progress-a.progress || (a.finishedAt ?? Infinity)-(b.finishedAt ?? Infinity)
  })
  const mazeFinishers = sorted.filter((row) => !!row.finishedAt && !row.eliminated)
  const mazeRemaining = game.players.filter((row) => !row.finishedAt && !row.eliminated).length
  const metric = (row: typeof sorted[number]) => {
    if (game.type === 'CLICKER') return `${row.score} CLICS`
    if (game.type === 'PENALTY') return `${row.score} BUTS · ${row.progress}/10`
    if (game.type === 'PRESSURE') return row.finishedAt ? `${row.score.toFixed(1).replace('.', ',')} %` : 'EN ATTENTE'
    if (game.type === 'MAZE') {
      if (!row.finishedAt) return 'DANS LE LABYRINTHE'
      const order = mazeFinishers.findIndex((candidate) => candidate.playerId === row.playerId) + 1
      return `SORTI N° ${order}`
    }
    if (row.finishedAt) return 'QUALIFIÉ ✓'
    return game.type === 'ORDER' ? `${row.progress}/16` : 'EN JEU…'
  }
  return <motion.div
    initial={{scale:1.4,opacity:0}}
    animate={{scale:1,opacity:1}}
    data-testid="mini-game-tv-board"
    className={`absolute inset-0 flex items-center justify-center bg-black/95 ${embedded ? 'z-20 p-[4cqh]' : 'z-[60] p-[5vh]'}`}
    style={embedded ? { containerType: 'size' } : undefined}
  >
    <div className={embedded ? 'w-[82cqw] text-center' : 'w-[70vw] text-center'}>
      <div className={`font-display leading-none text-derby-gold ${embedded ? 'text-[12cqh]' : 'text-[14vh]'}`}>?</div>
      <div className={`font-headline tracking-[.45em] text-derby-red ${embedded ? 'text-[2.2cqh]' : 'text-[2.3vh]'}`}>DÉFI MIGNON · LE DERNIER EST ÉLIMINÉ</div>
      <h2 className={`mt-1 font-display text-derby-cream ${embedded ? 'text-[4.6cqh]' : 'text-[5vh]'}`}>{game.prompt}</h2>
      <div className={`font-terminal text-derby-gold ${embedded ? 'my-[1.5cqh] text-[4.6cqh]' : 'my-[2vh] text-[5vh]'}`}>{game.status === 'RESULTS' ? `REPRISE DANS ${seconds}` : `${seconds}s`}</div>
      {game.type === 'MAZE' && game.status === 'PLAYING' && mazeRemaining > 0 && mazeRemaining <= 2 && (
        <motion.div initial={{ scale: .8 }} animate={{ scale: [1, 1.06, 1] }} transition={{ repeat: Infinity, duration: .8 }} className={`mx-auto mb-2 rounded-full border-2 border-derby-red bg-derby-red/25 font-headline tracking-[.18em] text-derby-cream ${embedded ? 'w-[54cqw] py-[.55cqh] text-[2cqh]' : 'w-[42vw] py-2 text-[2.2vh]'}`}>
          PLUS QUE {mazeRemaining} DANS LE LABYRINTHE
        </motion.div>
      )}
      <div className={`mx-auto grid grid-cols-2 ${embedded ? 'max-w-[68cqw] gap-[1cqh]' : 'max-w-[58vw] gap-[1.2vh]'}`}>{sorted.map((row,index)=><motion.div layout key={row.playerId} className={`flex min-w-0 items-center justify-between rounded-xl border-2 ${embedded ? 'gap-[1cqw] px-[1.4cqw] py-[1cqh]' : 'px-5 py-3'} ${row.eliminated ? 'border-derby-red bg-derby-red/30' : row.finishedAt ? 'border-derby-green bg-derby-green/25' : 'border-derby-gold/50 bg-derby-night'}`}><span className={`truncate font-headline text-derby-cream ${embedded ? 'text-[2.35cqh]' : 'text-[2.7vh]'}`}>{index+1}. {row.pseudo}</span><span className={`shrink-0 font-terminal ${embedded ? 'text-[2.35cqh]' : 'text-[2.7vh]'} ${row.eliminated ? 'text-derby-red' : 'text-derby-gold'}`}>{row.eliminated ? 'ÉLIMINÉ' : metric(row)}</span></motion.div>)}</div>
    </div>
  </motion.div>
}
