export const MAX_ACTIVE_PLAYERS = 10
export const HORSES_PER_RACE = 5

export const PHASE_DURATIONS = {
  BETTING: 40_000,
  RACING: 120_000,
  RESULTS: 30_000,
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

export const DRINK_CONFIRM_TIMEOUT_MS = 10_000
export const DRINK_PENALTY_SIPS = 1

// Event system
export const MAX_EVENTS_PER_RACE = 2
export const EVENT_VOTE_TIMEOUT_MS = 30_000
export const EVENT_RESOLVE_DISPLAY_MS = 5_000
export const EVENT_EARLIEST_TICK = 150   // no events before ~15s
export const EVENT_LATEST_TICK = 550     // no events after ~55s
export const EVENT_MIN_TICK_GAP = 150    // minimum ~15s between events
