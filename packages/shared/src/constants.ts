export const MAX_ACTIVE_PLAYERS = 10
export const HORSES_PER_RACE = 5

export const PHASE_DURATIONS = {
  BETTING: 60_000,
  RACING: 120_000,
  RESULTS: 30_000,
  IDLE: 30_000,
} as const

export const RACE_TICK_MS = 100
export const BASE_SPEED = 0.12

export const HORSE_COLORS = [
  '#E63946', // rouge
  '#457B9D', // bleu
  '#2D6A4F', // vert
  '#C9A84C', // or
  '#9B5DE5', // violet
] as const

export const DRINK_CONFIRM_TIMEOUT_MS = 10_000
export const DRINK_PENALTY_SIPS = 1

export const EVENT_MIN_INTERVAL_MS = 15_000
export const EVENT_MAX_INTERVAL_MS = 30_000

export const BOOST_DURATION_MS = 5_000
export const STUN_DURATION_MS = 5_000
export const CHUTE_STUN_DURATION_MS = 3_000
