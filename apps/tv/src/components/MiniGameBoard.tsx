'use client'

import type { MiniGameState } from '@last-sip-derby/shared'
import { motion } from 'framer-motion'
import { useNow } from './shared'

export function MiniGameBoard({ game }: { game: MiniGameState }) {
  const now = useNow(100)
  const seconds = Math.max(0, Math.ceil(((game.status === 'RESULTS' ? game.resultsEndAt ?? now : game.endsAt) - now) / 1000))
  const sorted = [...game.players].sort((a,b) => {
    if (game.type === 'CLICKER' || game.type === 'PENALTY' || game.type === 'PRESSURE') return b.score-a.score
    return b.progress-a.progress || (a.finishedAt ?? Infinity)-(b.finishedAt ?? Infinity)
  })
  const metric = (row: typeof sorted[number]) => game.type === 'CLICKER' ? `${row.score} CLICS` : game.type === 'PENALTY' ? `${row.score} BUTS` : game.type === 'PRESSURE' ? `${row.score.toFixed(1)} %` : row.finishedAt ? 'QUALIFIÉ ✓' : game.type === 'ORDER' ? `${row.progress}/16` : 'EN JEU…'
  return <motion.div initial={{scale:1.4,opacity:0}} animate={{scale:1,opacity:1}} className="absolute inset-0 z-[60] flex items-center justify-center bg-black/95 p-[5vh]">
    <div className="w-[70vw] text-center">
      <div className="font-display text-[14vh] leading-none text-derby-gold">?</div>
      <div className="font-headline text-[2.3vh] tracking-[.45em] text-derby-red">DÉFI MIGNON · LE DERNIER EST ÉLIMINÉ</div>
      <h2 className="mt-1 font-display text-[5vh] text-derby-cream">{game.prompt}</h2>
      <div className="my-[2vh] font-terminal text-[5vh] text-derby-gold">{game.status === 'RESULTS' ? `REPRISE DANS ${seconds}` : `${seconds}s`}</div>
      <div className="mx-auto grid max-w-[58vw] grid-cols-2 gap-[1.2vh]">{sorted.map((row,index)=><motion.div layout key={row.playerId} className={`flex items-center justify-between rounded-xl border-2 px-5 py-3 ${row.eliminated ? 'border-derby-red bg-derby-red/30' : row.finishedAt ? 'border-derby-green bg-derby-green/25' : 'border-derby-gold/50 bg-derby-night'}`}><span className="font-headline text-[2.7vh] text-derby-cream">{index+1}. {row.pseudo}</span><span className={`font-terminal text-[2.7vh] ${row.eliminated ? 'text-derby-red' : 'text-derby-gold'}`}>{row.eliminated ? 'ÉLIMINÉ' : metric(row)}</span></motion.div>)}</div>
    </div>
  </motion.div>
}
