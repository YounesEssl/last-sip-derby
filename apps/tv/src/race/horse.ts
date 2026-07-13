// Procedural side-view racehorse + jockey, drawn with canvas primitives.
// Local space: origin on the ground under the body center, +x forward,
// -y up. Nominal size: ~130px long, ~110px tall with jockey (scaled by caller).

import {
  GALLOP_LIMBS,
  contactHoofAngle,
  isLegInContact,
  legContactStrength,
  legGroundLockStrength,
  legGroundTargetX,
  sampleLegPose,
  wrapCycle,
  type LegPose,
  type Point,
} from './gait'

export interface Coat {
  body: string
  dark: string
  light: string
  mane: string
}

export interface HorseRenderOpts {
  coat: Coat
  silk: string // team color (silks, cap, saddle blanket)
  number: number // 1-based saddle number
  phase: number // gallop cycle, 0..1
  speedNorm: number // 0 = standing, 1 = full gallop
  time: number // seconds, for idle/dizzy motion
  fall: number // 0..1 elimination fall progress (1 = sitting)
  dizzy: boolean // draw dizzy stars (after fall)
  jockeyFall?: number // 0..1, rider thrown while the horse keeps running
  debugHind?: boolean // animation lab: overlay the resolved rear skeletons
}

const TWO_PI = Math.PI * 2

/** Ground-contact intensity per near hoof (used to spawn dust). */
export function hoofContact(phase: number): number {
  return hoofContactSample(phase).strength
}

export function hoofContactSample(phase: number): { strength: number; x: number } {
  let c = 0
  let x = 0
  for (const leg of GALLOP_LIMBS) {
    if (leg.far) continue
    const localPhase = wrapCycle(phase + leg.phaseOffset)
    const strength = legContactStrength(leg.id, localPhase)
    if (strength > c) {
      c = strength
      x = legGroundTargetX(leg.id, localPhase, 1, 0)
    }
  }
  return { strength: c, x }
}

function limb(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  a1: number,
  a2: number,
  l1: number,
  l2: number,
  w: number,
  color: string,
  hoofColor: string,
) {
  const x1 = x0 + Math.sin(a1) * l1
  const y1 = y0 + Math.cos(a1) * l1
  const x2 = x1 + Math.sin(a2) * l2
  const y2 = y1 + Math.cos(a2) * l2
  ctx.strokeStyle = color
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.lineWidth = w
  ctx.beginPath()
  ctx.moveTo(x0, y0)
  ctx.lineTo(x1, y1)
  ctx.stroke()
  ctx.lineWidth = w * 0.72
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.stroke()
  // Subtle joints and tendon keep the silhouette readable without the
  // rubber-hose look of two uniform sticks.
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(x1, y1, w * 0.48, 0, TWO_PI)
  ctx.fill()
  ctx.strokeStyle = 'rgba(36,24,18,0.28)'
  ctx.lineWidth = Math.max(1, w * 0.16)
  ctx.beginPath()
  ctx.moveTo(x1 + w * 0.24, y1)
  ctx.lineTo(x2 + w * 0.12, y2)
  ctx.stroke()
  // hoof
  ctx.fillStyle = hoofColor
  ctx.beginPath()
  ctx.ellipse(x2, y2 + 1, w * 0.5, w * 0.36, 0, 0, TWO_PI)
  ctx.fill()
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))
const mix = (from: number, to: number, amount: number) => from + (to - from) * amount
const ease = (value: number) => {
  const t = clamp(value, 0, 1)
  return t * t * (3 - 2 * t)
}

/** A wrapped, soft pulse used for impact and suspension body mechanics. */
function gaitPulse(phase: number, center: number, radius: number): number {
  let distance = Math.abs(phase - center)
  distance = Math.min(distance, 1 - distance)
  return ease(1 - distance / radius)
}

function bodySpaceGroundPoint(x: number, bodyY: number, pitch: number): Point {
  const y = -bodyY
  const cos = Math.cos(pitch)
  const sin = Math.sin(pitch)
  return { x: cos * x - sin * y, y: sin * x + cos * y }
}

function posePoints(pose: LegPose): Point[] {
  return pose.kind === 'fore'
    ? [pose.root, pose.knee, pose.fetlock, pose.hoof]
    : [pose.root, pose.stifle, pose.hock, pose.fetlock, pose.hoof]
}

function pointDistance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

/**
 * Small contact-only FABRIK correction. The authored pose remains in charge;
 * this projection merely removes the few pixels introduced by body bob/pitch
 * while preserving every segment length. If rear topology would be broken,
 * the correction is reduced instead of allowing a joint to flip.
 */
