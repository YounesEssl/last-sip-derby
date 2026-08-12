import {
  MINI_GAME_DURATIONS,
  MINI_GAME_TYPES,
  MAZE_BANK_SIZE,
  PENALTY_GOAL_LEFT_PERCENT,
  PENALTY_GOAL_RIGHT_PERCENT,
  applyMiniGameAction,
  resolveMiniGameState,
  shouldEndMiniGameEarly,
  type MiniGamePlayerState,
  type MiniGameState,
  type MiniGameType,
} from '@last-sip-derby/shared'

export type LabScenario = 'fresh' | 'midway' | 'results' | 'tie' | 'crowd' | 'timeout'

export interface MiniGameSpec {
  label: string
  icon: string
  summary: string
  rule: string
  checks: readonly string[]
}

export const GAME_ORDER = MINI_GAME_TYPES

export const GAME_SPECS: Readonly<Record<MiniGameType, MiniGameSpec>> = {
  GRID: {
    label: 'Nombre caché',
    icon: '⌗',
    summary: 'Retrouver une cible dans une grille de 36 nombres.',
    rule: 'Un mauvais nombre ne pénalise pas. Le bon nombre qualifie immédiatement.',
    checks: ['Cible lisible', 'Mauvais choix sans blocage', 'Bon choix qualifiant', 'Grille complète sur petit écran'],
  },
  CODE: {
    label: 'Code express',
    icon: '×',
    summary: 'Résoudre une multiplication avec un pavé numérique.',
    rule: 'Chaque chiffre envoie la saisie courante. Le résultat exact qualifie le joueur.',
    checks: ['Calcul lisible', 'Saisie et effacement', 'Réponse exacte qualifiante', 'Clavier utilisable au pouce'],
  },
  CAPITAL: {
    label: 'Capitales',
    icon: '◎',
    summary: 'Choisir la bonne capitale parmi quatre réponses.',
    rule: 'Deux vies : une erreur retire une vie, la seconde élimine. Une bonne réponse qualifie.',
    checks: ['Quatre choix visibles', 'Flash après erreur', 'Deux vies correctement décomptées', 'Bonne réponse qualifiante'],
  },
  MAZE: {
    label: 'Labyrinthe',
    icon: '⌁',
    summary: 'Piloter une bille avec inertie jusqu’à la sortie du labyrinthe commun.',
    rule: 'Joystick analogique, collisions physiques et même parcours pour tous. Limite : 60 secondes.',
    checks: ['50 parcours exploitables', 'Joystick utilisable au pouce', 'Inertie et collisions fiables', 'Ordre de sortie TV'],
  },
  CLICKER: {
    label: 'Clicker',
    icon: '☝',
    summary: 'Accumuler le plus de clics avant la fin du chrono.',
    rule: 'Maximum 300 clics. Le ou les scores les plus faibles sont éliminés.',
    checks: ['Multi-clic réactif', 'Score TV en direct', 'Plafond de 300', 'Égalité au dernier rang'],
  },
  ORDER: {
    label: 'Ordre 1 → 16',
    icon: '➜',
    summary: 'Toucher les seize nombres dans le bon ordre.',
    rule: 'Un mauvais nombre est ignoré. Le seizième nombre qualifie le joueur.',
    checks: ['Prochaine cible visible', 'Mauvais ordre ignoré', 'Cases validées marquées', 'Seizième choix qualifiant'],
  },
  PENALTY: {
    label: 'Penalty',
    icon: '⚽',
    summary: 'Déclencher dix tirs pendant que le ballon se déplace.',
    rule: `Le centre du ballon doit être entre ${PENALTY_GOAL_LEFT_PERCENT} % et ${PENALTY_GOAL_RIGHT_PERCENT} %. Après dix tirs, le plus faible score perd.`,
    checks: ['Ballon rapide et continu', 'Trajectoire avant impact', 'Dix tirs maximum en 30 s', 'Classement TV en direct'],
  },
  PRESSURE: {
    label: 'Pression',
    icon: '▲',
    summary: 'Arrêter la jauge aussi près que possible de 100 %.',
    rule: 'Le score est borné entre 0 et 100. Le plus faible résultat est éliminé.',
    checks: ['Cône rouge vers vert', 'Retour instantané à zéro', 'Arrêt unique', 'Score décimal et message lisibles'],
  },
}

