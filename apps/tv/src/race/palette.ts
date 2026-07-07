// Visual constants for the race engine. All sizes are expressed at the
// 1080p reference height and scaled by the engine.

export const WORLD = {
  PX_PER_UNIT: 155, // world pixels per server position unit (0..100)
  START_X: 480, // world x of the start line
  get FINISH_X() {
    return this.START_X + 100 * this.PX_PER_UNIT
  },
}

// Track band on screen (fractions of canvas height)
export const TRACK = {
  HORIZON: 0.5,
  FAR_EDGE: 0.585,
  NEAR_EDGE: 0.97,
  LANES: 5,
}

export function laneGroundY(lane: number, H: number): number {
  const t = lane / (TRACK.LANES - 1)
  return H * (0.655 + t * 0.275)
}

export function laneScale(lane: number): number {
  return 0.78 + (lane / (TRACK.LANES - 1)) * 0.3
}

// Natural coat colors per lane — silks/caps carry the horse's team color.
export const COATS = [
  { body: '#8C5A33', dark: '#6B4224', light: '#A5714A', mane: '#3E2A1A' }, // bay
  { body: '#5B3A21', dark: '#432A16', light: '#74502F', mane: '#2A1C10' }, // dark bay
  { body: '#3A2E26', dark: '#2A211B', light: '#4E4036', mane: '#191411' }, // black
  { body: '#B98A4E', dark: '#966C38', light: '#D2A868', mane: '#E8DCC0' }, // palomino
  { body: '#9C9CA4', dark: '#7B7B84', light: '#BEBEC6', mane: '#5A5A62' }, // grey
]

export const SKY = {
  top: '#3D4E7C',
  mid: '#B06A45',
  low: '#E8A25C',
  horizon: '#F2C879',
}

export const SCENERY = {
  hillFar: '#77714B',
  hillNear: '#5C5C3C',
  treeDark: '#3F4A2E',
  grass: '#4A6741',
  grassDark: '#3A5434',
  standWood: '#4A3018',
  standRoof: '#8C2F26',
  railWhite: '#E8E0CC',
  dirtFar: '#B57848',
  dirtNear: '#8F5A33',
}

export const SPONSORS = [
  'BUVETTE CHEZ MOMO',
  'SELLERIE ROYALE',
  'CIGARES LE PUR-SANG',
  'PMU DU COIN',
  "L'APÉRO D'OR",
  'ÉCURIE DUBOIS & FILS',
  'HÔTEL DU JOCKEY',
  'FOIN & FILS DEPUIS 1892',
]

// Deterministic pseudo-random, so scenery doesn't shimmer between frames
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
