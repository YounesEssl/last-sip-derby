// Data-driven transverse gallop for the procedural Canvas horse.
//
// The old renderer animated the hoof and the intermediate joints separately,
// which necessarily changed the apparent bone lengths. This module instead
// stores complete reference poses, converts them to joint angles, and rebuilds
// each limb with forward kinematics. Segment lengths therefore stay constant
// throughout the cycle and a rear hock cannot randomly flip sides.

export interface Point {
  x: number
  y: number
}

export type GallopLimbId = 'hindTrail' | 'hindLead' | 'foreTrail' | 'foreLead'

interface LimbSpec {
  id: GallopLimbId
  kind: 'fore' | 'hind'
  far: boolean
  phaseOffset: number
  root: Point
}

export const GALLOP_LIMBS: readonly LimbSpec[] = [
  // Transverse gallop: trailing hind, leading hind, trailing fore, leading fore.
  { id: 'hindTrail', kind: 'hind', far: true, phaseOffset: 0, root: { x: -38, y: -65 } },
  // Muybridge plate 626 shows the second hind landing roughly one exposure
  // after the first. It must therefore arrive much earlier than the old 14%
  // delay, which left a rear hoof on the floor during the foreleg sequence.
  { id: 'hindLead', kind: 'hind', far: false, phaseOffset: 0.92, root: { x: -36, y: -64 } },
  { id: 'foreTrail', kind: 'fore', far: true, phaseOffset: 0.7, root: { x: 30, y: -52 } },
  { id: 'foreLead', kind: 'fore', far: false, phaseOffset: 0.56, root: { x: 32, y: -50 } },
] as const

interface AngleFrame {
  t: number
  segments: number[]
  hoofAngle: number
}

interface GaitClip extends LimbSpec {
  lengths: readonly number[]
  frames: readonly AngleFrame[]
  idleAngles: readonly number[]
  idleHoofAngle: number
  contactStartX: number
  contactEndX: number
}

export interface ForeLegPose {
  kind: 'fore'
  root: Point
  knee: Point
  fetlock: Point
  hoof: Point
  hoofAngle: number
}

export interface HindLegPose {
  kind: 'hind'
  root: Point
  stifle: Point
  hock: Point
  fetlock: Point
  hoof: Point
  hoofAngle: number
}

export type LegPose = ForeLegPose | HindLegPose

interface TimedForePose {
  t: number
  knee: Point
  fetlock: Point
  hoof: Point
  hoofAngle: number
}

interface TimedHindPose {
  t: number
  stifle: Point
  hock: Point
  fetlock: Point
  hoof: Point
  hoofAngle: number
}

interface TimedHindTarget {
  t: number
  /** Hock and hoof coordinates relative to the hip/root. */
  hock: Point
  hoof: Point
  hoofAngle: number
}

const FRAME_COUNT = 12
const HIND_CONTACT_END = 0.16
const FORE_CONTACT_END = 0.22
const HIND_CONTACT_RELEASE_START = 0.13
const HIND_CONTACT_RELEASE_END = 0.23
const FORE_CONTACT_RELEASE_START = 0.18
const FORE_CONTACT_RELEASE_END = 0.28
const HIND_CONTACT_APPROACH_START = 0.92
const FORE_CONTACT_APPROACH_START = 0.96

const FORE_SOURCE_ROOT = { x: 32, y: -50 }
const HIND_SOURCE_ROOT = { x: -36, y: -64 }

