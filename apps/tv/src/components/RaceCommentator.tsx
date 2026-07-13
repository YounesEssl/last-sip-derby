'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { GameState, Horse } from '@last-sip-derby/shared'

const LAST_PLACE_LINES = [
  "Alors {name}… t’es dernier tocard ?",
  "Je crois que {name} veut pas gagner.",
  "C’est fou d’être nul comme {name}.",
  "Bon {name}… tu commences à jouer ?",
  "Ptdrr regardez {name}, il est dernier",
  "{name} est pas pressé hein…",
  "Allez, on encourage {name}",
  "Miskine {name}…",
  "{name} est un beau perdant",
  "{name}, ça parle pas trop là hein ?",
  "Je crois que {name} est dernier",
  "J’suis mort comment il est nul {name}…",
  "{name}, tu veux un café chef ?",
  "{name} est dernier, regardez-le",
  "HAHAHAHA {name}… allez mon grand continue",
  "{name} qui se fait enculer en détente",
  "{name}, tu te fais enculer par ton cheval ou quoi ?",
  "Pleure pas {name}…",
  "Bah alors {name}, c’est qui qui va boire ?",
  "{name}, t’es nul",
  "{name}, looserrrrrr",
  "T’es un gros nullos {name}",
  "{name}, t’avais espoir de gagner en plus mdrrr ?",
  "{name}, allez remplis ton verre garçon",
  "Oh {name}, t’as oublié de démarrer ou quoi ?",
  "{name}, même à pied t’irais plus vite",
  "Y’a {name} et y’a les autres.",
  "Mais lâche ton téléphone {name}, t’es dernier là",
  "{name}, tu joues à quoi là sérieux ?",
  "Franchement {name}, lâche l’affaire, bois direct",
  "{name}, ce soir c’est toi la victime, on l’a tous compris",
  "Petit rappel {name} : le but c’est d’avancer",
  "{name}, ton verre va être plein ce soir mon pauvre",
  "Ohhh {name}, il est encore là au fond mdrrr",
  "{name}, t’as parié avec tes pieds ou quoi ?",
  "Courage {name}, t’es pas dernier… ah si en fait",
  "{name}, même ma grand-mère te dépasse",
  "{name}, ton cheval il t’aime pas c’est tout",
  "{name}, faut le dire si tu veux pas jouer hein",
  "{name}, t’inquiète, dernier c’est une place aussi",
  "{name}, t’as une copine ?",
] as const

const FIRST_PLACE_LINES = [
  "T’es si rapide {name}…",
  "{name}, t’es sur une fusée ou un cheval ?",
  "{name}, t’as un T-Max ou un cheval ?",
  "Le GOAT {name}",
  "{name} vous met une tempête",
  "{name}, t’es prime",
  "{name}, quel étalon",
  "{name}, gros beau gosse va",
  "Un vrai champion ce {name}",
  "{name}, t’es un roi",
  "Personne peut suivre {name}",
  "{name} roule en Ferrari, les autres en trottinette",
  "Chapeau bas {name}, quel monstre",
  "{name} a mis le turbo, RIP les autres",
  "On arrête le chrono ? {name} a déjà gagné",
  "{name}, laisse-en un peu aux autres steuplé",
  "Le patron c’est {name}, point barre",
  "{name}, tu cours ou tu voles là ?",
  "{name} est en mode Fast and Furious",
  "Tout le monde derrière {name}, comme d’hab",
  "{name} distribue une leçon d’humilité à la piste",
  "Génie {name}, t’as vendu ton âme ou quoi ?",
  "Standing ovation pour {name}, quelle machine",
  "{name} a pris l’autoroute, les autres la départementale",
  "Respect {name}, t’écrases tout le monde là",
  "{name}, c’est Mbappé version cheval",
  "Personne au niveau de {name}, c’est plié les gars",
  "{name} en tête, préparez vos verres les autres",
] as const

type Spot = 'FIRST' | 'LAST'

