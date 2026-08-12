'use client'

import Image from 'next/image'
import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { GameState, Horse } from '@last-sip-derby/shared'

const LAST_PLACE_LINES = [
  'NARLESHEITAN {name}…',
  '{name}, honnêtement tu pues la merde',
  '{name}, wesh accélère frère',
  "{name}, p'tite pute va",
  "T'es vraiment mauvais {name}",
  'Ça va {name} ? Ils sont beaux les culs vus de derrière ?',
  'Espèce de grosse salope {name}…',
  '{name}, arrête de jouer stp',
  "Pfff {name}… ferme-la 5 min stp, on veut plus t'entendre",
  '{name}… tu pues',
  'Regardez miskine {name}, il est dernier hahaha',
  "Hahaha allez {name}, avance par pitié, t'es si nul",
  "Alors {name}… t'es dernier tocard ?",
  "C'est fou d'être nul comme {name}",
  'Oh {name}, même à pied tu irais plus vite',
  "Courage {name}, t'es pas dernier… ah si en fait",
  '{name}, ton cheval ne t’aime pas, c’est tout',
  '{name}, dernier c’est une place aussi',
] as const

const FIRST_PLACE_LINES = [
  'T’es si rapide {name}…',
  '{name}, t’es sur une fusée ou un cheval ?',
  'Le GOAT {name}',
  '{name} vous met une tempête',
  '{name}, t’es prime',
  'Un vrai champion ce {name}',
  'Personne ne peut suivre {name}',
  '{name} a mis le turbo, RIP les autres',
  'Le patron c’est {name}, point barre',
  '{name} en tête, préparez vos verres les autres',
] as const

type Spot = 'FIRST' | 'LAST'

interface PendingChange {
  spot: Spot
  horseId: string
  changedAt: number
}

function bettorsFor(state: GameState, horse: Horse | undefined): string[] {
  if (!horse) return []
  return state.players.filter((player) => player.currentBet?.horseId === horse.id).map((player) => player.pseudo)
}