// Twelve silhouettes based on the principal phases of Muybridge's Annie G.
// plate: impact, loading, vertical support, break-over, flexion, collection,
// protraction and the next impact. These are source points only; the runtime
// animation is reconstructed with the fixed lengths declared per clip below.
const FORE_SOURCE: readonly TimedForePose[] = [
  { t: 0 / 12, knee: { x: 48.2, y: -31 }, fetlock: { x: 49, y: -7 }, hoof: { x: 52, y: 0 }, hoofAngle: 0.04 },
  { t: 1 / 12, knee: { x: 46.7, y: -29.7 }, fetlock: { x: 39, y: -7 }, hoof: { x: 40, y: 0 }, hoofAngle: 0 },
  { t: 2 / 12, knee: { x: 42.1, y: -27.1 }, fetlock: { x: 29, y: -7 }, hoof: { x: 28, y: 0 }, hoofAngle: -0.05 },
  { t: 3 / 12, knee: { x: 30.8, y: -25 }, fetlock: { x: 15, y: -7 }, hoof: { x: 10, y: 0 }, hoofAngle: -0.12 },
  { t: 4 / 12, knee: { x: 28, y: -25.3 }, fetlock: { x: 8, y: -12 }, hoof: { x: 3, y: -6 }, hoofAngle: -0.34 },
  { t: 5 / 12, knee: { x: 36.9, y: -25.5 }, fetlock: { x: 13, y: -23 }, hoof: { x: 7, y: -18 }, hoofAngle: -0.46 },
  { t: 6 / 12, knee: { x: 42, y: -27.1 }, fetlock: { x: 19, y: -34 }, hoof: { x: 14, y: -29 }, hoofAngle: -0.38 },
  { t: 7 / 12, knee: { x: 50.7, y: -33.4 }, fetlock: { x: 27, y: -37 }, hoof: { x: 23, y: -31 }, hoofAngle: -0.16 },
  { t: 8 / 12, knee: { x: 56.6, y: -45.8 }, fetlock: { x: 37, y: -32 }, hoof: { x: 36, y: -25 }, hoofAngle: 0.1 },
  { t: 9 / 12, knee: { x: 56.1, y: -43.2 }, fetlock: { x: 47, y: -21 }, hoof: { x: 48, y: -14 }, hoofAngle: 0.18 },
  { t: 10 / 12, knee: { x: 52, y: -35 }, fetlock: { x: 52, y: -11 }, hoof: { x: 55, y: -4 }, hoofAngle: 0.12 },
  { t: 11 / 12, knee: { x: 49.3, y: -31.9 }, fetlock: { x: 51, y: -8 }, hoof: { x: 54, y: -1 }, hoofAngle: 0.07 },
  { t: 1, knee: { x: 48.2, y: -31 }, fetlock: { x: 49, y: -7 }, hoof: { x: 52, y: 0 }, hoofAngle: 0.04 },
]

// Rear motion is authored from the two joints that define the silhouette:
// the backward-facing hock and the hoof. The hidden stifle and fetlock are
// reconstructed from fixed bone lengths below. This prevents the accordion
// poses and keeps leading/trailing limbs genuinely distinct instead of merely
// translating the same curve.
const HIND_LEAD_TARGETS: readonly TimedHindTarget[] = [
  // Rotoscoped silhouette from Annie G.: the leading hind lands behind the
  // hip, sweeps farther back during support, then folds sharply at toe-off.
  { t: 0, hock: { x: -17, y: 40 }, hoof: { x: -18, y: 64 }, hoofAngle: 0.04 },
  { t: 0.055, hock: { x: -20, y: 40 }, hoof: { x: -25, y: 64 }, hoofAngle: 0 },
  { t: 0.11, hock: { x: -24, y: 41 }, hoof: { x: -34, y: 64 }, hoofAngle: -0.03 },
  { t: 0.16, hock: { x: -26, y: 41 }, hoof: { x: -44, y: 63 }, hoofAngle: -0.12 },
  { t: 0.22, hock: { x: -24, y: 36 }, hoof: { x: -46, y: 53 }, hoofAngle: -0.42 },
  { t: 0.31, hock: { x: -18, y: 25 }, hoof: { x: -37, y: 38 }, hoofAngle: -0.5 },
  { t: 0.44, hock: { x: -10, y: 17 }, hoof: { x: -20, y: 27 }, hoofAngle: -0.34 },
  { t: 0.58, hock: { x: -5, y: 17 }, hoof: { x: 1, y: 25 }, hoofAngle: -0.16 },
  { t: 0.71, hock: { x: 0, y: 21 }, hoof: { x: 20, y: 31 }, hoofAngle: 0.04 },
  { t: 0.82, hock: { x: 1, y: 27 }, hoof: { x: 25, y: 43 }, hoofAngle: 0.11 },
  { t: 0.91, hock: { x: -5, y: 35 }, hoof: { x: 11, y: 57 }, hoofAngle: 0.1 },
  { t: 0.98, hock: { x: -15, y: 40 }, hoof: { x: -15, y: 63 }, hoofAngle: 0.06 },
]