export const SCENARIOS: ReadonlyArray<{ id: LabScenario; label: string; description: string }> = [
  { id: 'fresh', label: 'Départ propre', description: 'Tous les joueurs commencent à zéro.' },
  { id: 'midway', label: 'En cours', description: 'Scores et qualifications déjà mélangés.' },
  { id: 'results', label: 'Résultats', description: 'Classement final avec un perdant.' },
  { id: 'tie', label: 'Égalité totale', description: 'Vérifie la règle d’égalité propre au jeu, y compris l’élimination collective aux tirs et à la pression.' },
  { id: 'crowd', label: '12 joueurs', description: 'Pseudos longs et charge maximale visuelle.' },
  { id: 'timeout', label: 'Fin imminente', description: 'Il reste environ deux secondes.' },
]

const PSEUDOS = [
  'Camille',
  'Jojo',
  'Léa',
  'Baptiste',
  'Nina',
  'Mehdi',
  'Chloé',
  'Romain',
  'Inès',
  'Maxime',
  'Zoé',
  'Théo',
] as const

const CROWD_PSEUDOS = [
  'Camille-la-Terrible',
  'Jean-Michel Croûton',
  'Léa',
  'Baptiste du PMU Central',
  'Nina',
  'Mehdi-Sans-Frein',
  'Chloé',
  'Romain le Magnifique',
  'Inès',
  'Maxime',
  'Zoé des Tribunes',
  'Théodore III',
] as const

function seededRandom(seed: number) {
  let value = (seed || 1) >>> 0
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0
    return value / 4294967296
  }
}

function shuffled<T>(values: readonly T[], random: () => number): T[] {
  const result = [...values]
  for (let index = result.length - 1; index > 0; index--) {
    const target = Math.floor(random() * (index + 1))
    ;[result[index], result[target]] = [result[target], result[index]]
  }
  return result
}

function makePayload(type: MiniGameType, seed: number): { prompt: string; payload: Record<string, unknown> } {
  const random = seededRandom(seed)
  if (type === 'GRID') {
    const values = shuffled(Array.from({ length: 36 }, (_, index) => index + 1), random)
    const target = values[Math.floor(random() * values.length)]
    return { prompt: `Trouvez le ${target}`, payload: { values, target } }
  }
  if (type === 'CODE') {
    const a = 2 + Math.floor(random() * 11)
    const b = 2 + Math.floor(random() * 11)
    return { prompt: `${a} × ${b}`, payload: { a, b, answer: a * b } }
  }
  if (type === 'CAPITAL') {
    const questions = [
      { country: 'Australie', answer: 'Canberra', wrong: ['Sydney', 'Melbourne', 'Perth'] },
      { country: 'Côte d’Ivoire', answer: 'Yamoussoukro', wrong: ['Abidjan', 'Dakar', 'Lomé'] },
      { country: 'Japon', answer: 'Tokyo', wrong: ['Kyoto', 'Osaka', 'Séoul'] },
      { country: 'Canada', answer: 'Ottawa', wrong: ['Toronto', 'Montréal', 'Vancouver'] },
    ]
    const question = questions[Math.floor(random() * questions.length)]
    return {
      prompt: `Capitale : ${question.country}`,
      payload: { country: question.country, answer: question.answer, choices: shuffled([question.answer, ...question.wrong], random) },
    }
  }
  if (type === 'MAZE') {
    return { prompt: 'Sortez du labyrinthe', payload: { mazeIndex: Math.floor(random() * MAZE_BANK_SIZE) } }
  }
  if (type === 'ORDER') {
    return { prompt: '1 → 16', payload: { values: shuffled(Array.from({ length: 16 }, (_, index) => index + 1), random) } }
  }
  if (type === 'PENALTY') return { prompt: '10 tirs — visez entre les poteaux', payload: {} }
  if (type === 'PRESSURE') return { prompt: 'Arrêtez la jauge au plus près de 100 %', payload: {} }
  return { prompt: 'Cliquez le plus vite possible', payload: {} }
}

