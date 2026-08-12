'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { GameState, Horse } from '@last-sip-derby/shared'

type CommentMood = 'TALK' | 'LAUGH' | 'REACT'

interface CommentMessage {
  id: number
  key: string
  text: string
  priority: number
  duration: number
  mood: CommentMood
  createdAt: number
}

interface HorseSnapshot {
  rank: number
  position: number
  effectiveSpeed: number
  isEliminated: boolean
  isReversed: boolean
  jockeyFallen: boolean
}

const LEAD_LINES = [
  '{horse} prend les commandes de la course !',
  'Nouveau leader : {horse} passe devant tout le monde !',
  '{horse} s’installe en tête, la ligne droite va être brûlante !',
] as const

const PASS_LINES = [
  '{horse} déborde {other} et gagne une place !',
  'Belle attaque de {horse}, qui passe devant {other} !',
  '{horse} trouve l’ouverture et dépasse {other} !',
] as const

const COMEBACK_LINES = [
  '{horse} remonte comme une balle : {count} places gagnées !',
  'Grosse accélération de {horse}, qui avale {count} concurrents !',
  '{horse} lance une remontée spectaculaire !',
] as const

const DROP_LINES = [
  '{horse} perd {count} places dans la bagarre !',
  'Coup dur pour {horse}, repoussé de {count} positions !',
  '{horse} recule brutalement dans le classement !',
] as const

const SURGE_LINES = [
  '{horse} place une accélération impressionnante !',
  'Quel changement de rythme de {horse} !',
  '{horse} met les gaz et revient très fort !',
] as const

const LAST_LINES = [
  '{name}, joli panorama depuis le fond du classement !',
  '{name}, ton cheval visite la piste à son rythme, visiblement.',
  '{name}, même le panneau d’arrivée commence à s’impatienter.',
  '{name}, tu fermes la marche avec une élégance très personnelle.',
  '{name}, excellente stratégie… si le but était d’arriver demain.',
  '{name}, le peloton demande si tu as besoin d’un plan.',
] as const

const REVERSE_LINES = [
  '{name}, demi-tour artistique ! La sortie est pourtant de l’autre côté.',
  '{name}, ton cheval vient de contester le sens de circulation.',
  '{name}, superbe idée : courir vers le départ pour finir plus vite.',
] as const

const INCIDENT_LINES = [
  '{name}, ça pique ! On va faire comme si personne n’avait vu.',
  '{name}, ton plan vient de prendre un léger coup de sabot.',
  '{name}, la piste t’envoie ses salutations les moins distinguées.',
] as const

const FIRST_LINES = [
  '{name} est devant. Profite, ça ne durera peut-être pas.',
  '{name} mène la danse… les autres, vous pouvez applaudir.',
  '{name} en tête : enfin quelqu’un qui a lu les règles.',
] as const

function fill(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce((text, [key, value]) => text.replace(`{${key}}`, String(value)), template)
}

function pick<T>(items: readonly T[], seed: number): T {
  return items[Math.abs(seed) % items.length]
}

function bettorName(state: GameState, horse: Horse): string {
  const bettors = state.players.filter((player) => player.currentBet?.horseId === horse.id)
  if (!bettors.length) return horse.name
  return bettors[Math.abs(Math.round(horse.position * 10) + state.raceNumber) % bettors.length].pseudo
}