const HIND_TRAIL_TARGETS: readonly TimedHindTarget[] = [
  // The trailing hind is the first impact and is visibly farther back than
  // the leading hind in the photographic sequence.
  { t: 0, hock: { x: -27, y: 39 }, hoof: { x: -29, y: 64 }, hoofAngle: 0.04 },
  { t: 0.055, hock: { x: -29, y: 40 }, hoof: { x: -35, y: 64 }, hoofAngle: 0 },
  { t: 0.11, hock: { x: -29, y: 41 }, hoof: { x: -41, y: 64 }, hoofAngle: -0.03 },
  { t: 0.16, hock: { x: -28, y: 41 }, hoof: { x: -48, y: 63 }, hoofAngle: -0.12 },
  { t: 0.22, hock: { x: -25, y: 37 }, hoof: { x: -49, y: 55 }, hoofAngle: -0.42 },
  { t: 0.3, hock: { x: -20, y: 27 }, hoof: { x: -42, y: 42 }, hoofAngle: -0.5 },
  { t: 0.42, hock: { x: -13, y: 19 }, hoof: { x: -26, y: 30 }, hoofAngle: -0.34 },
  { t: 0.55, hock: { x: -8, y: 17 }, hoof: { x: -8, y: 26 }, hoofAngle: -0.16 },
  { t: 0.68, hock: { x: -4, y: 19 }, hoof: { x: 12, y: 29 }, hoofAngle: 0.04 },
  { t: 0.8, hock: { x: -2, y: 25 }, hoof: { x: 23, y: 40 }, hoofAngle: 0.11 },
  { t: 0.9, hock: { x: -10, y: 34 }, hoof: { x: 4, y: 55 }, hoofAngle: 0.1 },
  { t: 0.97, hock: { x: -23, y: 38 }, hoof: { x: -24, y: 62 }, hoofAngle: 0.06 },
]

const LEADING_FORE_FOOT = [
  { t: 0, point: { x: 54, y: 0 } },
  { t: 0.1, point: { x: 40, y: 0 } },
  { t: 0.23, point: { x: 15, y: 0 } },
  { t: 0.34, point: { x: 7, y: -23 } },
  { t: 0.5, point: { x: 13, y: -34 } },
  { t: 0.7, point: { x: 39, y: -20 } },
  { t: 0.88, point: { x: 54, y: -6 } },
  { t: 1, point: { x: 54, y: 0 } },
] as const

const TRAILING_FORE_FOOT = [
  { t: 0, point: { x: 43, y: 0 } },
  { t: 0.1, point: { x: 30, y: 0 } },
  { t: 0.23, point: { x: 8, y: 0 } },
  { t: 0.34, point: { x: 1, y: -22 } },
  { t: 0.5, point: { x: 7, y: -32 } },
  { t: 0.7, point: { x: 31, y: -19 } },
  { t: 0.88, point: { x: 43, y: -6 } },
  { t: 1, point: { x: 43, y: 0 } },
] as const

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))
export const wrapCycle = (value: number) => ((value % 1) + 1) % 1
const mix = (from: number, to: number, amount: number) => from + (to - from) * amount
const smoothstep = (value: number) => {
  const t = clamp(value, 0, 1)
  return t * t * (3 - 2 * t)
}

function sampleTimedPoint(keys: readonly { t: number; point: Point }[], phase: number): Point {
  const t = clamp(phase, 0, 1)
  let index = 0
  while (index < keys.length - 2 && t > keys[index + 1].t) index++
  const a = keys[index]
  const b = keys[index + 1]
  const u = (t - a.t) / Math.max(0.0001, b.t - a.t)
  return { x: mix(a.point.x, b.point.x, u), y: mix(a.point.y, b.point.y, u) }
}