function solveChain(points: readonly Point[], target: Point): Point[] {
  const solved = points.map((point) => ({ ...point }))
  const root = { ...solved[0] }
  const lengths = solved.slice(0, -1).map((point, index) => pointDistance(point, solved[index + 1]))
  const total = lengths.reduce((sum, length) => sum + length, 0)
  const rootDistance = pointDistance(root, target)

  if (rootDistance >= total - 0.01) {
    const dx = (target.x - root.x) / Math.max(0.001, rootDistance)
    const dy = (target.y - root.y) / Math.max(0.001, rootDistance)
    solved[0] = root
    for (let i = 0; i < lengths.length; i++) {
      solved[i + 1] = { x: solved[i].x + dx * lengths[i], y: solved[i].y + dy * lengths[i] }
    }
    return solved
  }

  for (let iteration = 0; iteration < 8; iteration++) {
    solved[solved.length - 1] = { ...target }
    for (let i = solved.length - 2; i >= 0; i--) {
      const next = solved[i + 1]
      const distance = Math.max(0.001, pointDistance(solved[i], next))
      const ratio = lengths[i] / distance
      solved[i] = { x: next.x + (solved[i].x - next.x) * ratio, y: next.y + (solved[i].y - next.y) * ratio }
    }
    solved[0] = { ...root }
    for (let i = 0; i < solved.length - 1; i++) {
      const distance = Math.max(0.001, pointDistance(solved[i], solved[i + 1]))
      const ratio = lengths[i] / distance
      solved[i + 1] = {
        x: solved[i].x + (solved[i + 1].x - solved[i].x) * ratio,
        y: solved[i].y + (solved[i + 1].y - solved[i].y) * ratio,
      }
    }
  }
  return solved
}

function solveDistalJoint(start: Point, end: Point, upperLength: number, lowerLength: number, preference: Point): Point | null {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const distance = Math.hypot(dx, dy)
  if (distance <= Math.abs(upperLength - lowerLength) + 0.01 || distance >= upperLength + lowerLength - 0.01) return null
  const ux = dx / distance
  const uy = dy / distance
  const along = (upperLength * upperLength - lowerLength * lowerLength + distance * distance) / (2 * distance)
  const height = Math.sqrt(Math.max(0, upperLength * upperLength - along * along))
  const base = { x: start.x + ux * along, y: start.y + uy * along }
  const candidates = [
    { x: base.x - uy * height, y: base.y + ux * height },
    { x: base.x + uy * height, y: base.y - ux * height },
  ]
  const score = (candidate: Point) => {
    let value = pointDistance(candidate, preference)
    // The fetlock stays above the hoof during support, and the hoof should not
    // fold backwards through it when the contact correction is applied.
    if (candidate.y > end.y - 0.4) value += 40
    if (candidate.x > end.x + 1.5) value += 18
    return value
  }
  return score(candidates[0]) <= score(candidates[1]) ? candidates[0] : candidates[1]
}