function useCommentLane(suppressed: boolean, raceNumber: number, cooldownMs: number) {
  const queueRef = useRef<CommentMessage[]>([])
  const recentRef = useRef(new Map<string, number>())
  const recentTextRef = useRef(new Map<string, number>())
  const counterRef = useRef(0)
  const [current, setCurrent] = useState<CommentMessage | null>(null)
  const [version, setVersion] = useState(0)

  const enqueue = useCallback((message: Omit<CommentMessage, 'id' | 'createdAt'>) => {
    const now = Date.now()
    const last = recentRef.current.get(message.key) ?? 0
    const lastSameText = recentTextRef.current.get(message.text) ?? 0
    if (now - last < cooldownMs || now - lastSameText < 20_000) return false
    recentRef.current.set(message.key, now)
    recentTextRef.current.set(message.text, now)
    for (const [key, timestamp] of recentRef.current) {
      if (now - timestamp > 45_000) recentRef.current.delete(key)
    }
    const next = { ...message, id: ++counterRef.current, createdAt: now }
    queueRef.current = [...queueRef.current, next]
      .sort((a, b) => b.priority - a.priority || a.createdAt - b.createdAt)
      .slice(0, 5)
    setVersion((value) => value + 1)
    return true
  }, [cooldownMs])

  useEffect(() => {
    queueRef.current = []
    recentRef.current.clear()
    recentTextRef.current.clear()
    setCurrent(null)
    setVersion((value) => value + 1)
  }, [raceNumber])

  useEffect(() => {
    if (suppressed || current || !queueRef.current.length) return
    const timer = window.setTimeout(() => {
      const next = queueRef.current.shift() ?? null
      setCurrent(next)
      setVersion((value) => value + 1)
    }, 180)
    return () => window.clearTimeout(timer)
  }, [current, suppressed, version])

  useEffect(() => {
    if (!current || suppressed) return
    const timer = window.setTimeout(() => setCurrent(null), current.duration)
    return () => window.clearTimeout(timer)
  }, [current, suppressed])

  return { current: suppressed ? null : current, enqueue }
}