function sampleTimedFore(keys: readonly TimedForePose[], phase: number): TimedForePose {
  const t = clamp(phase, 0, 1)
  let index = 0
  while (index < keys.length - 2 && t > keys[index + 1].t) index++
  const a = keys[index]
  const b = keys[index + 1]
  const u = (t - a.t) / Math.max(0.0001, b.t - a.t)
  const point = (from: Point, to: Point): Point => ({ x: mix(from.x, to.x, u), y: mix(from.y, to.y, u) })
  return {
    t,
    knee: point(a.knee, b.knee),
    fetlock: point(a.fetlock, b.fetlock),
    hoof: point(a.hoof, b.hoof),
    hoofAngle: mix(a.hoofAngle, b.hoofAngle, u),
  }
}

function sampleTimedHind(keys: readonly TimedHindPose[], phase: number): TimedHindPose {
  const t = clamp(phase, 0, 1)
  let index = 0
  while (index < keys.length - 2 && t > keys[index + 1].t) index++
  const a = keys[index]
  const b = keys[index + 1]
  const u = (t - a.t) / Math.max(0.0001, b.t - a.t)
  const point = (from: Point, to: Point): Point => ({ x: mix(from.x, to.x, u), y: mix(from.y, to.y, u) })
  return {
    t,
    stifle: point(a.stifle, b.stifle),
    hock: point(a.hock, b.hock),
    fetlock: point(a.fetlock, b.fetlock),
    hoof: point(a.hoof, b.hoof),
    hoofAngle: mix(a.hoofAngle, b.hoofAngle, u),
  }
}

function angleBetween(a: Point, b: Point): number {
  return Math.atan2(b.x - a.x, b.y - a.y)
}

function retargetFore(source: TimedForePose, root: Point, target: Point, xScale: number, yScale: number): TimedForePose {
  const transform = (point: Point): Point => ({
    x: root.x + (point.x - FORE_SOURCE_ROOT.x) * xScale,
    y: root.y + (point.y - FORE_SOURCE_ROOT.y) * yScale,
  })
  const knee = transform(source.knee)
  const fetlock = transform(source.fetlock)
  const hoof = transform(source.hoof)
  const delta = { x: target.x - hoof.x, y: target.y - hoof.y }
  return {
    t: source.t,
    knee: { x: knee.x + delta.x * 0.16, y: knee.y + delta.y * 0.16 },
    fetlock: { x: fetlock.x + delta.x * 0.58, y: fetlock.y + delta.y * 0.58 },
    hoof: target,
    hoofAngle: source.hoofAngle,
  }
}

function foreFrame(pose: TimedForePose, root: Point): AngleFrame {
  return {
    t: pose.t,
    segments: [angleBetween(root, pose.knee), angleBetween(pose.knee, pose.fetlock), angleBetween(pose.fetlock, pose.hoof)],
    hoofAngle: pose.hoofAngle,
  }
}

function hindFrame(pose: TimedHindPose, root: Point): AngleFrame {
  return {
    t: pose.t,
    segments: [
      angleBetween(root, pose.stifle),
      angleBetween(pose.stifle, pose.hock),
      angleBetween(pose.hock, pose.fetlock),
      angleBetween(pose.fetlock, pose.hoof),
    ],
    hoofAngle: pose.hoofAngle,
  }
}

function buildForeFrames(root: Point, footPath: typeof LEADING_FORE_FOOT | typeof TRAILING_FORE_FOOT, xScale: number, yScale: number): AngleFrame[] {
  const frames: AngleFrame[] = []
  for (let i = 0; i < FRAME_COUNT; i++) {
    const t = i / FRAME_COUNT
    const source = sampleTimedFore(FORE_SOURCE, t)
    const target = sampleTimedPoint(footPath, t)
    frames.push(foreFrame(retargetFore(source, root, target, xScale, yScale), root))
  }
  return frames
}