export function RaceCommentator({ state, suppressed }: { state: GameState; suppressed: boolean }) {
  const ranking = useMemo(
    () => state.horses.filter((horse) => !horse.isEliminated).sort((a, b) => b.position - a.position),
    [state.horses],
  )
  const [comment, setComment] = useState<{ text: string; spot: Spot; id: number } | null>(null)
  const previousExtremes = useRef<{ first: string | null; last: string | null }>({ first: null, last: null })
  const pending = useRef<PendingChange[]>([])
  const used = useRef(new Set<string>())
  const lastCommentAt = useRef(0)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    previousExtremes.current = { first: null, last: null }
    pending.current = []
    used.current.clear()
    lastCommentAt.current = 0
    setComment(null)
  }, [state.raceNumber])

  useEffect(() => () => {
    if (hideTimer.current) clearTimeout(hideTimer.current)
  }, [])

  useEffect(() => {
    if (ranking.length < 2) return
    const now = Date.now()
    const first = ranking[0]
    const last = ranking[ranking.length - 1]
    const previous = previousExtremes.current

    // The first observed ranking establishes the baseline. Only subsequent
    // changes at either extreme are eligible to produce a comment.
    if (previous.first && previous.first !== first.id) {
      pending.current = pending.current.filter((change) => change.spot !== 'FIRST')
      pending.current.push({ spot: 'FIRST', horseId: first.id, changedAt: now })
    }
    if (previous.last && previous.last !== last.id) {
      pending.current = pending.current.filter((change) => change.spot !== 'LAST')
      pending.current.push({ spot: 'LAST', horseId: last.id, changedAt: now })
    }
    previousExtremes.current = { first: first.id, last: last.id }

    if (suppressed || state.racePaused || state.raceProgress < 3 || state.raceProgress > 96) return
    if (now - lastCommentAt.current < 7_000 || pending.current.length === 0) return

    const change = pending.current.shift()!
    const targetHorse = state.horses.find((horse) => horse.id === change.horseId)
    const pseudos = bettorsFor(state, targetHorse)
    if (!pseudos.length) return

    const bank = change.spot === 'FIRST' ? FIRST_PLACE_LINES : LAST_PLACE_LINES
    let available = bank.filter((line) => !used.current.has(line))
    if (!available.length) {
      used.current.clear()
      available = [...bank]
    }
    const line = available[Math.floor(Math.random() * available.length)]
    const pseudo = pseudos[Math.floor(Math.random() * pseudos.length)]
    used.current.add(line)
    lastCommentAt.current = now
    setComment({ text: line.replace('{name}', pseudo), spot: change.spot, id: now })

    if (hideTimer.current) clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => setComment(null), 5_000)
  }, [ranking, state, suppressed])

  const speaking = !!comment && !suppressed
  const laughing = speaking && comment.spot === 'LAST'

  return (
    <div className="pointer-events-none absolute inset-x-0 top-[9.5vh] z-30 h-[27vh]">
      <AnimatePresence>
        {comment && !suppressed && (
          <motion.div
            key={comment.id}
            initial={{ opacity: 0, x: 55, scale: 0.72, rotate: -2 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -24, scale: 0.88 }}
            transition={{ type: 'spring', stiffness: 360, damping: 22 }}
            className={`absolute left-[23vw] top-[13vh] max-w-[50vw] rounded-[1.4rem] border-[3px] bg-derby-night/95 px-[2vw] py-[1.6vh] font-hand text-[3.2vh] font-bold shadow-deep ${comment.spot === 'FIRST' ? 'border-derby-gold text-derby-gold' : 'border-derby-red text-derby-cream'}`}
          >
            <span className="absolute -right-5 bottom-5 h-8 w-8 rotate-45 border-r-[3px] border-t-[3px] border-inherit bg-derby-night" />
            {comment.text}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        animate={laughing
          ? { x: [0, -5, 5, -4, 4, 0], y: [0, -5, 2, -7, 1, 0], rotate: [-3, 5, -5, 4, -4, -3], scale: [1, 1.08, 1.02, 1.1, 1.03, 1] }
          : speaking
            ? { y: [0, -4, 1, -3, 0], rotate: [-2, 1, -1, 2, -2] }
            : { y: [0, -6, 0], rotate: [-2, 1, -2] }}
        transition={laughing
          ? { duration: 0.48, repeat: Infinity, ease: 'easeInOut' }
          : speaking
            ? { duration: 0.85, repeat: Infinity, ease: 'easeInOut' }
            : { duration: 4.6, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute right-[2.2vw] top-0 h-[19vh] w-[19vh] drop-shadow-[0_12px_12px_rgba(0,0,0,0.68)]"
      >
        <Image src="/commentator/commentator-v2.png" alt="Commentateur machiavélique de la course" fill sizes="19vh" className="object-contain" priority />

        <AnimatePresence>
          {speaking && (
            <motion.div
              key={comment.id}
              initial={{ opacity: 0, scaleY: 0.92 }}
              animate={{
                opacity: 1,
                scaleY: laughing ? [1, 1.32, 0.94, 1.38, 1] : [1, 1.13, 0.96, 1.18, 1],
              }}
              exit={{ opacity: 0 }}
              transition={{ duration: laughing ? 0.34 : 0.52, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute inset-0"
              style={{ clipPath: 'polygon(34% 45%, 76% 43%, 76% 79%, 35% 81%)', transformOrigin: '57% 64%' }}
            >
              <Image src="/commentator/commentator-v2.png" alt="" aria-hidden fill sizes="19vh" className="object-contain" />
            </motion.div>
          )}
        </AnimatePresence>

        {laughing && (
          <>
            <motion.span
              animate={{ opacity: [0, 1, 0], x: [0, -35], y: [0, -42], rotate: [0, -18] }}
              transition={{ duration: 0.9, repeat: Infinity }}
              className="absolute -left-[2vw] top-[2vh] font-display text-[2.8vh] text-derby-red"
            >
              HA!
            </motion.span>
            <motion.span
              animate={{ opacity: [0, 1, 0], x: [0, 28], y: [0, -35], rotate: [0, 15] }}
              transition={{ duration: 0.9, delay: 0.32, repeat: Infinity }}
              className="absolute -right-[1vw] top-[5vh] font-display text-[2.4vh] text-derby-gold"
            >
              HA!
            </motion.span>
          </>
        )}
      </motion.div>
    </div>
  )
}
