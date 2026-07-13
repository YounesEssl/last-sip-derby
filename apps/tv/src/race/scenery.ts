// Parallax background: dusk sky, sun, clouds, hills, tree line, grandstand
// with an animated crowd, joke billboards and rail fences.
// Convention: for a layer with parallax factor f, an element at layer-space
// x lands on screen at `x - camX * f + W / 2`.

import { SKY, SCENERY, SPONSORS, TRACK, mulberry32, WORLD } from './palette'

const CROWD_COLORS = ['#D9A943', '#C63C2E', '#F4E8CE', '#7A9E7E', '#B06A45', '#8C7BA6', '#5C7FA3', '#D98E6B']

interface Cloud {
  x: number
  y: number
  s: number
  drift: number
}

export class Scenery {
  private clouds: Cloud[] = []
  private crowdSeeds: number[] = []
  private sponsorOrder: string[] = []

  constructor(seed: number) {
    const rand = mulberry32(seed)
    for (let i = 0; i < 9; i++) {
      this.clouds.push({ x: rand() * 3000, y: 0.06 + rand() * 0.2, s: 0.7 + rand() * 1.1, drift: 4 + rand() * 7 })
    }
    for (let i = 0; i < 4096; i++) this.crowdSeeds.push(rand())
    const pool = [...SPONSORS]
    while (pool.length) this.sponsorOrder.push(pool.splice(Math.floor(rand() * pool.length), 1)[0])
  }

  drawSky(ctx: CanvasRenderingContext2D, W: number, H: number, camX: number, time: number) {
    const horizon = H * TRACK.HORIZON
    const g = ctx.createLinearGradient(0, 0, 0, horizon * 1.15)
    g.addColorStop(0, SKY.top)
    g.addColorStop(0.55, SKY.mid)
    g.addColorStop(0.85, SKY.low)
    g.addColorStop(1, SKY.horizon)
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, horizon * 1.15)