function solveCircleJoint(centerA: Point, radiusA: number, centerB: Point, radiusB: number, preference: Point): Point {
  const dx = centerB.x - centerA.x
  const dy = centerB.y - centerA.y
  const rawDistance = Math.max(0.001, Math.hypot(dx, dy))
  const distance = clamp(rawDistance, Math.abs(radiusA - radiusB) + 0.001, radiusA + radiusB - 0.001)
  const ux = dx / rawDistance
  const uy = dy / rawDistance
  const along = (radiusA * radiusA - radiusB * radiusB + distance * distance) / (2 * distance)
  const height = Math.sqrt(Math.max(0, radiusA * radiusA - along * along))
  const base = { x: centerA.x + ux * along, y: centerA.y + uy * along }
  const candidates = [
    { x: base.x - uy * height, y: base.y + ux * height },
    { x: base.x + uy * height, y: base.y - ux * height },
  ]
  const candidateDistance = (point: Point) => Math.hypot(point.x - preference.x, point.y - preference.y)
  return candidateDistance(candidates[0]) <= candidateDistance(candidates[1])
    ? candidates[0]
    : candidates[1]
}

function buildHindFrames(targets: readonly TimedHindTarget[], root: Point, lengths: readonly number[]): AngleFrame[] {
  const [femur, tibia, cannon, pastern] = lengths
  return targets.map((target) => {
    const hock = { x: root.x + target.hock.x, y: root.y + target.hock.y }
    const hoof = { x: root.x + target.hoof.x, y: root.y + target.hoof.y }
    const stifle = solveCircleJoint(root, femur, hock, tibia, { x: root.x + 22, y: root.y + 20 })
    const fetlock = solveCircleJoint(hock, cannon, hoof, pastern, { x: hoof.x - 5, y: hoof.y - 7 })
    return hindFrame({ t: target.t, stifle, hock, fetlock, hoof, hoofAngle: target.hoofAngle }, root)
  })
}

function clipFor(id: GallopLimbId): GaitClip {
  const spec = GALLOP_LIMBS.find((limb) => limb.id === id)!
  if (id === 'foreLead') {
    return {
      ...spec,
      lengths: [25, 24, 8],
      frames: buildForeFrames(spec.root, LEADING_FORE_FOOT, 1, 1),
      idleAngles: [-0.2, 0.65, 0.6],
      idleHoofAngle: 0,
      contactStartX: 54,
      contactEndX: 15,
    }
  }
  if (id === 'foreTrail') {
    return {
      ...spec,
      lengths: [26, 25, 8],
      frames: buildForeFrames(spec.root, TRAILING_FORE_FOOT, 0.94, 1.04),
      idleAngles: [0.4, -0.4, -0.7],
      idleHoofAngle: 0,
      contactStartX: 43,
      contactEndX: 8,
    }
  }
  if (id === 'hindLead') {
    const lengths = [27, 30, 24, 8] as const
    return {
      ...spec,
      lengths,
      frames: buildHindFrames(HIND_LEAD_TARGETS, spec.root, lengths),
      idleAngles: [0.85, -1.05, -0.15, -0.1],
      idleHoofAngle: 0,
      contactStartX: -54,
      contactEndX: -80,
    }
  }
  const lengths = [27.5, 30.5, 24.5, 8] as const
  return {
    ...spec,
    lengths,
    frames: buildHindFrames(HIND_TRAIL_TARGETS, spec.root, lengths),
    idleAngles: [1, -0.9, 0.35, 0.25],
    idleHoofAngle: 0,
    contactStartX: -67,
    contactEndX: -86,
  }
}

const CLIPS: Record<GallopLimbId, GaitClip> = {
  hindTrail: clipFor('hindTrail'),
  hindLead: clipFor('hindLead'),
  foreTrail: clipFor('foreTrail'),
  foreLead: clipFor('foreLead'),
}

// Uniform cubic B-spline. All weights are positive, so the interpolated angle
// remains inside the neighbouring poses instead of overshooting like a raw
// Catmull-Rom curve. It is C2-continuous through the phase wrap.
function spline(values: readonly number[], phase: number): number {
  const f = wrapCycle(phase) * values.length
  const i = Math.floor(f)
  const u = f - i
  const at = (offset: number) => values[(i + offset + values.length) % values.length]
  const u2 = u * u
  const u3 = u2 * u
  const w0 = (1 - 3 * u + 3 * u2 - u3) / 6
  const w1 = (4 - 6 * u2 + 3 * u3) / 6
  const w2 = (1 + 3 * u + 3 * u2 - 3 * u3) / 6
  const w3 = u3 / 6
  return at(-1) * w0 + at(0) * w1 + at(1) * w2 + at(2) * w3
}