function makePlayers(count: number, crowd = false): MiniGamePlayerState[] {
  const names = crowd ? CROWD_PSEUDOS : PSEUDOS
  return Array.from({ length: Math.max(1, Math.min(12, count)) }, (_, index) => ({
    playerId: `lab-player-${index + 1}`,
    pseudo: names[index] ?? `Turfiste ${index + 1}`,
    score: 0,
    progress: 0,
    finishedAt: null,
    lives: 2,
    eliminated: false,
  }))
}

export function cloneMiniGame(game: MiniGameState): MiniGameState {
  return {
    ...game,
    payload: { ...game.payload },
    players: game.players.map((row) => ({ ...row })),
  }
}

export function createLabGame(
  type: MiniGameType,
  options: { playerCount?: number; seed?: number; durationMs?: number; scenario?: LabScenario } = {},
): MiniGameState {
  const now = Date.now()
  const seed = options.seed ?? 2202
  const scenario = options.scenario ?? 'fresh'
  const crowd = scenario === 'crowd'
  const players = makePlayers(crowd ? 12 : options.playerCount ?? 4, crowd)
  const { prompt, payload } = makePayload(type, seed)
  const durationMs = options.durationMs ?? MINI_GAME_DURATIONS[type]
  const game: MiniGameState = {
    id: `lab-${type.toLowerCase()}-${seed}-${now}`,
    type,
    startedAt: now,
    endsAt: now + (scenario === 'timeout' ? 2_200 : durationMs),
    status: 'PLAYING',
    resultsEndAt: null,
    prompt,
    payload,
    players,
  }

  if (scenario === 'midway') applyMidwayScenario(game, now)
  if (scenario === 'results') applyResultsScenario(game, now, false)
  if (scenario === 'tie') applyResultsScenario(game, now, true)
  if (crowd) applyCrowdScenario(game, now)
  return game
}

function applyMidwayScenario(game: MiniGameState, now: number) {
  game.endsAt = now + Math.max(7_000, MINI_GAME_DURATIONS[game.type] * 0.48)
  game.players.forEach((row, index) => {
    if (index === 0) return
    if (game.type === 'CLICKER') {
      row.score = 9 + index * 7
      row.progress = row.score
    } else if (game.type === 'PENALTY') {
      row.progress = Math.min(9, 2 + index)
      row.score = Math.min(row.progress, Math.max(0, index + 1))
    } else if (game.type === 'PRESSURE') {
      if (index < game.players.length - 1) {
        row.score = 62 + index * 7.4
        row.progress = 100
        row.finishedAt = now - (game.players.length - index) * 320
      }
    } else if (game.type === 'ORDER') {
      row.progress = Math.min(15, index * 4)
    } else if (index < game.players.length - 1) {
      row.progress = 100
      row.finishedAt = now - (game.players.length - index) * 420
    }
  })
}

function applyResultsScenario(game: MiniGameState, now: number, tie: boolean) {
  game.players.forEach((row, index) => {
    if (['CLICKER', 'PENALTY', 'PRESSURE'].includes(game.type)) {
      const isLast = index === game.players.length - 1
      row.score = tie
        ? 7
        : isLast
          ? 0
          : game.type === 'PENALTY'
            ? 2 + (index % 8)
            : 55 + (game.players.length - index) * 3
      row.progress = game.type === 'PENALTY' ? 10 : row.score
      if (game.type === 'PRESSURE') row.finishedAt = tie ? now - 1_000 : now - 1_700 + index * 170
    } else {
      row.progress = 100
      row.finishedAt = tie ? now - 1_000 : now - 2_000 + index * 240
    }
  })
  resolveMiniGameState(game, now)
}