interface StablePosition {
  horseId: string | null
  since: number
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
  const stableFirst = useRef<StablePosition>({ horseId: null, since: Date.now() })
  const stableLast = useRef<StablePosition>({ horseId: null, since: Date.now() })
  const used = useRef(new Set<string>())
  const lastCommentAt = useRef(0)
  const lastTarget = useRef<{ pseudo: string; rank: number } | null>(null)
  const nextSpot = useRef<Spot>('LAST')
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    used.current.clear()
    lastCommentAt.current = 0
    lastTarget.current = null
    stableFirst.current = { horseId: null, since: Date.now() }
    stableLast.current = { horseId: null, since: Date.now() }
    setComment(null)
  }, [state.raceNumber])

  useEffect(() => () => {
    if (hideTimer.current) clearTimeout(hideTimer.current)
  }, [])

  useEffect(() => {
    if (suppressed || state.racePaused || ranking.length < 2 || state.raceProgress < 8 || state.raceProgress > 94) return
    const now = Date.now()
    const first = ranking[0]
    const second = ranking[1]
    const last = ranking[ranking.length - 1]

    if (stableFirst.current.horseId !== first.id) stableFirst.current = { horseId: first.id, since: now }
    if (stableLast.current.horseId !== last.id) stableLast.current = { horseId: last.id, since: now }
    if (now - lastCommentAt.current < 3_200) return

    const firstReady = now - stableFirst.current.since >= 3_000 && first.position - second.position >= 8.3
    const lastReady = now - stableLast.current.since >= 3_000
    const candidates: Spot[] = []
    if (firstReady && bettorsFor(state, first).length) candidates.push('FIRST')
    if (lastReady && bettorsFor(state, last).length) candidates.push('LAST')
    if (!candidates.length) return

    let spot = candidates.includes(nextSpot.current) ? nextSpot.current : candidates[0]
    let targetHorse = spot === 'FIRST' ? first : last
    let rank = spot === 'FIRST' ? 1 : ranking.length
    let pseudos = bettorsFor(state, targetHorse)
    let pseudo = pseudos[Math.floor((now / 1000) % pseudos.length)]

    // A second jab at the same person is allowed only while their rank has
    // remained unchanged. Otherwise give the table a different target first.
    if (lastTarget.current?.pseudo === pseudo && lastTarget.current.rank !== rank) {
      const alternative = candidates.find((candidate) => candidate !== spot)
      if (!alternative) return
      spot = alternative
      targetHorse = spot === 'FIRST' ? first : last
      rank = spot === 'FIRST' ? 1 : ranking.length
      pseudos = bettorsFor(state, targetHorse)
      pseudo = pseudos[0]
    }

    const bank = spot === 'FIRST' ? FIRST_PLACE_LINES : LAST_PLACE_LINES
    const available = bank.filter((line) => !used.current.has(line))
    if (!available.length) return
    const line = available[Math.floor(Math.random() * available.length)]
    used.current.add(line)
    lastCommentAt.current = now
    lastTarget.current = { pseudo, rank }
    nextSpot.current = spot === 'FIRST' ? 'LAST' : 'FIRST'
    setComment({ text: line.replace('{name}', pseudo), spot, id: now })
    if (hideTimer.current) clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => setComment(null), 2_800)
  }, [ranking, state, suppressed])

  return (
    <AnimatePresence>
      {comment && !suppressed && (
        <motion.div
          key={comment.id}
          initial={{ opacity: 0, y: 28, scale: 0.9, rotate: comment.spot === 'FIRST' ? -1 : 1 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.96 }}
          className="pointer-events-none absolute left-1/2 top-[27vh] z-30 -translate-x-1/2"
        >
          <div className={`max-w-[58vw] rounded-xl border-2 bg-derby-night/90 px-8 py-3 text-center font-hand text-[3.5vh] font-bold shadow-deep backdrop-blur-sm ${comment.spot === 'FIRST' ? 'border-derby-gold text-derby-gold' : 'border-derby-red text-derby-cream'}`}>
            🎙️ {comment.text}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
