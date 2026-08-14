'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { GameState, Horse } from '@last-sip-derby/shared'

type CommentMood = 'TALK' | 'LAUGH' | 'REACT'

interface CommentMessage {
  id: number
  key: string
  text: string
  playerName?: string
  parts?: HighlightedTextPart[]
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

// The minimap occupies 9vh → 13.4vh. The former text gap was 0.6vh;
// tripling it places both text blocks at 15.2vh while the avatar stays at 14vh.
const TIMELINE_BOTTOM_VH = 13.4
const PREVIOUS_COMMENT_GAP_VH = 0.6
const COMMENT_GAP_MULTIPLIER = 3
const COMMENT_TEXT_TOP_VH = TIMELINE_BOTTOM_VH + PREVIOUS_COMMENT_GAP_VH * COMMENT_GAP_MULTIPLIER
const COMMENT_AVATAR_TOP_VH = 14
const VILLAIN_BUBBLE_OFFSET_VH = COMMENT_TEXT_TOP_VH - COMMENT_AVATAR_TOP_VH

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

export const VILLAIN_LAST_LINES = [
  'Alors {{pseudo}} t’es dernier tocard ?',
  'Je crois que {{pseudo}} veut pas gagner.',
  'C’est fou d’être nul comme {{pseudo}}',
  'Bon {{pseudo}} tu commences à jouer ?',
  'Ptdrr regardez {{pseudo}} il est dernier',
  '{{pseudo}} est pas pressé hein…',
  'Aller on encourage {{pseudo}}',
  'Miskine {{pseudo}}',
  '{{pseudo}} est un beau perdant',
  '{{pseudo}} ça parle pas trop là hein ?',
  'Je crois que {{pseudo}} est dernier',
  'j’suis mort comment il est nul {{pseudo}}',
  '{{pseudo}} tu veux un café chef ?',
  '{{pseudo}} est dernier, regardez-le',
  'HAHAHAHA {{pseudo}} aller mon grand continue',
  '{{pseudo}} qui se fait enculer en détente',
  '{{pseudo}} tu te fais enculer par ton cheval ou quoi ?',
  'Pleure pas {{pseudo}}',
  'Bah alors {{pseudo}} c’est qui qui va boire ?',
  '{{pseudo}} t’es nul',
  '{{pseudo}} looserrrrrr',
  't’es un gros nullos {{pseudo}}',
  '{{pseudo}} t’avais espoir de gagner en plus mdrrr ?',
  '{{pseudo}} aller remplis ton verre garçon',
  "Oh {{pseudo}} t'as oublié de démarrer ou quoi ?",
  "{{pseudo}} même à pied t'irais plus vite",
  "Y'a {{pseudo}} et y'a les autres.",
  "Mais lâche ton téléphone {{pseudo}} t'es dernier là",
  '{{pseudo}} tu joues à quoi là sérieux ?',
  "Franchement {{pseudo}} lâche l'affaire, bois direct et ftg",
  "{{pseudo}} ce soir c'est toi la victime, on l'a tous compris",
  "Petit rappel {{pseudo}} : le but c'est d'avancer",
  '{{pseudo}} ton verre va être plein ce soir mon pauvre',
  'Ohhh {{pseudo}} il est encore là au fond mdrrr',
  "{{pseudo}} t'as parié avec tes pieds ou quoi ?",
  "Courage {{pseudo}} t'es pas dernier… ah si en fait",
  '{{pseudo}} même ma grand-mère te dépasse',
  'Tu sais quoi {{pseudo}} ? Aujourd’hui t’es ma pute',
  '{{pseudo}} ta vielle coupe là',
  "{{pseudo}} ton cheval il t'aime pas c'est tout",
  "{{pseudo}} faut le dire si tu veux pas jouer hein",
  "{{pseudo}} t'inquiète, dernier c'est une place aussi",
  '{{pseudo}} tu fais pitié carrément',
  '{{pseudo}} p’tite merde va',
  '{{pseudo}} t’as une copine ?',
  'NARLESHEITAN {{pseudo}}',
  '{{pseudo}} hônnetement tu pues la merde',
  '{{pseudo}} wesh accelère frère',
  "{{pseudo}} p'tite pute va",
  "{{pseudo}} T'es vraiment mauvais",
  'ça va {{pseudo}} ? Il sont beaux les culs vus de derrière ?',
  'Espèce de grosse salope {{pseudo}}',
  '{{pseudo}} arrête de jouer stp',
  "Pfff {{pseudo}} ferme là 5min stp, on veut plus t'entendre",
  '{{pseudo}} tu pues',
  '{{pseudo}} tu me fait de la peine mdr',
  'Regardez miskine {{pseudo}} il est dernier hahaha',
  "Hahaha aller {{pseudo}} avance par pitié t'es si nul",
  '{{pseudo}} tu vas prendre 2 bifles',
  'Bah alors salope de {{pseudo}} on est dernier ?',
  '{{pseudo}} t’en as pas marre d’être nul ?',
  '{{pseudo}} sale raciste',
  'WESH {{pseudo}} ARCHEUM PELO AVANCE TA MÈRE',
  'T’es dernier {{pseudo}} bouffe moi le cul',
  'STARFOULAH REGARDEZ {{pseudo}} IL EST DERNIER MSKN',
] as const

export const VILLAIN_FIRST_LINES = [
  'T’es si rapide {{pseudo}}',
  '{{pseudo}} t’es sur une fusée ou un cheval ?',
  '{{pseudo}} t’as un T-Max ou un cheval ?',
  'Le GOAT {{pseudo}}',
  '{{pseudo}} vous met une tempête',
  '{{pseudo}} t’es prime',
  '{{pseudo}} quel étalon',
  '{{pseudo}} gros beau gosse va',
  'un vrai champion ce {{pseudo}}',
  '{{pseudo}} t’es un roi',
  'Personne peut suivre {{pseudo}}',
  '{{pseudo}} roule en Ferrari, les autres en trottinette',
  'Chapeau bas {{pseudo}} quel monstre',
  '{{pseudo}} a mis le turbo, RIP les autres',
  'On arrête le chrono ? {{pseudo}} a déjà gagné',
  '{{pseudo}} laisse-en un peu aux autres steuplé',
  "Le patron c'est {{pseudo}} point barre",
  '{{pseudo}} tu cours ou tu voles là ?',
  '{{pseudo}} t’es beau',
  '{{pseudo}} je vais te faire le cul',
  '{{pseudo}} est en mode Fast and Furious',
  "Tout le monde derrière {{pseudo}} comme d'hab",
  "{{pseudo}} distribue une leçon d'humilité à la piste",
  "Génie {{pseudo}} t'as vendu ton âme ou quoi ?",
  'Standing ovation pour {{pseudo}} quelle machine',
  "{{pseudo}} a pris l'autoroute, les autres la départementale",
  "Respect {{pseudo}} t'écrases tout le monde là",
  "{{pseudo}} c'est Mbappé version cheval",
  "Personne au niveau de {{pseudo}} c'est plié les gars",
  '{{pseudo}} en tête, préparez vos verres les autres',
  '{{pseudo}} montre tes fesses stp',
  'On va tous te sucer je crois {{pseudo}}',
] as const

export type VillainCommentCategory = 'FIRST' | 'LAST'

export interface VillainPhraseHistory {
  recent: number[]
  used: number[]
}

export interface VillainPhraseSelection {
  text: string
  template: string
  templateIndex: number
  parts: HighlightedTextPart[]
  history: VillainPhraseHistory
}

export interface HighlightedTextPart {
  text: string
  highlighted: boolean
}

/**
 * Tokenise les marqueurs {{pseudo}} de la banque avant insertion. Le pseudonyme n'est
 * jamais interprété comme du HTML et seules les positions des marqueurs sont
 * signalées comme mises en valeur, même pour un pseudo court comme « est ».
 */
export function tokenizeVillainPhrase(template: string, playerName: string): HighlightedTextPart[] {
  const markerRe = /\{\{pseudo\}\}/g
  const parts: HighlightedTextPart[] = []
  let cursor = 0
  let marker = markerRe.exec(template)

  const append = (text: string, highlighted: boolean) => {
    if (!text) return
    const previous = parts[parts.length - 1]
    if (previous && previous.highlighted === highlighted) previous.text += text
    else parts.push({ text, highlighted })
  }

  while (marker) {
    append(template.slice(cursor, marker.index), false)
    append(playerName, true)
    cursor = marker.index + marker[0].length
    marker = markerRe.exec(template)
  }
  append(template.slice(cursor), false)
  return parts.length ? parts : [{ text: template, highlighted: false }]
}

/** Remplace les marqueurs en conservant une version texte pour la file et l'accessibilité. */
export function replaceVillainNameMarkers(template: string, playerName: string): string {
  return tokenizeVillainPhrase(template, playerName).map((part) => part.text).join('')
}

export function createVillainPhraseHistory(): VillainPhraseHistory {
  return { recent: [], used: [] }
}

/**
 * Sélection déterministe et testable : aucun modèle génératif, aucun texte hors banque.
 * Les phrases récentes sont exclues et le cycle repart après 60 % de la banque.
 */
export function selectVillainPhrase(
  category: VillainCommentCategory,
  playerName: string,
  history: VillainPhraseHistory,
  seed: number,
): VillainPhraseSelection {
  const bank = category === 'FIRST' ? VILLAIN_FIRST_LINES : VILLAIN_LAST_LINES
  const resetThreshold = Math.max(1, Math.ceil(bank.length * .6))
  const used = history.used.length >= resetThreshold ? [] : history.used.filter((index) => index < bank.length)
  const recent = history.recent.filter((index) => index < bank.length)
  const preferred = bank.map((_, index) => index).filter((index) => !used.includes(index) && !recent.includes(index))
  const fallback = bank.map((_, index) => index).filter((index) => !recent.includes(index))
  const candidates = preferred.length ? preferred : fallback.length ? fallback : bank.map((_, index) => index)
  const templateIndex = candidates[Math.abs(Math.trunc(seed)) % candidates.length]
  const template = bank[templateIndex]
  const recentLimit = Math.min(6, Math.max(1, bank.length - 1))
  const parts = tokenizeVillainPhrase(template, playerName)

  return {
    text: parts.map((part) => part.text).join(''),
    template,
    templateIndex,
    parts,
    history: {
      recent: [...recent, templateIndex].slice(-recentLimit),
      used: [...used, templateIndex],
    },
  }
}

function fill(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce((text, [key, value]) => text.replace(`{${key}}`, String(value)), template)
}

function pick<T>(items: readonly T[], seed: number): T {
  return items[Math.abs(seed) % items.length]
}

function bettorName(state: GameState, horse: Horse): string | null {
  const bettors = state.players.filter((player) => player.currentBet?.horseId === horse.id)
  if (!bettors.length) return null
  return bettors[Math.abs(Math.round(horse.position * 10) + state.raceNumber) % bettors.length].pseudo
}

function usePausableNow(paused: boolean): () => number {
  const clockRef = useRef({ paused: false, pausedAt: 0, elapsedPauses: 0 })

  useEffect(() => {
    const wallNow = Date.now()
    if (paused && !clockRef.current.paused) {
      clockRef.current.paused = true
      clockRef.current.pausedAt = wallNow
    } else if (!paused && clockRef.current.paused) {
      clockRef.current.elapsedPauses += Math.max(0, wallNow - clockRef.current.pausedAt)
      clockRef.current.paused = false
      clockRef.current.pausedAt = 0
    }
  }, [paused])

  return useCallback(() => {
    const currentWallTime = clockRef.current.paused ? clockRef.current.pausedAt : Date.now()
    return currentWallTime - clockRef.current.elapsedPauses
  }, [])
}

function useCommentLane(suppressed: boolean, paused: boolean, raceNumber: number, cooldownMs: number) {
  const queueRef = useRef<CommentMessage[]>([])
  const recentRef = useRef(new Map<string, number>())
  const recentTextRef = useRef(new Map<string, number>())
  const counterRef = useRef(0)
  const displayDeadlineRef = useRef(0)
  const displayRemainingRef = useRef(0)
  const [current, setCurrent] = useState<CommentMessage | null>(null)
  const [version, setVersion] = useState(0)
  const commentNow = usePausableNow(paused)

  const enqueue = useCallback((message: Omit<CommentMessage, 'id' | 'createdAt'>) => {
    const now = commentNow()
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
  }, [commentNow, cooldownMs])

  useEffect(() => {
    queueRef.current = []
    recentRef.current.clear()
    recentTextRef.current.clear()
    setCurrent(null)
    setVersion((value) => value + 1)
  }, [raceNumber])

  useEffect(() => {
    if (suppressed || paused || current || !queueRef.current.length) return
    const timer = window.setTimeout(() => {
      const next = queueRef.current.shift() ?? null
      setCurrent(next)
      setVersion((value) => value + 1)
    }, 180)
    return () => window.clearTimeout(timer)
  }, [current, paused, suppressed, version])

  useEffect(() => {
    if (!current) {
      displayDeadlineRef.current = 0
      displayRemainingRef.current = 0
      return
    }
    if (suppressed || paused) return

    const duration = displayRemainingRef.current > 0 ? displayRemainingRef.current : current.duration
    displayDeadlineRef.current = Date.now() + duration
    const timer = window.setTimeout(() => {
      displayRemainingRef.current = 0
      displayDeadlineRef.current = 0
      setCurrent(null)
    }, duration)
    return () => {
      window.clearTimeout(timer)
      displayRemainingRef.current = Math.max(0, displayDeadlineRef.current - Date.now())
    }
  }, [current, paused, suppressed])

  return { current: suppressed ? null : current, enqueue }
}

export function RaceCommentator({ state, suppressed }: { state: GameState; suppressed: boolean }) {
  const { current: mainComment, enqueue: enqueueMain } = useCommentLane(suppressed, state.isGamePaused, state.raceNumber, 5_500)
  const { current: villainComment, enqueue: enqueueVillain } = useCommentLane(suppressed, state.isGamePaused, state.raceNumber, 8_000)
  const snapshotsRef = useRef(new Map<string, HorseSnapshot>())
  const incidentAtRef = useRef(new Map<string, number>())
  const previousLeaderRef = useRef<string | null>(null)
  const milestonesRef = useRef(new Set<number>())
  const stableLeaderRef = useRef<{ id: string | null; since: number; praised: boolean }>({ id: null, since: 0, praised: false })
  const villainPhraseHistoryRef = useRef<Record<VillainCommentCategory, VillainPhraseHistory>>({
    FIRST: createVillainPhraseHistory(),
    LAST: createVillainPhraseHistory(),
  })
  const commentNow = usePausableNow(state.isGamePaused)

  const ranking = useMemo(
    () => state.horses.filter((horse) => !horse.isEliminated).sort((a, b) => b.position - a.position),
    [state.horses],
  )

  useEffect(() => {
    snapshotsRef.current.clear()
    incidentAtRef.current.clear()
    previousLeaderRef.current = null
    milestonesRef.current.clear()
    stableLeaderRef.current = { id: null, since: commentNow(), praised: false }
    villainPhraseHistoryRef.current = {
      FIRST: createVillainPhraseHistory(),
      LAST: createVillainPhraseHistory(),
    }
  }, [commentNow, state.raceNumber])

  useEffect(() => {
    const now = commentNow()
    const previous = snapshotsRef.current
    const next = new Map<string, HorseSnapshot>()
    const rankById = new Map(ranking.map((horse, index) => [horse.id, index]))
    const leader = ranking[0]
    let incidentThisTick = false

    // Suppression still refreshes the baseline. Events hidden behind a modal
    // therefore never flood both queues when the race resumes.
    const canComment = !suppressed && !state.isGamePaused && !state.racePaused && state.raceProgress >= 4 && state.raceProgress <= 97

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
        const playerName = bettorName(state, leader)
        if (playerName) {
          const selection = selectVillainPhrase(
            'FIRST',
            playerName,
            villainPhraseHistoryRef.current.FIRST,
            now + leader.lane,
          )
          const accepted = enqueueVillain({
            key: `first:${leader.id}`,
            text: selection.text,
            playerName,
            parts: selection.parts,
            priority: 1,
            duration: 4_300,
            mood: 'TALK',
          })
          if (accepted) {
            villainPhraseHistoryRef.current.FIRST = selection.history
            stableLeaderRef.current.praised = true
          }
        } else {
          stableLeaderRef.current.praised = true
        }
      }
    }

    const last = ranking[ranking.length - 1]
    if (canComment && last && ranking.length > 1) {
      const oldLast = previous.get(last.id)
      const becameLast = oldLast && oldLast.rank !== ranking.length - 1
      const gap = (ranking[ranking.length - 2]?.position ?? last.position) - last.position
      if (becameLast || gap > 4.5) {
        const playerName = bettorName(state, last)
        if (playerName) {
          const selection = selectVillainPhrase(
            'LAST',
            playerName,
            villainPhraseHistoryRef.current.LAST,
            now + last.lane,
          )
          const accepted = enqueueVillain({
            key: `last:${last.id}`,
            text: selection.text,
            playerName,
            parts: selection.parts,
            priority: gap > 7 ? 3 : 2,
            duration: 4_700,
            mood: 'LAUGH',
          })
          if (accepted) villainPhraseHistoryRef.current.LAST = selection.history
        }
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
  }, [commentNow, enqueueMain, enqueueVillain, ranking, state, suppressed])

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
            className="absolute inline-flex w-fit min-w-[12vw] max-w-[30vw] items-center justify-center rounded-xl border border-[#7db8c7]/70 bg-[#09161c]/92 px-[1.1vw] py-[.75vh] text-center shadow-[0_12px_30px_rgba(0,0,0,.55)] backdrop-blur-md"
            style={{ left: 'max(23vw, calc(19vw + 3rem))', top: `${COMMENT_TEXT_TOP_VH}vh` }}
          >
            <div className="min-w-0 break-words font-headline text-[3.4vh] font-medium leading-[1.15] tracking-[.015em] text-derby-cream">
              {mainComment.text}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div
        className="absolute right-[1.4vw] flex w-[42vw] items-start justify-end gap-[.9vw]"
        style={{ top: `${COMMENT_AVATAR_TOP_VH}vh` }}
      >
        <AnimatePresence mode="wait">
          {villainComment && (
            <motion.div
              key={villainComment.id}
              data-testid="villain-comment"
              initial={{ opacity: 0, x: 30, scale: .82, rotate: -1 }}
              animate={{ opacity: 1, x: 0, scale: 1, rotate: 0 }}
              exit={{ opacity: 0, x: 16, scale: .9 }}
              transition={{ type: 'spring', stiffness: 380, damping: 24 }}
              className="relative inline-flex w-fit min-w-[10vw] max-w-[27.5vw] items-center justify-center rounded-[1.1rem] border-[.22vh] border-derby-red bg-[#190a0c]/95 px-[1.1vw] py-[.75vh] text-center shadow-[0_12px_28px_rgba(0,0,0,.6)]"
              style={{ marginTop: `${VILLAIN_BUBBLE_OFFSET_VH}vh` }}
            >
              <span className="absolute -right-[.65vw] top-1/2 h-[1.2vw] w-[1.2vw] -translate-y-1/2 rotate-45 border-r-[.22vh] border-t-[.22vh] border-derby-red bg-[#190a0c]" />
              <div className="min-w-0 break-words font-headline text-[3.4vh] font-medium leading-[1.15] tracking-[.015em] text-derby-cream">
                <HighlightedCommentText message={villainComment} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <VillainAvatar mood={villainComment?.mood ?? 'TALK'} speaking={!!villainComment} />
      </div>
    </motion.div>
  )
}

function HighlightedCommentText({ message }: { message: CommentMessage }) {
  const parts = message.parts ?? [{ text: message.text, highlighted: false }]
  return parts.map((part, index) => (
    part.highlighted
      ? <strong key={`${index}:${part.text}`} className="font-bold text-white">{part.text}</strong>
      : <span key={`${index}:${part.text}`}>{part.text}</span>
  ))
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
      className="relative h-[17vh] w-[12.5vw] shrink-0 drop-shadow-[0_12px_9px_rgba(0,0,0,.65)]"
    >
      <svg viewBox="0 0 240 210" role="img" aria-label="Personnage cartoon" className="h-full w-full overflow-visible">
        <defs>
          <linearGradient id="villain-face" x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#f8d0ac" />
            <stop offset=".58" stopColor="#e9a987" />
            <stop offset="1" stopColor="#c97865" />
          </linearGradient>
          <linearGradient id="villain-beanie" x1="0" y1="0" x2="0" y2="1">
            <stop stopColor="#8f2636" />
            <stop offset="1" stopColor="#49131f" />
          </linearGradient>
        </defs>
        <path d="M43 82C42 36 72 13 112 14c43-2 78 23 78 69l-14 20-121 4Z" fill="#1b0a0f" stroke="#090407" strokeWidth="7" strokeLinejoin="round" />
        <path d="M49 60C53 22 80 7 116 8c38 0 65 18 69 54Z" fill="url(#villain-beanie)" stroke="#210911" strokeWidth="7" strokeLinejoin="round" />
        <path d="M47 55h140v28H47Z" fill="#6c1c2c" stroke="#210911" strokeWidth="7" strokeLinejoin="round" />
        <path d="M63 58h108" fill="none" stroke="#a8404e" strokeWidth="4" strokeLinecap="round" opacity=".65" />
        <ellipse cx="40" cy="111" rx="20" ry="27" fill="#dfa080" stroke="#7d443f" strokeWidth="6" />
        <ellipse cx="188" cy="111" rx="20" ry="27" fill="#dfa080" stroke="#7d443f" strokeWidth="6" />
        <path d="M48 88C50 51 80 42 114 43c43-3 70 19 70 64 0 59-29 91-72 91-45 0-70-36-64-110Z" fill="url(#villain-face)" stroke="#7d443f" strokeWidth="7" />
        <path d="M61 79c14-17 36-14 47-4M163 79c-13-16-34-15-46-4" fill="none" stroke="#431822" strokeWidth="10" strokeLinecap="round" />
        <path d="m65 88 42 9-39 13ZM161 88l-42 9 39 13Z" fill="#fffaf0" stroke="#814842" strokeWidth="4" strokeLinejoin="round" />
        <circle cx="87" cy="99" r="6" fill="#13070a" />
        <circle cx="139" cy="99" r="6" fill="#13070a" />
        <path d="M114 95 102 128l18 5" fill="none" stroke="#a65f53" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
        <motion.g
          animate={speaking
            ? { scaleX: laughing ? [1, 1.12, 1.05, 1.15, 1] : [1, 1.07, 1.02, 1.09, 1], scaleY: laughing ? [1, 1.05, 1] : [1, .97, 1.03, 1] }
            : { scaleX: 1, scaleY: 1 }}
          transition={{ duration: laughing ? .42 : .58, repeat: speaking ? Infinity : 0, ease: 'easeInOut' }}
          style={{ transformOrigin: '113px 159px' }}
        >
          <path d="M72 136q42 40 86-1-5 55-45 55-36 0-41-54Z" fill="#23080c" stroke="#6d2028" strokeWidth="5" />
          <path d="M79 140q36 22 72-1l-7 18H87Z" fill="#fff8e8" stroke="#c6aa8a" strokeWidth="3" strokeLinejoin="round" />
          <path d="M95 176q17-8 34 0-16 10-34 0Z" fill="#e86c82" />
        </motion.g>
        <g stroke="#b08c73" strokeWidth="2">
          <path d="M97 147v12M113 150v12M129 147v12" />
        </g>
        <path d="M33 92C32 35 70 5 116 5c49 0 83 31 83 87" fill="none" stroke="#35404a" strokeWidth="10" strokeLinecap="round" />
        <rect x="25" y="82" width="25" height="57" rx="11" fill="#242c34" stroke="#0b0f12" strokeWidth="6" />
        <rect x="179" y="82" width="25" height="57" rx="11" fill="#242c34" stroke="#0b0f12" strokeWidth="6" />
        <path d="M197 128q9 27-25 40" fill="none" stroke="#35404a" strokeWidth="7" strokeLinecap="round" />
        <circle cx="169" cy="169" r="8" fill="#171d22" stroke="#090c0e" strokeWidth="4" />
      </svg>
    </motion.div>
  )
}