function applyCrowdScenario(game: MiniGameState, now: number) {
  game.players.forEach((row, index) => {
    if (game.type === 'CLICKER') {
      row.score = 8 + ((index * 13) % 41)
      row.progress = row.score
    } else if (game.type === 'PENALTY') {
      row.progress = 3 + (index % 7)
      row.score = Math.min(row.progress, (index * 3) % 8)
    } else if (game.type === 'PRESSURE' && index % 3 === 0 && index !== 0) {
      row.score = 58 + index * 2.8
      row.progress = 100
      row.finishedAt = now - index * 90
    } else if (game.type === 'ORDER') row.progress = (index * 3) % 16
    else if (index > 0 && index % 4 === 0) {
      row.progress = 100
      row.finishedAt = now - index * 110
    }
  })
}

export interface LabActionOutcome {
  game: MiniGameState
  accepted: boolean
  changed: boolean
  reason: string
  loserIds: string[]
}

export function applyLabAction(
  game: MiniGameState,
  playerId: string,
  action: string,
  value?: number | string,
  now = Date.now(),
): LabActionOutcome {
  const next = cloneMiniGame(game)
  const result = applyMiniGameAction(next, playerId, next.id, action, value, now)
  let loserIds: string[] = []
  if (result.accepted && shouldEndMiniGameEarly(next)) {
    loserIds = resolveMiniGameState(next, now).map((row) => row.playerId)
  }
  return { game: next, ...result, loserIds }
}

export function resolveLabGame(game: MiniGameState, now = Date.now()): { game: MiniGameState; loserIds: string[] } {
  const next = cloneMiniGame(game)
  const loserIds = resolveMiniGameState(next, now).map((row) => row.playerId)
  return { game: next, loserIds }
}

export interface BotAction {
  playerId: string
  action: string
  value?: number | string
}

export function createBotActions(game: MiniGameState, humanPlayerId: string, now = Date.now()): BotAction[] {
  if (game.status !== 'PLAYING' || now >= game.endsAt) return []
  const elapsed = now - game.startedAt
  const actions: BotAction[] = []
  game.players.forEach((row, index) => {
    if (row.playerId === humanPlayerId || row.finishedAt || row.eliminated) return
    if (game.type === 'CLICKER') {
      const count = 1 + (index % 3)
      for (let click = 0; click < count; click++) actions.push({ playerId: row.playerId, action: 'click' })
    } else if (game.type === 'ORDER') {
      actions.push({ playerId: row.playerId, action: 'pick', value: row.progress + 1 })
    } else if (game.type === 'PENALTY') {
      if (row.progress < 10) actions.push({ playerId: row.playerId, action: 'shot', value: (row.progress + index) % 4 === 0 ? 18 : 50 })
    } else if (game.type === 'PRESSURE') {
      if (elapsed > 2_100 + index * 760) actions.push({ playerId: row.playerId, action: 'score', value: Math.min(99.5, 54 + index * 8.7) })
    } else if (elapsed > 2_000 + index * 850) {
      if (game.type === 'GRID') actions.push({ playerId: row.playerId, action: 'pick', value: Number(game.payload.target) })
      if (game.type === 'CODE') actions.push({ playerId: row.playerId, action: 'answer', value: Number(game.payload.answer) })
      if (game.type === 'CAPITAL') actions.push({ playerId: row.playerId, action: 'answer', value: String(game.payload.answer) })
      if (game.type === 'MAZE') actions.push({ playerId: row.playerId, action: 'finish' })
    }
  })
  return actions
}