export function RaceCommentator({ state, suppressed }: { state: GameState; suppressed: boolean }) {
  const { current: mainComment, enqueue: enqueueMain } = useCommentLane(suppressed, state.raceNumber, 5_500)
  const { current: villainComment, enqueue: enqueueVillain } = useCommentLane(suppressed, state.raceNumber, 8_000)
  const snapshotsRef = useRef(new Map<string, HorseSnapshot>())
  const incidentAtRef = useRef(new Map<string, number>())
  const previousLeaderRef = useRef<string | null>(null)
  const milestonesRef = useRef(new Set<number>())
  const stableLeaderRef = useRef<{ id: string | null; since: number; praised: boolean }>({ id: null, since: 0, praised: false })

  const ranking = useMemo(
    () => state.horses.filter((horse) => !horse.isEliminated).sort((a, b) => b.position - a.position),
    [state.horses],
  )

  useEffect(() => {
    snapshotsRef.current.clear()
    incidentAtRef.current.clear()
    previousLeaderRef.current = null
    milestonesRef.current.clear()
    stableLeaderRef.current = { id: null, since: Date.now(), praised: false }
  }, [state.raceNumber])

  useEffect(() => {
    const now = Date.now()
    const previous = snapshotsRef.current
    const next = new Map<string, HorseSnapshot>()
    const rankById = new Map(ranking.map((horse, index) => [horse.id, index]))
    const leader = ranking[0]
    let incidentThisTick = false

    // Suppression still refreshes the baseline. Events hidden behind a modal
    // therefore never flood both queues when the race resumes.
    const canComment = !suppressed && !state.racePaused && state.raceProgress >= 4 && state.raceProgress <= 97

    for (const horse of state.horses) {
      const rank = rankById.get(horse.id) ?? state.horses.length
      const old = previous.get(horse.id)
      next.set(horse.id, {
        rank,
        position: horse.position,
        effectiveSpeed: horse.effectiveSpeed,
        isEliminated: horse.isEliminated,
        isReversed: horse.isReversed,
        jockeyFallen: horse.jockeyFallen,
      })
      if (!old || !canComment) continue

      const incidentStarted = (!old.isReversed && horse.isReversed) ||
        (!old.isEliminated && horse.isEliminated) ||
        (!old.jockeyFallen && horse.jockeyFallen)
      if (incidentStarted) {
        incidentAtRef.current.set(horse.id, now)
        incidentThisTick = true
      }
      const incidentRecent = now - (incidentAtRef.current.get(horse.id) ?? 0) < 4_500
      const gained = old.rank - rank
      const lost = rank - old.rank
      if (!incidentRecent && gained >= 2 && rank > 0 && !horse.isEliminated) {
        enqueueMain({
          key: `comeback:${horse.id}`,
          text: fill(pick(COMEBACK_LINES, now + horse.lane), { horse: horse.name, count: gained }),
          priority: 3,
          duration: 4_300,
          mood: 'REACT',
        })
      } else if (!incidentRecent && gained === 1 && rank > 0 && !horse.isEliminated) {
        const passed = ranking[rank + 1]
        if (passed) enqueueMain({
          key: `pass:${horse.id}:${passed.id}`,
          text: fill(pick(PASS_LINES, now + horse.lane), { horse: horse.name, other: passed.name }),
          priority: 1,
          duration: 3_900,
          mood: 'TALK',
        })
      } else if (!incidentRecent && lost >= 2 && !horse.isEliminated) {
        enqueueMain({
          key: `drop:${horse.id}`,
          text: fill(pick(DROP_LINES, now + horse.lane), { horse: horse.name, count: lost }),
          priority: 2,
          duration: 4_100,
          mood: 'REACT',
        })
      } else if (!incidentRecent && horse.effectiveSpeed > 5.2 && horse.effectiveSpeed - old.effectiveSpeed > 1.2) {
        enqueueMain({
          key: `surge:${horse.id}`,
          text: fill(pick(SURGE_LINES, now + horse.lane), { horse: horse.name }),
          priority: 1,
          duration: 3_900,
          mood: 'TALK',
        })
      }

      if (!old.isReversed && horse.isReversed) {
        enqueueVillain({
          key: `reverse:${horse.id}`,
          text: fill(pick(REVERSE_LINES, now + horse.lane), { name: bettorName(state, horse) }),
          priority: 4,
          duration: 4_700,
          mood: 'LAUGH',
        })
      } else if ((!old.isEliminated && horse.isEliminated) || (!old.jockeyFallen && horse.jockeyFallen)) {
        enqueueVillain({
          key: `incident:${horse.id}`,
          text: fill(pick(INCIDENT_LINES, now + horse.lane), { name: bettorName(state, horse) }),
          priority: 4,
          duration: 4_500,
          mood: 'REACT',
        })
      }
    }

    if (leader) {
      const previousLeader = previousLeaderRef.current
      if (canComment && !incidentThisTick && previousLeader && previousLeader !== leader.id) {
        enqueueMain({
          key: `leader:${leader.id}`,
          text: fill(pick(LEAD_LINES, now + leader.lane), { horse: leader.name }),
          priority: 5,
          duration: 4_500,
          mood: 'REACT',
        })
      }
      previousLeaderRef.current = leader.id

      if (stableLeaderRef.current.id !== leader.id) {
        stableLeaderRef.current = { id: leader.id, since: now, praised: false }
      } else if (canComment && !stableLeaderRef.current.praised && now - stableLeaderRef.current.since > 11_000) {
        stableLeaderRef.current.praised = true
        enqueueVillain({
          key: `first:${leader.id}`,
          text: fill(pick(FIRST_LINES, now + leader.lane), { name: bettorName(state, leader) }),
          priority: 1,
          duration: 4_300,
          mood: 'TALK',
        })
      }
    }

    const last = ranking[ranking.length - 1]
    if (canComment && last && ranking.length > 1) {
      const oldLast = previous.get(last.id)
      const becameLast = oldLast && oldLast.rank !== ranking.length - 1
      const gap = (ranking[ranking.length - 2]?.position ?? last.position) - last.position
      if (becameLast || gap > 4.5) {
        enqueueVillain({
          key: `last:${last.id}`,
          text: fill(pick(LAST_LINES, now + last.lane), { name: bettorName(state, last) }),
          priority: gap > 7 ? 3 : 2,
          duration: 4_700,
          mood: 'LAUGH',
        })
      }
    }

    for (const milestone of [75, 90]) {
      if (canComment && state.raceProgress >= milestone && !milestonesRef.current.has(milestone)) {
        milestonesRef.current.add(milestone)
        enqueueMain({
          key: `finale:${milestone}`,
          text: milestone === 75
            ? 'Le peloton entre dans le dernier quart : tout peut encore basculer !'
            : 'Dernière ligne droite ! La victoire va se jouer maintenant !',
          priority: 4,
          duration: 4_500,
          mood: 'REACT',
        })
      }
    }

    snapshotsRef.current = next
  }, [enqueueMain, enqueueVillain, ranking, state, suppressed])

  return (
    <motion.div
      animate={{ opacity: suppressed ? 0 : 1 }}
      transition={{ duration: .2 }}
      aria-hidden={suppressed}
      className="pointer-events-none absolute inset-0 z-30"
    >
      <AnimatePresence mode="wait">
        {mainComment && (
          <motion.div
            key={mainComment.id}
            data-testid="main-race-comment"
            initial={{ opacity: 0, y: -15, scale: .96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: .98 }}
            transition={{ duration: .25, ease: 'easeOut' }}
            className="absolute left-[22vw] top-[14vh] w-[41vw] overflow-hidden rounded-xl border border-[#7db8c7]/70 bg-[#09161c]/92 shadow-[0_12px_30px_rgba(0,0,0,.55)] backdrop-blur-md"
          >
            <div className="flex items-center gap-[.7vw] border-b border-white/10 bg-[#17434e]/70 px-[1.1vw] py-[.45vh]">
              <span className="h-[.7vh] w-[.7vh] animate-pulse rounded-full bg-[#79d4e8]" />
              <span className="font-headline text-[1.35vh] tracking-[.3em] text-[#b9ebf2]">COMMENTAIRE DE COURSE</span>
            </div>
            <div className="px-[1.2vw] py-[1vh] font-headline text-[2.45vh] leading-[1.05] tracking-[.045em] text-derby-cream">
              {mainComment.text}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="absolute right-[1.4vw] top-[13.2vh] flex w-[34vw] items-start justify-end gap-[.8vw]">
        <AnimatePresence mode="wait">
          {villainComment && (
            <motion.div
              key={villainComment.id}
              data-testid="villain-comment"
              initial={{ opacity: 0, x: 30, scale: .82, rotate: -1 }}
              animate={{ opacity: 1, x: 0, scale: 1, rotate: 0 }}
              exit={{ opacity: 0, x: 16, scale: .9 }}
              transition={{ type: 'spring', stiffness: 380, damping: 24 }}
              className="relative mt-[1.4vh] w-[21vw] rounded-[1.1rem] border-[.22vh] border-derby-red bg-[#190a0c]/95 px-[1.15vw] pb-[1.15vh] pt-[.8vh] shadow-[0_12px_28px_rgba(0,0,0,.6)]"
            >
              <span className="absolute -right-[.65vw] top-[3.4vh] h-[1.2vw] w-[1.2vw] rotate-45 border-r-[.22vh] border-t-[.22vh] border-derby-red bg-[#190a0c]" />
              <div className="mb-[.3vh] font-headline text-[1.15vh] tracking-[.25em] text-derby-red">LA MAUVAISE LANGUE</div>
              <div className="font-hand text-[2.2vh] font-bold leading-[1.08] text-derby-cream">{villainComment.text}</div>
            </motion.div>
          )}
        </AnimatePresence>
        <VillainAvatar mood={villainComment?.mood ?? 'TALK'} speaking={!!villainComment} />
      </div>
    </motion.div>
  )
}

function VillainAvatar({ mood, speaking }: { mood: CommentMood; speaking: boolean }) {
  const laughing = speaking && mood === 'LAUGH'
  return (
    <motion.div
      data-testid="animated-villain-avatar"
      animate={laughing
        ? { y: [0, -4, 1, -5, 0], rotate: [-2, 3, -3, 2, -2] }
        : speaking
          ? { y: [0, -2, 0], rotate: [-1, 1, -1] }
          : { y: [0, -3, 0], rotate: [-1, .5, -1] }}
      transition={{ duration: laughing ? .42 : speaking ? .75 : 3.8, repeat: Infinity, ease: 'easeInOut' }}
      className="relative h-[16vh] w-[12vw] shrink-0 drop-shadow-[0_12px_9px_rgba(0,0,0,.65)]"
    >
      <svg viewBox="0 0 220 190" role="img" aria-label="Commentateur cartoon moqueur" className="h-full w-full overflow-visible">
        <defs>
          <linearGradient id="villain-face" x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#f3b46d" />
            <stop offset=".55" stopColor="#d77b45" />
            <stop offset="1" stopColor="#9c472e" />
          </linearGradient>
          <linearGradient id="villain-hair" x1="0" y1="0" x2="0" y2="1">
            <stop stopColor="#31151d" />
            <stop offset="1" stopColor="#10070a" />
          </linearGradient>
        </defs>
        <path d="M34 84C25 42 52 11 88 20 116-6 176 13 180 54c27 12 21 52 0 61l-14-20L49 105Z" fill="url(#villain-hair)" stroke="#070405" strokeWidth="7" strokeLinejoin="round" />
        <path d="m48 48-24-29 38 12L70 3l20 25 21-24 5 27 35-18-12 31Z" fill="#441927" stroke="#10070a" strokeWidth="6" strokeLinejoin="round" />
        <ellipse cx="36" cy="96" rx="20" ry="27" fill="#bf603a" stroke="#5c261f" strokeWidth="6" />
        <ellipse cx="184" cy="96" rx="20" ry="27" fill="#bf603a" stroke="#5c261f" strokeWidth="6" />
        <path d="M43 78C45 31 78 22 111 25c42-4 72 18 72 67 0 59-32 90-74 90-45 0-72-36-66-104Z" fill="url(#villain-face)" stroke="#5c261f" strokeWidth="7" />
        <path d="M58 65c14-18 37-15 48-5M159 64c-13-17-33-16-45-5" fill="none" stroke="#341015" strokeWidth="10" strokeLinecap="round" />
        <path d="m62 72 42 10-39 12ZM158 72l-42 10 39 12Z" fill="#fff8dd" stroke="#6b2c25" strokeWidth="4" strokeLinejoin="round" />
        <motion.circle animate={speaking ? { cx: [84, 89, 84] } : { cx: 84 }} transition={{ duration: 1.1, repeat: Infinity }} cx="84" cy="83" r="6" fill="#13070a" />
        <motion.circle animate={speaking ? { cx: [136, 131, 136] } : { cx: 136 }} transition={{ duration: 1.1, repeat: Infinity }} cx="136" cy="83" r="6" fill="#13070a" />
        <path d="M111 78 98 113l18 5" fill="none" stroke="#803628" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M69 119q42 42 84-1-3 55-44 55-36 0-40-54Z" fill="#23080c" stroke="#5c1a1d" strokeWidth="5" />
        <path d="M75 123q35 23 71-1l-6 18H82Z" fill="#fff7dc" stroke="#c6aa8a" strokeWidth="3" strokeLinejoin="round" />
        <g stroke="#b08c73" strokeWidth="2">
          <path d="M94 130v12M109 133v12M124 130v12" />
        </g>
        <motion.g
          animate={speaking ? { scaleY: laughing ? [1, 1.65, .9, 1.7, 1] : [1, 1.28, .9, 1.38, 1] } : { scaleY: 1 }}
          transition={{ duration: laughing ? .34 : .5, repeat: speaking ? Infinity : 0, ease: 'easeInOut' }}
          style={{ transformOrigin: '110px 151px' }}
        >
          <path d="M84 145q27 17 53-1-7 27-28 27-18 0-25-26Z" fill="#a62635" />
          <path d="M93 159q16-8 32 0-15 10-32 0Z" fill="#e4556b" />
        </motion.g>
        <path d="M57 112q-16 9-20 22M162 112q17 8 21 22" fill="none" stroke="#8c3c2e" strokeWidth="4" strokeLinecap="round" />
      </svg>
      {laughing && (
        <>
          <motion.span animate={{ opacity: [0, 1, 0], x: [0, -18], y: [0, -28] }} transition={{ duration: .8, repeat: Infinity }} className="absolute left-0 top-[2vh] font-display text-[2.2vh] text-derby-red">HA!</motion.span>
          <motion.span animate={{ opacity: [0, 1, 0], x: [0, 18], y: [0, -25] }} transition={{ duration: .8, delay: .28, repeat: Infinity }} className="absolute right-0 top-[4vh] font-display text-[1.8vh] text-derby-gold">HA!</motion.span>
        </>
      )}
    </motion.div>
  )
}
