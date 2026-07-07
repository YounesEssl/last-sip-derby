// Procedural side-view racehorse + jockey, drawn with canvas primitives.
// Local space: origin on the ground under the body center, +x forward,
// -y up. Nominal size: ~130px long, ~110px tall with jockey (scaled by caller).

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
}

const TWO_PI = Math.PI * 2

// Rotary gallop leg timing offsets
const LEGS = [
  { off: 0.0, front: false, far: true },
  { off: 0.12, front: false, far: false },
  { off: 0.48, front: true, far: true },
  { off: 0.6, front: true, far: false },
]

/** Ground-contact intensity per near hoof (used to spawn dust). */
export function hoofContact(phase: number): number {
  let c = 0
  for (const leg of LEGS) {
    if (leg.far) continue
    c = Math.max(c, Math.pow(Math.max(0, -Math.sin(TWO_PI * (phase + leg.off))), 4))
  }
  return c
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
  // hoof
  ctx.fillStyle = hoofColor
  ctx.beginPath()
  ctx.ellipse(x2, y2 + 1, w * 0.5, w * 0.36, 0, 0, TWO_PI)
  ctx.fill()
}

function legAngles(cycle: number, front: boolean): { a1: number; a2: number } {
  const s = Math.sin(TWO_PI * cycle)
  if (front) {
    const a1 = 0.18 + s * 0.72
    const fold = 0.25 + Math.max(0, Math.sin(TWO_PI * cycle + 2.0)) * 1.05
    return { a1, a2: a1 + fold * 0.9 * (s > 0 ? 0.55 : 1) }
  }
  const a1 = -0.14 + s * 0.6
  const fold = 0.2 + Math.max(0, Math.sin(TWO_PI * cycle + 1.6)) * 0.95
  return { a1, a2: a1 - fold * 0.35 + fold * 0.9 }
}

