import type { MiniGamePlayerState, MiniGameState, MiniGameType } from './types'

export const MINI_GAME_TYPES: readonly MiniGameType[] = [
  'GRID',
  'CODE',
  'CAPITAL',
  'MAZE',
  'CLICKER',
  'ORDER',
  'PENALTY',
  'PRESSURE',
] as const

export const MINI_GAME_DURATIONS: Readonly<Record<MiniGameType, number>> = {
  GRID: 20_000,
  CODE: 25_000,
  CAPITAL: 20_000,
  MAZE: 60_000,
  CLICKER: 10_000,
  ORDER: 45_000,
  PENALTY: 30_000,
  PRESSURE: 15_000,
}

export const MINI_GAME_RESULTS_DURATION_MS = 5_000
export const PENALTY_GOAL_LEFT_PERCENT = 36
export const PENALTY_GOAL_RIGHT_PERCENT = 64

export function isPenaltyGoal(centerPercent: number): boolean {
  return Number.isFinite(centerPercent) &&
    centerPercent >= PENALTY_GOAL_LEFT_PERCENT &&
    centerPercent <= PENALTY_GOAL_RIGHT_PERCENT
}

export interface MiniGameActionResult {
  accepted: boolean
  changed: boolean
  reason: string
}

/**
 * Apply one player action to an active mini-game. The object is mutated on
 * purpose: the server owns a single in-memory state object and broadcasts it
 * after each accepted action. Test fixtures can clone before calling.
 */
export function applyMiniGameAction(
  game: MiniGameState | null,
  playerId: string,
  gameId: string,
  action: string,
  value?: number | string,
  now = Date.now(),
): MiniGameActionResult {
  if (!game || game.id !== gameId) {
    return { accepted: false, changed: false, reason: 'Partie introuvable ou obsolète' }
  }
  if (game.status !== 'PLAYING') {
    return { accepted: false, changed: false, reason: 'Le mini-jeu est déjà terminé' }
  }
  if (now >= game.endsAt) {
    return { accepted: false, changed: false, reason: 'Action reçue après la fin du chrono' }
  }

  const row = game.players.find((candidate) => candidate.playerId === playerId)
  if (!row) return { accepted: false, changed: false, reason: 'Joueur non participant' }
  if (row.eliminated) return { accepted: false, changed: false, reason: 'Joueur déjà éliminé' }
  if (row.finishedAt) return { accepted: false, changed: false, reason: 'Joueur déjà qualifié' }

  const finish = () => {
    row.finishedAt = now
    row.progress = 100
  }

  let changed = false
  let reason = 'Action ignorée : mauvaise réponse ou commande inattendue'

  if (game.type === 'GRID' && action === 'pick') {
    if (Number(value) === Number(game.payload.target)) {
      finish()
      changed = true
      reason = 'Nombre cible trouvé'
    } else reason = 'Mauvais nombre, le joueur continue'
  } else if (game.type === 'CODE' && action === 'answer') {
    if (Number(value) === Number(game.payload.answer)) {
      finish()
      changed = true
      reason = 'Code correct'
    } else reason = 'Code incomplet ou incorrect'
  } else if (game.type === 'CAPITAL' && action === 'answer') {
    if (value === game.payload.answer) {
      finish()
      changed = true
      reason = 'Bonne capitale'
    } else {
      row.lives--
      changed = true
      if (row.lives <= 0) {
        row.eliminated = true
        row.finishedAt = now
        reason = 'Deux erreurs : joueur éliminé'
      } else reason = 'Mauvaise capitale : une vie perdue'
    }
  } else if (game.type === 'MAZE' && action === 'finish') {
    finish()
    changed = true
    reason = 'Sortie du labyrinthe atteinte'
  } else if (game.type === 'CLICKER' && action === 'click') {
    row.score = Math.min(300, row.score + 1)
    row.progress = row.score
    changed = true
    reason = row.score === 300 ? 'Plafond de 300 clics atteint' : 'Clic comptabilisé'
  } else if (game.type === 'ORDER' && action === 'pick') {
    if (Number(value) === row.progress + 1) {
      row.progress++
      if (row.progress === 16) finish()
      changed = true
      reason = row.finishedAt ? 'Suite 1 → 16 terminée' : `Étape ${row.progress}/16 validée`
    } else reason = `Le prochain nombre attendu est ${row.progress + 1}`
  } else if (game.type === 'PENALTY' && action === 'shot') {
    if (row.progress < 10) {
      const centerPercent = Number(value)
      const goal = isPenaltyGoal(centerPercent)
      row.progress++
      row.score += goal ? 1 : 0
      changed = true
      reason = goal ? 'But marqué' : 'Tir manqué'
    } else reason = 'Les dix tirs ont déjà été joués'
  } else if (game.type === 'PRESSURE' && action === 'score') {
    row.score = Math.max(0, Math.min(100, Number(value) || 0))
    finish()
    changed = true
    reason = `Jauge arrêtée à ${row.score.toFixed(1)} %`
  }

  // Once the game and player have passed the guards, the server accepts and
  // rebroadcasts the action even when the answer itself changes no state.
  return { accepted: true, changed, reason }
}

export function shouldEndMiniGameEarly(game: MiniGameState | null): boolean {
  if (!game || game.status !== 'PLAYING' || ['CLICKER', 'PENALTY'].includes(game.type)) return false
  const activePlayers = game.players.filter((row) => !row.finishedAt && !row.eliminated)
  if (['MAZE', 'PRESSURE'].includes(game.type)) return activePlayers.length === 0
  return activePlayers.length <= 1
}

export function getMiniGameLosers(game: MiniGameState): MiniGamePlayerState[] {
  const unfinished = game.players.filter((row) => !row.finishedAt || row.eliminated)
  let losers = unfinished

  if (['CLICKER', 'PENALTY', 'PRESSURE'].includes(game.type)) {
    const worst = Math.min(...game.players.map((row) => row.score))
    losers = game.players.filter((row) => row.score === worst)
  } else if (!unfinished.length) {
    const lastTime = Math.max(...game.players.map((row) => row.finishedAt ?? 0))
    losers = game.players.filter((row) => row.finishedAt === lastTime)
  }

  const baseline = game.players[0]
  if (!baseline) return []
  const allSame = losers.length === game.players.length && game.players.every((row) =>
    row.score === baseline.score &&
    row.progress === baseline.progress &&
    row.finishedAt === baseline.finishedAt &&
    row.lives === baseline.lives,
  )

  // Penalty and pressure explicitly eliminate every player tied at the lowest
  // score, including the edge case where everybody ends on the same score.
  if (game.type === 'PENALTY' || game.type === 'PRESSURE') return losers
  return allSame ? [] : losers
}

/** Mark results and return the rows that lost. External race consequences
 * (horse/jockey elimination) remain the server's responsibility. */
export function resolveMiniGameState(game: MiniGameState, now = Date.now()): MiniGamePlayerState[] {
  if (game.status !== 'PLAYING') return []
  const losers = getMiniGameLosers(game)
  for (const row of losers) row.eliminated = true
  game.status = 'RESULTS'
  game.resultsEndAt = now + MINI_GAME_RESULTS_DURATION_MS
  return losers
}