const FULL_TURN = Math.PI * 2

function unwrapNear(reference: number, value: number): number {
  return value + Math.round((reference - value) / FULL_TURN) * FULL_TURN
}

function pchipTangent(dPrev: number, dNext: number, hPrev: number, hNext: number): number {
  if (Math.abs(dPrev) < 1e-7 || Math.abs(dNext) < 1e-7 || Math.sign(dPrev) !== Math.sign(dNext)) return 0
  const w1 = 2 * hNext + hPrev
  const w2 = hNext + 2 * hPrev
  return (w1 + w2) / (w1 / dPrev + w2 / dNext)
}

/**
 * Periodic, non-uniform PCHIP used by the rear limbs. Unlike the uniform
 * B-spline it reaches every authored contact/flexion pose exactly, while the
 * monotone tangents prevent a hock from overshooting or flipping sides.
 */
function timedPchip(frames: readonly AngleFrame[], valueAt: (frame: AngleFrame) => number, phase: number): number {
  const t = wrapCycle(phase)
  const count = frames.length
  let index = count - 1
  for (let i = 0; i < count - 1; i++) {
    if (t < frames[i + 1].t) {
      index = i
      break
    }
  }

  const prevIndex = (index - 1 + count) % count
  const nextIndex = (index + 1) % count
  const afterIndex = (index + 2) % count
  const t0 = frames[index].t
  let tPrev = frames[prevIndex].t
  let t1 = frames[nextIndex].t
  let t2 = frames[afterIndex].t
  while (tPrev >= t0) tPrev -= 1
  while (t1 <= t0) t1 += 1
  while (t2 <= t1) t2 += 1

  const v0 = valueAt(frames[index])
  const vPrev = unwrapNear(v0, valueAt(frames[prevIndex]))
  const v1 = unwrapNear(v0, valueAt(frames[nextIndex]))
  const v2 = unwrapNear(v1, valueAt(frames[afterIndex]))
  const hPrev = t0 - tPrev
  const h = t1 - t0
  const hNext = t2 - t1
  const dPrev = (v0 - vPrev) / hPrev
  const d = (v1 - v0) / h
  const dNext = (v2 - v1) / hNext
  const m0 = pchipTangent(dPrev, d, hPrev, h)
  const m1 = pchipTangent(d, dNext, h, hNext)
  const sampleT = t < t0 ? t + 1 : t
  const u = clamp((sampleT - t0) / h, 0, 1)
  const u2 = u * u
  const u3 = u2 * u
  const h00 = 2 * u3 - 3 * u2 + 1
  const h10 = u3 - 2 * u2 + u
  const h01 = -2 * u3 + 3 * u2
  const h11 = u3 - u2
  return h00 * v0 + h10 * h * m0 + h01 * v1 + h11 * h * m1
}

function forward(root: Point, angles: readonly number[], lengths: readonly number[]): Point[] {
  const points = [{ ...root }]
  for (let i = 0; i < lengths.length; i++) {
    const previous = points[points.length - 1]
    points.push({
      x: previous.x + Math.sin(angles[i]) * lengths[i],
      y: previous.y + Math.cos(angles[i]) * lengths[i],
    })
  }
  return points
}

export function sampleLegPose(id: GallopLimbId, localPhase: number, motion: number): LegPose {
  const clip = CLIPS[id]
  const sampleFrame = (valueAt: (frame: AngleFrame) => number) =>
    clip.kind === 'hind' ? timedPchip(clip.frames, valueAt, localPhase) : spline(clip.frames.map(valueAt), localPhase)
  const movingAngles = clip.lengths.map((_, segment) => sampleFrame((frame) => frame.segments[segment]))
  const amount = clamp(motion, 0, 1)
  const angles = movingAngles.map((angle, index) => mix(clip.idleAngles[index], angle, amount))
  const points = forward(clip.root, angles, clip.lengths)
  const movingHoofAngle = sampleFrame((frame) => frame.hoofAngle)
  const hoofAngle = mix(clip.idleHoofAngle, movingHoofAngle, amount)

  if (clip.kind === 'fore') {
    return { kind: 'fore', root: points[0], knee: points[1], fetlock: points[2], hoof: points[3], hoofAngle }
  }
  return {
    kind: 'hind',
    root: points[0],
    stifle: points[1],
    hock: points[2],
    fetlock: points[3],
    hoof: points[4],
    hoofAngle,
  }
}