function poseFromPoints(source: LegPose, points: readonly Point[], hoofAngle: number): LegPose {
  if (source.kind === 'fore') {
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

function lockLegToTrack(
  pose: LegPose,
  targetX: number,
  bodyY: number,
  pitch: number,
  amount: number,
  trackHoofAngle: number,
): LegPose {
  if (amount <= 0.001) return pose
  const localTarget = bodySpaceGroundPoint(targetX, bodyY, pitch)
  let correction = clamp(amount, 0, 1)

  if (pose.kind === 'hind') {
    const cannon = pointDistance(pose.hock, pose.fetlock)
    const pastern = pointDistance(pose.fetlock, pose.hoof)
    for (let attempt = 0; attempt < 6; attempt++) {
      const target = {
        x: mix(pose.hoof.x, localTarget.x, correction),
        y: mix(pose.hoof.y, localTarget.y, correction),
      }
      const fetlock = solveDistalJoint(pose.hock, target, cannon, pastern, pose.fetlock)
      if (fetlock) {
        return {
          ...pose,
          fetlock,
          hoof: target,
          hoofAngle: mix(pose.hoofAngle, trackHoofAngle + pitch, correction),
        }
      }
      correction *= 0.5
    }
    return pose
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    const target = {
      x: mix(pose.hoof.x, localTarget.x, correction),
      y: mix(pose.hoof.y, localTarget.y, correction),
    }
    const solved = solveChain(posePoints(pose), target)
    return poseFromPoints(pose, solved, mix(pose.hoofAngle, trackHoofAngle + pitch, correction))
  }
  return pose
}

function drawTaperedBone(
  ctx: CanvasRenderingContext2D,
  from: Point,
  to: Point,
  fromWidth: number,
  toWidth: number,
  color: string,
  outline: string,
) {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const length = Math.max(0.001, Math.hypot(dx, dy))
  const nx = -dy / length
  const ny = dx / length
  const polygon = (startWidth: number, endWidth: number) => {
    ctx.beginPath()
    ctx.moveTo(from.x + nx * startWidth * 0.5, from.y + ny * startWidth * 0.5)
    ctx.lineTo(to.x + nx * endWidth * 0.5, to.y + ny * endWidth * 0.5)
    ctx.lineTo(to.x - nx * endWidth * 0.5, to.y - ny * endWidth * 0.5)
    ctx.lineTo(from.x - nx * startWidth * 0.5, from.y - ny * startWidth * 0.5)
    ctx.closePath()
    ctx.fill()
  }

  ctx.fillStyle = outline
  polygon(fromWidth + 2.2, toWidth + 2.2)
  ctx.fillStyle = color
  polygon(fromWidth, toWidth)
}

function drawLegJoint(ctx: CanvasRenderingContext2D, point: Point, radius: number, color: string, outline: string) {
  ctx.fillStyle = outline
  ctx.beginPath()
  ctx.arc(point.x, point.y, radius + 1.1, 0, TWO_PI)
  ctx.fill()
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(point.x, point.y, radius, 0, TWO_PI)
  ctx.fill()
}

function drawAnimatedLeg(
  ctx: CanvasRenderingContext2D,
  pose: LegPose,
  width: number,
  color: string,
  hoofColor: string,
  far: boolean,
  layer: 'full' | 'distal',
) {
  const outline = far ? 'rgba(25,17,13,0.46)' : 'rgba(25,17,13,0.72)'
  if (pose.kind === 'fore') {
    if (layer === 'full') drawTaperedBone(ctx, pose.root, pose.knee, width * 1.04, width * 0.78, color, outline)
    drawTaperedBone(ctx, pose.knee, pose.fetlock, width * 0.66, width * 0.46, color, outline)
    drawTaperedBone(ctx, pose.fetlock, pose.hoof, width * 0.43, width * 0.34, color, outline)
    drawLegJoint(ctx, pose.knee, width * 0.39, color, outline)
  } else {
    if (layer === 'full') {
      drawTaperedBone(ctx, pose.root, pose.stifle, width * 1.22, width * 0.92, color, outline)
      drawTaperedBone(ctx, pose.stifle, pose.hock, width * 0.9, width * 0.64, color, outline)
      drawTaperedBone(ctx, pose.hock, pose.fetlock, width * 0.58, width * 0.43, color, outline)
      drawLegJoint(ctx, pose.hock, width * 0.38, color, outline)
    } else {
      // Repaint only the exposed lower cannon after the torso. Repainting the
      // hock itself made a detached "elbow" float over the belly in the
      // grouped suspension poses.
      const exposed = 0.46
      const start = {
        x: mix(pose.hock.x, pose.fetlock.x, exposed),
        y: mix(pose.hock.y, pose.fetlock.y, exposed),
      }
      drawTaperedBone(ctx, start, pose.fetlock, width * 0.51, width * 0.43, color, outline)
    }
    drawTaperedBone(ctx, pose.fetlock, pose.hoof, width * 0.43, width * 0.34, color, outline)
    // Do not mark the stifle: it belongs inside the thigh. The hock is the
    // rear-facing articulation that must remain readable in silhouette.
  }
  drawLegJoint(ctx, pose.fetlock, width * 0.28, color, outline)

  const lowerStart = pose.kind === 'fore'
    ? pose.knee
    : layer === 'distal'
      ? { x: mix(pose.hock.x, pose.fetlock.x, 0.46), y: mix(pose.hock.y, pose.fetlock.y, 0.46) }
      : pose.hock
  ctx.strokeStyle = far ? 'rgba(244,232,206,0.12)' : 'rgba(244,232,206,0.2)'
  ctx.lineWidth = Math.max(0.8, width * 0.12)
  ctx.beginPath()
  ctx.moveTo(lowerStart.x + 1, lowerStart.y)
  ctx.lineTo(pose.fetlock.x + 0.8, pose.fetlock.y)
  ctx.stroke()

  ctx.save()
  ctx.translate(pose.hoof.x + Math.cos(pose.hoofAngle) * 1.2, pose.hoof.y)
  ctx.rotate(pose.hoofAngle)
  ctx.fillStyle = hoofColor
  ctx.strokeStyle = 'rgba(10,7,5,0.78)'
  ctx.lineWidth = 1.2
  ctx.beginPath()
  ctx.ellipse(1.4, 0, width * 0.78, width * 0.31, 0, 0, TWO_PI)
  ctx.fill()
  ctx.stroke()
  ctx.restore()
}

function drawHindDebug(ctx: CanvasRenderingContext2D, pose: LegPose, far: boolean, contact: boolean) {
  if (pose.kind !== 'hind') return
  const color = far ? '#65D5E8' : '#FF5F57'
  const points = [pose.root, pose.stifle, pose.hock, pose.fetlock, pose.hoof]
  const labels = ['H', 'G', 'J', 'B', 'S']

  ctx.save()
  ctx.setLineDash([4, 3])
  ctx.strokeStyle = color
  ctx.lineWidth = 1.7
  ctx.beginPath()
  ctx.moveTo(points[0].x, points[0].y)
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y)
  ctx.stroke()
  ctx.setLineDash([])

  for (let i = 0; i < points.length; i++) {
    const point = points[i]
    ctx.fillStyle = i === points.length - 1 && contact ? '#F7D154' : color
    ctx.strokeStyle = '#120C08'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.arc(point.x, point.y, i === 2 ? 3 : 2.4, 0, TWO_PI)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = '#FFF7E7'
    ctx.font = 'bold 6px monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    ctx.fillText(labels[i], point.x, point.y - 4)
  }
  ctx.restore()
}

export function drawHorse(ctx: CanvasRenderingContext2D, o: HorseRenderOpts) {
  const { coat, phase, speedNorm, time, fall, jockeyFall = 0 } = o
  const idle = speedNorm < 0.06 && fall === 0

  ctx.save()

  // ── Whole-body motion ──
  // The body is driven by named biomechanical moments instead of a generic
  // sine wave: impact, compression, push and airborne suspension.
  const hindImpact = gaitPulse(phase, 0.13, 0.17) * speedNorm
  const landing = gaitPulse(phase, 0.56, 0.17) * speedNorm
  const suspension = gaitPulse(phase, 0.86, 0.2) * speedNorm
  const stride = Math.sin(TWO_PI * phase)
  const bob =
    hindImpact * 0.9 + landing * 3.8 - suspension * 5.2 - Math.sin(TWO_PI * phase + 0.28) * 0.7 * speedNorm
  const pitch =
    (hindImpact * -0.012 + landing * 0.038 - suspension * 0.022 + Math.sin(TWO_PI * phase + 1.18) * 0.028) *
      speedNorm -
    fall * 0.52
  const sink = fall * 16
  const breathe = idle ? Math.sin(time * 2.1) * 1.6 : 0
  const bodyY = bob + sink + breathe * 0.4
  const spineFlex = (suspension * 3.4 - landing * 2.3 + stride * 0.8 * speedNorm)
  const shoulderDrive = Math.sin(TWO_PI * phase + 0.34) * 1.8 * speedNorm
  const haunchDrive = Math.sin(TWO_PI * phase + 2.75) * 2.2 * speedNorm

  // Shadow (before body transform)
  const shW = 74 - Math.abs(bob) * 1.6 - fall * 10
  ctx.fillStyle = 'rgba(20,10,4,0.28)'
  ctx.beginPath()
  ctx.ellipse(fall * -8, -2, shW, 11, 0, 0, TWO_PI)
  ctx.fill()

  ctx.translate(0, bodyY)
  ctx.rotate(-pitch)

  const hoofColor = '#241812'
  const motion = ease((speedNorm - 0.06) / 0.22)
  const legStates = GALLOP_LIMBS.map((leg) => {
    const localPhase = wrapCycle(phase + leg.phaseOffset)
    let pose = sampleLegPose(leg.id, localPhase, motion)
    const contact = isLegInContact(leg.id, localPhase)
    // Standing feet all remain grounded. As the horse accelerates, only the
    // authored support limb keeps the lock and the other three recover freely.
    const groundLock = mix(1, legGroundLockStrength(leg.id, localPhase), motion)
    const targetX = legGroundTargetX(leg.id, localPhase, motion, pose.hoof.x)
    pose = lockLegToTrack(
      pose,
      targetX,
      bodyY,
      pitch,
      groundLock,
      contactHoofAngle(leg.id, localPhase),
    )
    return { leg, pose, localPhase, contact }
  })

  // ── Legs under the torso ──
  // Draw both depth layers before the body so the croup/chest naturally mask
  // the hip, stifle and shoulder. Near distal segments are repainted later.
  if (fall > 0) {
    for (const leg of GALLOP_LIMBS) {
      if (!leg.far) continue
      const front = leg.kind === 'fore'
      const anchor = front ? { x: 30, y: -52 } : { x: -34, y: -54 }
      const splay = front ? 0.85 : -0.7
      limb(ctx, anchor.x, anchor.y, splay * fall, splay * fall * 0.6, 26, 26, 9, coat.dark, hoofColor)
    }
  } else {
    for (const state of legStates) {
      if (!state.leg.far) continue
      drawAnimatedLeg(ctx, state.pose, 7.2, coat.dark, hoofColor, true, 'full')
    }
    for (const state of legStates) {
      if (state.leg.far) continue
      drawAnimatedLeg(ctx, state.pose, 8.2, coat.body, hoofColor, false, 'full')
    }
  }

  // ── Tail ──
  const tailWave = idle
    ? Math.sin(time * 1.4) * 8
    : Math.sin(TWO_PI * phase + 2) * 7 + suspension * 5 - landing * 2
  const tailLift = 10 + speedNorm * 18 + suspension * 3
  ctx.strokeStyle = coat.mane
  ctx.lineCap = 'round'
  for (let i = 0; i < 3; i++) {
    ctx.lineWidth = 7 - i * 2
    ctx.beginPath()
    ctx.moveTo(-46, -62 + i * 2)
    ctx.quadraticCurveTo(
      -66 - speedNorm * 10,
      -62 - tailLift + tailWave + i * 3,
      -84 - speedNorm * 18,
      -46 - tailLift * 0.4 + tailWave * 1.5 + i * 6,
    )
    ctx.stroke()
  }

  // ── Body ──
  ctx.fillStyle = coat.body
  ctx.beginPath()
  ctx.moveTo(-46, -58 + haunchDrive * 0.35) // rump back
  ctx.bezierCurveTo(
    -55,
    -74 + haunchDrive * 0.4,
    -32,
    -82 - breathe - spineFlex * 0.42,
    -8,
    -79 - breathe - spineFlex,
  ) // rump → back
  ctx.bezierCurveTo(
    12,
    -78 - breathe - spineFlex * 0.7,
    30,
    -75 + shoulderDrive * 0.3,
    41,
    -67 + shoulderDrive * 0.45,
  ) // back → withers/chest top
  ctx.bezierCurveTo(52, -58 + landing, 49, -44 + landing * 0.6, 36, -40) // chest front
  ctx.bezierCurveTo(20, -36 + breathe + landing * 1.2, -10, -36 + breathe + landing, -28, -42) // belly
  ctx.bezierCurveTo(-44, -46, -50, -50 + haunchDrive * 0.25, -46, -58 + haunchDrive * 0.35)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = coat.dark
  ctx.lineWidth = 2.2
  ctx.stroke()
  // top highlight
  ctx.strokeStyle = coat.light
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(-34, -74 - spineFlex * 0.2)
  ctx.quadraticCurveTo(-6, -80 - breathe - spineFlex, 28, -71 + shoulderDrive * 0.25)
  ctx.stroke()
  // belly shade
  ctx.fillStyle = coat.dark
  ctx.beginPath()
  ctx.ellipse(-2, -40 + breathe + landing, 34, 7, 0.05, 0, Math.PI)
  ctx.fill()

  // Shoulder and haunch volumes make the body read as a thoroughbred rather
  // than a single capsule, especially when projected on a large screen.
  ctx.globalAlpha = 0.28
  ctx.fillStyle = coat.light
  ctx.beginPath()
  ctx.ellipse(29 + shoulderDrive * 0.35, -57 + landing * 0.5, 13.5, 19.5, -0.18, 0, TWO_PI)
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(-35 + haunchDrive * 0.35, -59 + landing * 0.3, 16.5, 18.5, 0.22, 0, TWO_PI)
  ctx.fill()
  ctx.globalAlpha = 1

  // A few restrained anatomy lines keep the flat illustration readable at TV
  // distance without turning the horse into a shaded sprite.
  ctx.strokeStyle = 'rgba(38,24,17,0.26)'
  ctx.lineWidth = 1.7
  ctx.beginPath()
  ctx.arc(28 + shoulderDrive * 0.35, -57 + landing * 0.5, 12, -1.3, 1.35)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(-34 + haunchDrive * 0.35, -59 + landing * 0.3, 14, -2.1, 0.75)
  ctx.stroke()

  // ── Neck + head ──
  const stretch = speedNorm * 0.85 + fall * -0.3
  // The neck counterbalances the trunk: it reaches on landing and recoils
  // during suspension, rather than nodding independently like a pendulum.
  const headBobA = idle
    ? Math.sin(time * 1.1) * 3
    : landing * 5.2 - suspension * 3.8 + Math.sin(TWO_PI * phase + 0.45) * 1.8 * speedNorm
  const headX = 62 + stretch * 12 + landing * 3.2 - suspension * 1.8
  const headY = -100 + stretch * 14 + headBobA + fall * 26 + shoulderDrive * 0.35
  ctx.fillStyle = coat.body
  ctx.beginPath()
  ctx.moveTo(17, -72 - spineFlex * 0.35)
  ctx.bezierCurveTo(31, -82, headX - 23, headY - 2, headX - 8, headY + 1)
  ctx.lineTo(headX + 1, headY + 16)
  ctx.bezierCurveTo(48, -61, 39, -47, 25, -45)
  ctx.bezierCurveTo(28, -55, 25, -63, 17, -72)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = coat.dark
  ctx.lineWidth = 2
  ctx.stroke()
  // head
  ctx.beginPath()
  ctx.ellipse(headX + 1, headY + 1, 15, 12, 0.18, 0, TWO_PI)
  ctx.fill()
  ctx.strokeStyle = coat.dark
  ctx.lineWidth = 1.8
  ctx.stroke()
  // muzzle
  ctx.beginPath()
  ctx.moveTo(headX + 8, headY - 6)
  ctx.quadraticCurveTo(headX + 21, headY - 1, headX + 29, headY + 4 + stretch * 2)
  ctx.quadraticCurveTo(headX + 28, headY + 12, headX + 21, headY + 13 + stretch * 2)
  ctx.lineTo(headX + 3, headY + 9)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = coat.dark
  ctx.beginPath()
  ctx.ellipse(headX + 25, headY + 8 + stretch * 2, 5.4, 3.8, 0.24, 0, TWO_PI)
  ctx.fill()
  ctx.fillStyle = '#100B08'
  ctx.beginPath()
  ctx.arc(headX + 28, headY + 6 + stretch * 2, 1.25, 0, TWO_PI)
  ctx.fill()
  // ears
  ctx.fillStyle = coat.body
  ctx.beginPath()
  ctx.moveTo(headX - 6, headY - 8)
  ctx.lineTo(headX - 10, headY - 20)
  ctx.lineTo(headX - 1, headY - 11)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = coat.dark
  ctx.lineWidth = 1.3
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(headX + 1, headY - 9)
  ctx.lineTo(headX + 1, headY - 19)
  ctx.lineTo(headX + 8, headY - 9)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  // eye
  ctx.fillStyle = '#160F0A'
  ctx.beginPath()
  ctx.arc(headX + 2, headY - 2, 2.1, 0, TWO_PI)
  ctx.fill()
  ctx.fillStyle = '#F4E8CE'
  ctx.beginPath()
  ctx.arc(headX + 2.6, headY - 2.7, 0.65, 0, TWO_PI)
  ctx.fill()

  // Jaw, cheek and bridle give the face a recognisable horse profile even
  // when several runners overlap on screen.
  ctx.strokeStyle = 'rgba(37,23,16,0.45)'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.arc(headX - 1, headY + 4, 7.5, -0.6, 1.45)
  ctx.stroke()
  ctx.strokeStyle = o.silk
  ctx.lineWidth = 1.8
  ctx.beginPath()
  ctx.moveTo(headX - 5, headY - 8)
  ctx.quadraticCurveTo(headX + 7, headY + 1, headX + 24, headY + 6)
  ctx.moveTo(headX + 8, headY - 7)
  ctx.lineTo(headX + 5, headY + 11)
  ctx.stroke()

  // ── Mane ──
  ctx.strokeStyle = coat.mane
  for (let i = 0; i < 3; i++) {
    const wave = idle
      ? Math.sin(time * 1.6 + i) * 3
      : Math.sin(TWO_PI * phase + i * 0.8) * (3 + speedNorm * 4) + suspension * (4 - i)
    ctx.lineWidth = 5 - i * 1.2
    ctx.beginPath()
    ctx.moveTo(24 + i * 10, -72 + i * -4)
    ctx.quadraticCurveTo(14 + i * 10 - speedNorm * 8, -84 + wave - i * 4, 2 + i * 10 - speedNorm * 14, -78 + wave - i * 2)
    ctx.stroke()
  }

  // ── Saddle blanket + number ──
  ctx.fillStyle = o.silk
  ctx.strokeStyle = '#F4E8CE'
  ctx.lineWidth = 2.5
  ctx.beginPath()
  ctx.roundRect(-22, -70, 34, 24, 4)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = '#FFFFFF'
  ctx.font = 'bold 19px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(String(o.number), -5, -57)

  // ── Jockey (thrown clear of the fall) ──
  if (fall < 0.6 && jockeyFall < 1) {
    ctx.save()
    ctx.globalAlpha = (fall > 0 ? 1 - fall / 0.6 : 1) * (1 - jockeyFall)
    // The jockey rises out of the saddle in suspension, sits into the landing
    const jBob = -bob * 0.42 + landing * 1.5 - suspension * 1.8 + (idle ? Math.sin(time * 2.1) : 0)
    ctx.translate(-2 - suspension * 0.8 - jockeyFall * 70, -76 + jBob + jockeyFall * 62)
    ctx.rotate((landing - suspension) * 0.018 - jockeyFall * 1.8)
    // Whip: every ~3s at full gallop, a quick flourish behind the saddle
    const whipCycle = ((time + o.number * 0.7) % 3.1) / 3.1
    const whipping = speedNorm > 0.55 && whipCycle < 0.22
    const whipSwing = whipping ? Math.sin((whipCycle / 0.22) * Math.PI) : 0
    // rear leg
    ctx.strokeStyle = '#2B2118'
    ctx.lineWidth = 6.5
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(0, -4)
    ctx.quadraticCurveTo(12, 4, 10, 16)
    ctx.stroke()
    // torso (crouched forward)
    ctx.strokeStyle = o.silk
    ctx.lineWidth = 11
    ctx.beginPath()
    ctx.moveTo(-2, -2)
    ctx.quadraticCurveTo(6, -18, 20, -24)
    ctx.stroke()
    // arm: on the reins, or swinging the whip during the flourish
    ctx.lineWidth = 5.5
    if (whipSwing > 0.15) {
      const wx = 8 - whipSwing * 14
      const wy = -26 - whipSwing * 8
      ctx.beginPath()
      ctx.moveTo(16, -22)
      ctx.quadraticCurveTo(12, -26, wx, wy)
      ctx.stroke()
      // the whip itself
      ctx.strokeStyle = '#241812'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(wx, wy)
      ctx.lineTo(wx - 14 - whipSwing * 8, wy - 10 + whipSwing * 16)
      ctx.stroke()
      ctx.strokeStyle = o.silk
    } else {
      ctx.beginPath()
      ctx.moveTo(16, -22)
      ctx.quadraticCurveTo(30, -18, 42, -16)
      ctx.stroke()
      // rein line
      ctx.strokeStyle = 'rgba(36,24,18,0.85)'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(42, -16)
      ctx.lineTo(headX - 2, headY + 8 - (-76 + jBob))
      ctx.stroke()
    }
    // head + cap
    ctx.fillStyle = '#E8C49A'
    ctx.beginPath()
    ctx.arc(26, -30, 6.5, 0, TWO_PI)
    ctx.fill()
    ctx.fillStyle = o.silk
    ctx.beginPath()
    ctx.arc(26, -32, 6.8, Math.PI * 0.95, Math.PI * 2.05)
    ctx.fill()
    ctx.fillStyle = '#FFFFFF'
    ctx.beginPath()
    ctx.arc(26, -37, 2.2, 0, TWO_PI)
    ctx.fill()
    ctx.restore()
  }

  // ── Near lower legs ──
  if (fall > 0) {
    for (const leg of GALLOP_LIMBS) {
      if (leg.far) continue
      const front = leg.kind === 'fore'
      const anchor = front ? { x: 32, y: -50 } : { x: -32, y: -52 }
      const splay = front ? 1.05 : -0.9
      limb(ctx, anchor.x, anchor.y, splay * fall, splay * fall * 0.5, 27, 27, 10, coat.body, hoofColor)
    }
  } else {
    for (const state of legStates) {
      if (state.leg.far) continue
      drawAnimatedLeg(ctx, state.pose, 8.2, coat.body, hoofColor, false, 'distal')
    }
  }

  if (o.debugHind && fall === 0) {
    for (const state of legStates) {
      if (state.leg.kind !== 'hind') continue
      drawHindDebug(ctx, state.pose, state.leg.far, state.contact)
    }
  }

  // ── Dizzy stars after elimination ──
  if (o.dizzy && fall >= 0.99) {
    const cx = headX
    const cy = headY - 30
    for (let i = 0; i < 3; i++) {
      const a = time * 2.4 + (i * TWO_PI) / 3
      const sx = cx + Math.cos(a) * 22
      const sy = cy + Math.sin(a) * 8 - 4
      ctx.save()
      ctx.translate(sx, sy)
      ctx.rotate(time * 3 + i)
      ctx.fillStyle = '#F2C879'
      star(ctx, 6)
      ctx.restore()
    }
  }

  ctx.restore()
}

export interface AlternateRunnerOpts {
  silk: string
  number: number
  phase: number
  speedNorm: number
  time: number
  fall: number
  jockeyFall: number
  golden: boolean
}

/** A deliberately readable, side-view racing camel for the rare 1/25 roll. */
export function drawCamel(ctx: CanvasRenderingContext2D, o: AlternateRunnerOpts) {
  const cycle = o.phase * TWO_PI
  const body = o.golden ? '#D9A943' : '#B9854D'
  const dark = o.golden ? '#8C651D' : '#76502F'
  const bob = Math.sin(cycle * 2) * 2.5 * o.speedNorm

  ctx.save()
  ctx.translate(0, bob + o.fall * 14)
  ctx.rotate(-o.fall * 0.48)
  ctx.fillStyle = 'rgba(20,10,4,0.28)'
  ctx.beginPath()
  ctx.ellipse(0, -1, 76, 10, 0, 0, TWO_PI)
  ctx.fill()

  // Long, loose camel legs with alternating pace gait.
  for (let i = 0; i < 4; i++) {
    const x = i < 2 ? 31 : -31
    const swing = o.fall ? (i < 2 ? 0.8 : -0.8) : Math.sin(cycle + (i % 2) * Math.PI) * 0.45 * o.speedNorm
    limb(ctx, x + (i % 2) * 8 - 4, -43, swing, -swing * 0.45, 31, 28, 7, i % 2 ? dark : body, '#2B2118')
  }

  ctx.fillStyle = body
  ctx.strokeStyle = dark
  ctx.lineWidth = 2.4
  ctx.beginPath()
  ctx.moveTo(-53, -48)
  ctx.bezierCurveTo(-50, -77, -28, -92, -10, -65)
  ctx.bezierCurveTo(2, -98, 30, -96, 39, -62)
  ctx.bezierCurveTo(54, -57, 55, -38, 38, -34)
  ctx.lineTo(-39, -34)
  ctx.bezierCurveTo(-55, -35, -61, -42, -53, -48)
  ctx.fill()
  ctx.stroke()

  // Neck and unmistakable camel head.
  ctx.beginPath()
  ctx.moveTo(31, -57)
  ctx.bezierCurveTo(46, -71, 45, -101, 58, -118)
  ctx.lineTo(72, -111)
  ctx.bezierCurveTo(58, -87, 65, -52, 42, -38)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  ctx.beginPath()
  ctx.ellipse(70, -118, 19, 11, 0.1, 0, TWO_PI)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = '#160F0A'
  ctx.beginPath()
  ctx.arc(76, -121, 2, 0, TWO_PI)
  ctx.fill()

  ctx.fillStyle = o.silk
  ctx.beginPath()
  ctx.roundRect(-24, -70, 43, 25, 4)
  ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.font = 'bold 18px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(String(o.number), -3, -57)
  drawAlternateRider(ctx, o, -4, -79)
  ctx.restore()
}

/** Motocross replacement for the 1/30 roll, including spinning wheels. */
export function drawMotorcycle(ctx: CanvasRenderingContext2D, o: AlternateRunnerOpts) {
  const body = o.golden ? '#D9A943' : o.silk
  ctx.save()
  ctx.translate(0, o.fall * 15)
  ctx.rotate(-o.fall * 0.62)
  const wheelSpin = o.phase * TWO_PI * 2
  for (const x of [-45, 45]) {
    ctx.fillStyle = '#171717'
    ctx.beginPath()
    ctx.arc(x, -18, 22, 0, TWO_PI)
    ctx.fill()
    ctx.strokeStyle = '#B9B7AE'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(x, -18, 14, 0, TWO_PI)
    ctx.stroke()
    for (let i = 0; i < 5; i++) {
      const angle = wheelSpin + (i * TWO_PI) / 5
      ctx.beginPath()
      ctx.moveTo(x, -18)
      ctx.lineTo(x + Math.cos(angle) * 12, -18 + Math.sin(angle) * 12)
      ctx.stroke()
    }
  }
  ctx.strokeStyle = body
  ctx.lineWidth = 9
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(-45, -18)
  ctx.lineTo(-10, -48)
  ctx.lineTo(29, -24)
  ctx.lineTo(45, -18)
  ctx.moveTo(-10, -48)
  ctx.lineTo(12, -18)
  ctx.stroke()
  ctx.fillStyle = body
  ctx.beginPath()
  ctx.roundRect(-20, -58, 45, 22, 7)
  ctx.fill()
  ctx.fillStyle = '#F4E8CE'
  ctx.font = 'bold 17px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(String(o.number), 2, -47)
  ctx.strokeStyle = '#E8E0CC'
  ctx.lineWidth = 5
  ctx.beginPath()
  ctx.moveTo(30, -27)
  ctx.lineTo(37, -68)
  ctx.lineTo(50, -72)
  ctx.stroke()
  drawAlternateRider(ctx, o, -4, -69)
  ctx.restore()
}

function drawAlternateRider(ctx: CanvasRenderingContext2D, o: AlternateRunnerOpts, x: number, y: number) {
  if (o.jockeyFall >= 1) return
  ctx.save()
  ctx.globalAlpha = 1 - o.jockeyFall
  ctx.translate(x - o.jockeyFall * 68, y + o.jockeyFall * 60)
  ctx.rotate(-0.45 - o.jockeyFall * 1.5)
  ctx.strokeStyle = o.silk
  ctx.lineWidth = 11
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(24, -20)
  ctx.stroke()
  ctx.strokeStyle = '#2B2118'
  ctx.lineWidth = 6
  ctx.beginPath()
  ctx.moveTo(1, 2)
  ctx.lineTo(17, 17)
  ctx.stroke()
  ctx.fillStyle = '#E8C49A'
  ctx.beginPath()
  ctx.arc(29, -25, 7, 0, TWO_PI)
  ctx.fill()
  ctx.fillStyle = o.silk
  ctx.beginPath()
  ctx.arc(29, -28, 7.4, Math.PI, TWO_PI)
  ctx.fill()
  ctx.restore()
}

function star(ctx: CanvasRenderingContext2D, r: number) {
  ctx.beginPath()
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.45
    const a = (i * Math.PI) / 5 - Math.PI / 2
    if (i === 0) ctx.moveTo(Math.cos(a) * rad, Math.sin(a) * rad)
    else ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad)
  }
  ctx.closePath()
  ctx.fill()
}