export function drawHorse(ctx: CanvasRenderingContext2D, o: HorseRenderOpts) {
  const { coat, phase, speedNorm, time, fall } = o
  const idle = speedNorm < 0.06 && fall === 0

  ctx.save()

  // ── Whole-body motion ──
  // Asymmetric stride: hard landing around cycle 0.05, floaty airborne
  // suspension around 0.6 (first + second harmonic), classic gallop feel.
  const bob =
    (-Math.sin(TWO_PI * phase + 0.3) * 6.5 - Math.sin(2 * TWO_PI * phase + 1.2) * 2.8) * speedNorm
  const pitch = Math.sin(TWO_PI * phase + 1.35) * 0.085 * speedNorm - fall * 0.52
  // Squash on landing, stretch in the air
  const sq = 1 + Math.sin(TWO_PI * phase + 2.1) * 0.045 * speedNorm
  const sink = fall * 16
  const breathe = idle ? Math.sin(time * 2.1) * 1.6 : 0

  // Shadow (before body transform)
  const shW = 74 - Math.abs(bob) * 1.6 - fall * 10
  ctx.fillStyle = 'rgba(20,10,4,0.28)'
  ctx.beginPath()
  ctx.ellipse(fall * -8, -2, shW, 11, 0, 0, TWO_PI)
  ctx.fill()

  ctx.translate(0, bob + sink + breathe * 0.4)
  ctx.rotate(-pitch)
  // stretch along the direction of travel, squash vertically (volume-ish)
  ctx.scale(sq, 2 - sq)

  const hoofColor = '#241812'

  // ── Far legs ──
  for (const leg of LEGS) {
    if (!leg.far) continue
    const anchor = leg.front ? { x: 30, y: -52 } : { x: -34, y: -54 }
    if (fall > 0) {
      const splay = leg.front ? 0.85 : -0.7
      limb(ctx, anchor.x, anchor.y, splay * fall, splay * fall * 0.6, 26, 26, 9, coat.dark, hoofColor)
    } else {
      const { a1, a2 } = legAngles((phase + leg.off) % 1, leg.front)
      limb(ctx, anchor.x, anchor.y, idle ? 0.05 : a1, idle ? 0.02 : a2, 26, 26, 9, coat.dark, hoofColor)
    }
  }

  // ── Tail ──
  const tailWave = idle ? Math.sin(time * 1.4) * 8 : Math.sin(TWO_PI * phase + 2) * 6
  const tailLift = 10 + speedNorm * 16
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
  ctx.moveTo(-46, -58) // rump back
  ctx.bezierCurveTo(-52, -74, -30, -80 - breathe, -8, -79 - breathe) // rump → back
  ctx.bezierCurveTo(10, -78 - breathe, 26, -74, 38, -66) // back → withers/chest top
  ctx.bezierCurveTo(48, -58, 46, -46, 36, -42) // chest front
  ctx.bezierCurveTo(20, -36 + breathe, -10, -36 + breathe, -28, -42) // belly
  ctx.bezierCurveTo(-44, -46, -50, -50, -46, -58)
  ctx.closePath()
  ctx.fill()
  // top highlight
  ctx.strokeStyle = coat.light
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(-34, -74)
  ctx.quadraticCurveTo(-6, -80 - breathe, 28, -71)
  ctx.stroke()
  // belly shade
  ctx.fillStyle = coat.dark
  ctx.beginPath()
  ctx.ellipse(-2, -40 + breathe, 34, 7, 0.05, 0, Math.PI)
  ctx.fill()

  // ── Neck + head ──
  const stretch = speedNorm * 0.85 + fall * -0.3
  // Head pumps with the stride: dives during the pull, rises in suspension
  const headBobA = idle
    ? Math.sin(time * 1.1) * 3
    : (Math.sin(TWO_PI * phase + 0.55) * 4.5 + Math.sin(2 * TWO_PI * phase + 1.8) * 1.6) * speedNorm
  const headX = 62 + stretch * 12
  const headY = -100 + stretch * 14 + headBobA + fall * 26
  ctx.fillStyle = coat.body
  ctx.beginPath()
  ctx.moveTo(18, -70)
  ctx.bezierCurveTo(30, -78, headX - 22, headY + 4, headX - 6, headY - 2)
  ctx.lineTo(headX + 2, headY + 12)
  ctx.bezierCurveTo(34, -56, 28, -52, 22, -52)
  ctx.closePath()
  ctx.fill()
  // head
  ctx.beginPath()
  ctx.ellipse(headX, headY, 12, 10.5, 0.25, 0, TWO_PI)
  ctx.fill()
  // muzzle
  ctx.beginPath()
  ctx.moveTo(headX + 6, headY - 7)
  ctx.lineTo(headX + 26, headY + 3 + stretch * 2)
  ctx.lineTo(headX + 24, headY + 10 + stretch * 2)
  ctx.lineTo(headX + 4, headY + 9)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = coat.dark
  ctx.beginPath()
  ctx.ellipse(headX + 22, headY + 6 + stretch * 2, 4.5, 3.5, 0.3, 0, TWO_PI)
  ctx.fill()
  // ears
  ctx.fillStyle = coat.body
  ctx.beginPath()
  ctx.moveTo(headX - 6, headY - 8)
  ctx.lineTo(headX - 10, headY - 20)
  ctx.lineTo(headX - 1, headY - 11)
  ctx.closePath()
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(headX + 1, headY - 9)
  ctx.lineTo(headX + 1, headY - 19)
  ctx.lineTo(headX + 8, headY - 9)
  ctx.closePath()
  ctx.fill()
  // eye
  ctx.fillStyle = '#160F0A'
  ctx.beginPath()
  ctx.arc(headX + 2, headY - 2, 2.1, 0, TWO_PI)
  ctx.fill()

  // ── Mane ──
  ctx.strokeStyle = coat.mane
  for (let i = 0; i < 3; i++) {
    const wave = idle ? Math.sin(time * 1.6 + i) * 3 : Math.sin(TWO_PI * phase + i * 0.8) * (3 + speedNorm * 4)
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
  if (fall < 0.6) {
    ctx.save()
    ctx.globalAlpha = fall > 0 ? 1 - fall / 0.6 : 1
    // The jockey rises out of the saddle in suspension, sits into the landing
    const jBob = -bob * 0.35 + (idle ? Math.sin(time * 2.1) * 1 : 0)
    ctx.translate(-2, -76 + jBob)
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

  // ── Near legs ──
  for (const leg of LEGS) {
    if (leg.far) continue
    const anchor = leg.front ? { x: 32, y: -50 } : { x: -32, y: -52 }
    if (fall > 0) {
      const splay = leg.front ? 1.05 : -0.9
      limb(ctx, anchor.x, anchor.y, splay * fall, splay * fall * 0.5, 27, 27, 10, coat.body, hoofColor)
    } else {
      const { a1, a2 } = legAngles((phase + leg.off) % 1, leg.front)
      limb(ctx, anchor.x, anchor.y, idle ? -0.04 : a1, idle ? -0.02 : a2, 27, 27, 10, coat.body, hoofColor)
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