    // Sun, nearly fixed (tiny parallax so it feels alive)
    const sunX = W * 0.76 - camX * 0.012
    const sunY = H * 0.30
    const glow = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, H * 0.3)
    glow.addColorStop(0, 'rgba(255,236,190,0.9)')
    glow.addColorStop(0.25, 'rgba(255,210,130,0.35)')
    glow.addColorStop(1, 'rgba(255,210,130,0)')
    ctx.fillStyle = glow
    ctx.fillRect(sunX - H * 0.3, sunY - H * 0.3, H * 0.6, H * 0.6)
    ctx.fillStyle = '#FFEDC2'
    ctx.beginPath()
    ctx.arc(sunX, sunY, H * 0.045, 0, Math.PI * 2)
    ctx.fill()

    // Clouds
    ctx.fillStyle = 'rgba(244,232,206,0.5)'
    const period = 3000
    for (const c of this.clouds) {
      let x = ((c.x + time * c.drift - camX * 0.05) % period + period) % period
      x = x / period * (W + 600) - 300
      const y = H * c.y
      const s = c.s * (H / 1080)
      ctx.beginPath()
      ctx.ellipse(x, y, 90 * s, 22 * s, 0, 0, Math.PI * 2)
      ctx.ellipse(x + 55 * s, y - 14 * s, 55 * s, 18 * s, 0, 0, Math.PI * 2)
      ctx.ellipse(x - 60 * s, y - 8 * s, 48 * s, 15 * s, 0, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  drawHills(ctx: CanvasRenderingContext2D, W: number, H: number, camX: number) {
    const horizon = H * TRACK.HORIZON
    // Far ridge
    this.ridge(ctx, W, horizon, camX * 0.1, 620, H * 0.085, SCENERY.hillFar, 17)
    // Near ridge
    this.ridge(ctx, W, horizon * 1.02, camX * 0.17, 430, H * 0.06, SCENERY.hillNear, 5)
  }

  private ridge(
    ctx: CanvasRenderingContext2D,
    W: number,
    baseY: number,
    off: number,
    period: number,
    amp: number,
    color: string,
    phase: number,
  ) {
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.moveTo(0, baseY + 4)
    for (let x = 0; x <= W + 20; x += 20) {
      const w = x + off
      const y = baseY - amp * (0.6 + 0.4 * Math.sin(w / period * Math.PI * 2 + phase)) * (0.7 + 0.3 * Math.sin(w / (period * 0.37) + phase * 2))
      ctx.lineTo(x, y)
    }
    ctx.lineTo(W + 20, baseY + 60)
    ctx.lineTo(0, baseY + 60)
    ctx.closePath()
    ctx.fill()
  }

  drawTreeLine(ctx: CanvasRenderingContext2D, W: number, H: number, camX: number) {
    const baseY = H * (TRACK.HORIZON + 0.015)
    const f = 0.28
    const spacing = 150
    const first = Math.floor((camX * f - W / 2) / spacing) - 1
    const count = Math.ceil(W / spacing) + 3
    ctx.fillStyle = SCENERY.treeDark
    for (let i = first; i < first + count; i++) {
      const x = i * spacing - camX * f + W / 2
      const h = H * (0.05 + ((i % 5) + 2) * 0.007)
      const w = h * 0.34
      // poplar silhouette
      ctx.beginPath()
      ctx.ellipse(x, baseY - h / 2, w, h / 2, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillRect(x - 1.5, baseY - 6, 3, 6)
    }
  }

  drawGrass(ctx: CanvasRenderingContext2D, W: number, H: number, camX: number) {
    const top = H * TRACK.HORIZON
    const bottom = H * TRACK.FAR_EDGE
    const g = ctx.createLinearGradient(0, top, 0, bottom)
    g.addColorStop(0, SCENERY.grassDark)
    g.addColorStop(1, SCENERY.grass)
    ctx.fillStyle = g
    ctx.fillRect(0, top, W, bottom - top)
    // mowing stripes
    ctx.fillStyle = 'rgba(255,255,255,0.045)'
    const f = 0.7
    const stripeW = 130
    const first = Math.floor((camX * f - W / 2) / (stripeW * 2)) - 1
    for (let i = first; i < first + Math.ceil(W / (stripeW * 2)) + 2; i++) {
      const x = i * stripeW * 2 - camX * f + W / 2
      ctx.fillRect(x, top, stripeW, bottom - top)
    }
  }

  /**
   * Grandstand strip with animated crowd. `excitement` 0..1 drives how much
   * the crowd jumps; during the last stretch they go wild.
   */
  drawGrandstand(ctx: CanvasRenderingContext2D, W: number, H: number, camX: number, time: number, excitement: number) {
    const f = 0.42
    const S = H / 1080
    const period = 1750 * S
    const standW = 1150 * S
    const baseY = H * (TRACK.HORIZON + 0.052)
    const standH = H * 0.14

    const first = Math.floor((camX * f - W / 2) / period) - 1
    const count = Math.ceil(W / period) + 2

    for (let i = first; i < first + count; i++) {
      const x = i * period - camX * f + W / 2
      if (x > W + standW || x + standW < -period) continue
      this.stand(ctx, x, baseY, standW, standH, S, time, excitement, i)
      // Billboard in the gap
      const bbX = x + standW + 90 * S
      const bbW = period - standW - 180 * S
      this.billboard(ctx, bbX, baseY, bbW, standH * 0.52, S, i)
    }
  }

  private stand(
    ctx: CanvasRenderingContext2D,
    x: number,
    baseY: number,
    w: number,
    h: number,
    S: number,
    time: number,
    excitement: number,
    index: number,
  ) {
    // structure
    ctx.fillStyle = SCENERY.standWood
    ctx.fillRect(x, baseY - h, w, h)
    // stepped rows of crowd
    const rows = 4
    const seeds = this.crowdSeeds
    for (let r = 0; r < rows; r++) {
      const rowY = baseY - h * 0.16 - r * (h * 0.19)
      ctx.fillStyle = `rgba(14,10,6,${0.25 + r * 0.05})`
      ctx.fillRect(x, rowY + 6 * S, w, h * 0.13)
      const step = 26 * S
      const n = Math.floor(w / step)
      for (let c = 0; c < n; c++) {
        const si = (Math.abs(index * 131) + r * 97 + c) % (seeds.length - 3)
        const s1 = seeds[si]
        const s2 = seeds[si + 1]
        const jump =
          Math.max(0, Math.sin(time * (3 + s1 * 4) + s2 * 40)) *
          (2 + excitement * 9) *
          (0.4 + s1 * 0.6) *
          S
        const px = x + c * step + s2 * 8 * S
        const py = rowY - jump
        ctx.fillStyle = CROWD_COLORS[si % CROWD_COLORS.length]
        // head
        ctx.beginPath()
        ctx.arc(px, py - 8 * S, 4.4 * S, 0, Math.PI * 2)
        ctx.fill()
        // body
        ctx.fillRect(px - 4 * S, py - 4.5 * S, 8 * S, 9 * S)
        // waving arm when excited
        if (excitement > 0.35 && s1 > 0.55) {
          ctx.strokeStyle = CROWD_COLORS[si % CROWD_COLORS.length]
          ctx.lineWidth = 2.4 * S
          ctx.beginPath()
          ctx.moveTo(px + 3 * S, py - 4 * S)
          ctx.lineTo(px + 8 * S, py - 14 * S - jump * 0.5)
          ctx.stroke()
        }
      }
    }
    // roof
    ctx.fillStyle = SCENERY.standRoof
    ctx.beginPath()
    ctx.moveTo(x - 24 * S, baseY - h)
    ctx.lineTo(x + w + 24 * S, baseY - h)
    ctx.lineTo(x + w + 4 * S, baseY - h - 26 * S)
    ctx.lineTo(x - 4 * S, baseY - h - 26 * S)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = '#D9A943'
    ctx.fillRect(x - 24 * S, baseY - h, w + 48 * S, 4 * S)
    // bunting garland under the roof
    const flags = Math.floor(w / (34 * S))
    for (let fl = 0; fl < flags; fl++) {
      const fx = x + fl * 34 * S + 10 * S
      const sag = Math.sin((fl / flags) * Math.PI) * 8 * S
      ctx.fillStyle = fl % 3 === 0 ? '#C63C2E' : fl % 3 === 1 ? '#D9A943' : '#F4E8CE'
      ctx.beginPath()
      ctx.moveTo(fx, baseY - h + 6 * S + sag)
      ctx.lineTo(fx + 14 * S, baseY - h + 6 * S + sag)
      ctx.lineTo(fx + 7 * S, baseY - h + 20 * S + sag)
      ctx.closePath()
      ctx.fill()
    }
  }

  private billboard(ctx: CanvasRenderingContext2D, x: number, baseY: number, w: number, h: number, S: number, index: number) {
    if (w < 120 * S) return
    // Track sections get a stable slot instead of wrapping with modulo: a
    // slogan can therefore never reappear later in the same race.
    const text = this.sponsorOrder[index + 1]
    if (!text) return
    const y = baseY - h - 20 * S
    // legs
    ctx.fillStyle = '#2B2118'
    ctx.fillRect(x + 10 * S, y + h, 6 * S, 20 * S)
    ctx.fillRect(x + w - 16 * S, y + h, 6 * S, 20 * S)
    // panel
    ctx.fillStyle = '#F4E8CE'
    ctx.strokeStyle = '#9C7427'
    ctx.lineWidth = 3 * S
    ctx.fillRect(x, y, w, h)
    ctx.strokeRect(x, y, w, h)
    ctx.fillStyle = '#4A3018'
    ctx.font = `bold ${Math.min(26 * S, (w / text.length) * 1.55)}px Georgia, serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, x + w / 2, y + h / 2)
  }

  /** White rail on the far side of the track (parallax 1 — track plane). */
  drawFarRail(ctx: CanvasRenderingContext2D, W: number, H: number, camX: number) {
    const y = H * TRACK.FAR_EDGE
    const S = H / 1080
    ctx.fillStyle = SCENERY.railWhite
    ctx.fillRect(0, y - 26 * S, W, 5 * S)
    ctx.fillRect(0, y - 14 * S, W, 5 * S)
    const spacing = 240
    const first = Math.floor((camX - W / 2) / spacing) - 1
    for (let i = first; i < first + Math.ceil(W / spacing) + 2; i++) {
      const x = i * spacing - camX + W / 2
      ctx.fillRect(x, y - 28 * S, 7 * S, 30 * S)
    }
    // rail shadow on grass
    ctx.fillStyle = 'rgba(14,10,6,0.18)'
    ctx.fillRect(0, y - 2 * S, W, 3 * S)
  }

  /** Foreground rail, faster than the track — the strongest speed cue. */
  drawNearRail(ctx: CanvasRenderingContext2D, W: number, H: number, camX: number) {
    const f = 1.24
    const y = H * 0.988
    const S = H / 1080
    ctx.fillStyle = 'rgba(232,224,204,0.92)'
    ctx.fillRect(0, y - 20 * S, W, 8 * S)
    const spacing = 230
    const first = Math.floor((camX * f - W / 2) / spacing) - 1
    for (let i = first; i < first + Math.ceil(W / spacing) + 2; i++) {
      const x = i * spacing - camX * f + W / 2
      ctx.fillStyle = 'rgba(210,200,178,0.92)'
      ctx.fillRect(x, y - 20 * S, 12 * S, 30 * S)
    }
  }
}
