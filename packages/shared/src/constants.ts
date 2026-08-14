export const MAX_ACTIVE_PLAYERS = 10
export const HORSES_PER_RACE = 5

export const PHASE_DURATIONS = {
  BETTING: 40_000,
  RACING: 60_000,
  RESULTS: 45_000, // time for the winner to pick victims and send the tournée
  IDLE: 30_000,
} as const

export const RACE_TICK_MS = 100

export const HORSE_COLORS = [
  '#E63946', // rouge
  '#457B9D', // bleu
  '#2D6A4F', // vert
  '#C9A84C', // or
  '#9B5DE5', // violet
] as const

export type RaceOdds = 1 | 2 | 3 | 4 | 5

/**
 * Source de vérité unique pour les nouvelles courses. Les poids 60/cote sont
 * des entiers exactement proportionnels à 1/cote ; leur normalisation donne
 * 43,8 %, 21,9 %, 14,6 %, 10,9 % et 8,8 %.
 */
export const RACE_ODDS_CONFIG = [
  { odds: 1, legacyOdds: 1, color: HORSE_COLORS[0], winWeight: 60, lossSips: 1, normalWinSips: 2 },
  { odds: 2, legacyOdds: 2, color: HORSE_COLORS[1], winWeight: 30, lossSips: 2, normalWinSips: 4 },
  { odds: 3, legacyOdds: 3, color: HORSE_COLORS[2], winWeight: 20, lossSips: 3, normalWinSips: 6 },
  { odds: 4, legacyOdds: 5, color: HORSE_COLORS[3], winWeight: 15, lossSips: 4, normalWinSips: 8 },
  { odds: 5, legacyOdds: 7, color: HORSE_COLORS[4], winWeight: 12, lossSips: 5, normalWinSips: 10 },
] as const satisfies readonly {
  odds: RaceOdds
  legacyOdds: 1 | 2 | 3 | 5 | 7
  color: string
  winWeight: number
  lossSips: number
  normalWinSips: number
}[]

export const RACE_ODDS = RACE_ODDS_CONFIG.map((rule) => rule.odds) as RaceOdds[]

export const LEGACY_ODDS_MIGRATION = {
  1: 1,
  2: 2,
  3: 3,
  5: 4,
  7: 5,
} as const satisfies Record<1 | 2 | 3 | 5 | 7, RaceOdds>

export function getRaceOddsRule(odds: number) {
  return RACE_ODDS_CONFIG.find((rule) => rule.odds === odds)
}

export function getRaceWinWeight(odds: number): number {
  return getRaceOddsRule(odds)?.winWeight ?? 0
}

export function getLossSips(odds: number): number {
  return getRaceOddsRule(odds)?.lossSips ?? Math.max(0, Math.round(odds))
}

export function getWinSips(odds: number, multiplier: 2 | 3 | 5 = 2): number {
  const rule = getRaceOddsRule(odds)
  if (multiplier === 2 && rule) return rule.normalWinSips
  return getLossSips(odds) * multiplier
}

export const RACE_BASE_WIN_PROBABILITIES = RACE_ODDS_CONFIG.map((rule) => {
  const totalWeight = RACE_ODDS_CONFIG.reduce((sum, candidate) => sum + candidate.winWeight, 0)
  return { odds: rule.odds, probability: rule.winWeight / totalWeight }
})

export const DRINK_CONFIRM_TIMEOUT_MS = 10_000
export const DRINK_PENALTY_SIPS = 1

// Event system
export const MAX_EVENTS_PER_RACE = 2
export const EVENT_VOTE_TIMEOUT_MS = 30_000
export const EVENT_RESOLVE_DISPLAY_MS = 5_000
export const EVENT_EARLIEST_TICK = 130   // no events before ~13s
export const EVENT_LATEST_TICK = 460     // no events after ~46s (race lasts 60s)
export const EVENT_MIN_TICK_GAP = 140    // minimum ~14s between events

export const PLAYER_INACTIVITY_MS = 2 * 60 * 60 * 1000
export const BLACK_KNIGHT_KILL_COOLDOWN_MS = 15_000
export const MINIGAME_RESULTS_MS = 5_000

// V2.2 balancing. Denominators keep the product spec readable at call sites:
// `Math.random() < 1 / RACE_EVENT_ODDS.JOCKEY_FALL`, for example.
export const RACE_EVENT_ODDS = {
  LIGHTNING: 8,
  CUTE_CHALLENGE: 2,
  JOCKEY_FALL: 35,
  CAMEL: 30,
  MOTORCYCLE: 30,
  REVERSE: 40,
  GOLDEN: 30,
  DIAMOND: 60,
  ADRIEN: 50,
} as const

export const RACE_SPEED_BONUSES = {
  JOCKEY_FALLEN: 0.05,
  MOTORCYCLE: 0.035,
  ADRIEN: 0.065,
} as const