export function legGroundTargetX(id: GallopLimbId, localPhase: number, motion: number, currentX: number): number {
  const clip = CLIPS[id]
  const idle = sampleLegPose(id, localPhase, 0).hoof.x
  const phase = wrapCycle(localPhase)
  const contactEnd = clip.kind === 'hind' ? HIND_CONTACT_END : FORE_CONTACT_END
  const approachStart = clip.kind === 'hind' ? HIND_CONTACT_APPROACH_START : FORE_CONTACT_APPROACH_START
  const releaseEnd = clip.kind === 'hind' ? HIND_CONTACT_RELEASE_END : FORE_CONTACT_RELEASE_END
  if (phase >= approachStart) {
    return mix(idle, clip.contactStartX, clamp(motion, 0, 1))
  }
  if (phase >= releaseEnd) return mix(currentX, idle, 1 - clamp(motion, 0, 1))
  const planted = phase < contactEnd
    ? mix(clip.contactStartX, clip.contactEndX, phase / contactEnd)
    : clip.contactEndX
  return mix(idle, planted, clamp(motion, 0, 1))
}

/** Continuous track constraint around toe-off and the following impact. */
export function legGroundLockStrength(id: GallopLimbId, localPhase: number): number {
  const clip = CLIPS[id]
  const phase = wrapCycle(localPhase)
  const releaseStart = clip.kind === 'hind' ? HIND_CONTACT_RELEASE_START : FORE_CONTACT_RELEASE_START
  const releaseEnd = clip.kind === 'hind' ? HIND_CONTACT_RELEASE_END : FORE_CONTACT_RELEASE_END
  const approachStart = clip.kind === 'hind' ? HIND_CONTACT_APPROACH_START : FORE_CONTACT_APPROACH_START
  if (phase < releaseStart) return 1
  if (phase < releaseEnd) {
    return 1 - smoothstep((phase - releaseStart) / (releaseEnd - releaseStart))
  }
  if (phase >= approachStart) {
    return smoothstep((phase - approachStart) / (1 - approachStart))
  }
  return 0
}

export function isLegInContact(id: GallopLimbId, localPhase: number): boolean {
  const clip = CLIPS[id]
  const contactEnd = clip.kind === 'hind' ? HIND_CONTACT_END : FORE_CONTACT_END
  return wrapCycle(localPhase) < contactEnd
}

export function legContactStrength(id: GallopLimbId, localPhase: number): number {
  const clip = CLIPS[id]
  const phase = wrapCycle(localPhase)
  const contactEnd = clip.kind === 'hind' ? HIND_CONTACT_END : FORE_CONTACT_END
  if (phase >= contactEnd) return 0
  return Math.pow(Math.sin((phase / contactEnd) * Math.PI), 4)
}

export function contactHoofAngle(id: GallopLimbId, localPhase: number): number {
  const clip = CLIPS[id]
  const phase = wrapCycle(localPhase)
  const contactEnd = clip.kind === 'hind' ? HIND_CONTACT_END : FORE_CONTACT_END
  const releaseEnd = clip.kind === 'hind' ? HIND_CONTACT_RELEASE_END : FORE_CONTACT_RELEASE_END
  const approachStart = clip.kind === 'hind' ? HIND_CONTACT_APPROACH_START : FORE_CONTACT_APPROACH_START
  if (phase >= approachStart) return 0.05
  if (phase >= releaseEnd) return 0
  const progress = clamp(phase / contactEnd, 0, 1)
  if (progress < 0.24) return mix(0.08, 0, progress / 0.24)
  if (progress < 0.72) return 0
  const lift = (progress - 0.72) / 0.28
  return mix(0, -0.34, lift * lift * (3 - 2 * lift))
}
