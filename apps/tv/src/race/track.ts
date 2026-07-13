// Dirt track: surface texture, distance markers, start gate and finish line.

import { SCENERY, TRACK, WORLD, mulberry32 } from './palette'

interface Speckle {
  x: number // world x
  yFrac: number // 0 (far edge) .. 1 (near edge)
  len: number
  light: boolean
}

export class Track {
  private speckles: Speckle[] = []
  // The accelerated ground camera travels roughly twice as far as the real
  // race camera. Repeating this seeded strip keeps the dirt texture present
  // through the finish and the winner's overrun without visible regeneration.
  private readonly texturePeriod = WORLD.FINISH_X + 2400

  constructor(seed: number) {
    const rand = mulberry32(seed)
    for (let i = 0; i < 2600; i++) {
      this.speckles.push({
        x: rand() * this.texturePeriod,
        yFrac: rand(),
        len: 10 + rand() * 46,
        light: rand() > 0.5,
      })
    }
  }

  private trackY(yFrac: number, H: number): number {
    return H * (TRACK.FAR_EDGE + yFrac * (TRACK.NEAR_EDGE - TRACK.FAR_EDGE))
  }

  drawSurface(ctx: CanvasRenderingContext2D, W: number, H: number, camX: number, speedIntensity = 0) {
    const top = H * TRACK.FAR_EDGE
    const bottom = H * TRACK.NEAR_EDGE
    const g = ctx.createLinearGradient(0, top, 0, bottom)
    g.addColorStop(0, SCENERY.dirtFar)
    g.addColorStop(1, SCENERY.dirtNear)
    ctx.fillStyle = g
    ctx.fillRect(0, top, W, H - top)

    // Seeded texture strip repeated in world-space. Previously this was a
    // single finite strip: `groundCam` outran it in the home straight and the
    // road abruptly became a flat gradient.
    const left = camX - W / 2 - 60
    const right = camX + W / 2 + 60
    ctx.lineWidth = Math.max(1, H / 720)
    const firstTile = Math.floor(left / this.texturePeriod)
    const lastTile = Math.floor(right / this.texturePeriod)
    for (let tile = firstTile; tile <= lastTile; tile++) {
      const tileOffset = tile * this.texturePeriod
      for (const s of this.speckles) {
        const worldX = s.x + tileOffset
        if (worldX < left || worldX > right) continue
        const sx = worldX - camX + W / 2
        const sy = this.trackY(s.yFrac, H)
        const scale = 0.6 + s.yFrac * 0.8
        const nearRush = speedIntensity * (0.35 + s.yFrac * 1.25)
        const streak = 1 + nearRush * 2.1
        const alpha = Math.min(0.34, (s.light ? 0.16 : 0.18) + nearRush * 0.055)
        ctx.strokeStyle = s.light ? `rgba(232,200,160,${alpha})` : `rgba(70,40,20,${alpha})`
        ctx.lineWidth = Math.max(1, H / 720) * (1 + nearRush * 0.45)
        ctx.beginPath()
        ctx.moveTo(sx, sy)
        ctx.lineTo(sx + s.len * scale * streak, sy)
        ctx.stroke()
      }
    }
  }

  /** Distance posts on the far rail + painted track lines every 10 units. */
  drawMarkers(ctx: CanvasRenderingContext2D, W: number, H: number, camX: number) {
    const S = H / 1080
    const railY = H * TRACK.FAR_EDGE
    for (let u = 10; u < 100; u += 10) {
      const wx = WORLD.START_X + u * WORLD.PX_PER_UNIT
      const sx = wx - camX + W / 2
      if (sx < -120 || sx > W + 120) continue
      // faint painted line across the dirt
      ctx.strokeStyle = 'rgba(244,232,206,0.13)'
      ctx.lineWidth = 4 * S
      ctx.beginPath()
      ctx.moveTo(sx, railY + 6 * S)
      ctx.lineTo(sx - 26 * S, H * TRACK.NEAR_EDGE)
      ctx.stroke()
      // marker post + sign
      ctx.fillStyle = '#F4E8CE'
      ctx.fillRect(sx - 3 * S, railY - 66 * S, 6 * S, 40 * S)
      ctx.fillStyle = '#C63C2E'
      ctx.beginPath()
      ctx.roundRect(sx - 34 * S, railY - 98 * S, 68 * S, 34 * S, 5 * S)
      ctx.fill()
      ctx.fillStyle = '#F4E8CE'
      ctx.font = `bold ${21 * S}px Georgia, serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(`${(100 - u) * 10}m`, sx, railY - 81 * S)
    }
  }

  drawStartGate(ctx: CanvasRenderingContext2D, W: number, H: number, camX: number) {
    const S = H / 1080
    const sx = WORLD.START_X - camX + W / 2
    if (sx < -260 || sx > W + 260) return
    const topY = H * (TRACK.HORIZON + 0.03)
    const botY = H * TRACK.NEAR_EDGE
    ctx.fillStyle = '#4A3018'
    ctx.fillRect(sx - 10 * S, topY, 14 * S, botY - topY)
    ctx.fillStyle = '#D9A943'
    ctx.beginPath()
    ctx.roundRect(sx - 92 * S, topY - 44 * S, 184 * S, 44 * S, 6 * S)
    ctx.fill()
    ctx.fillStyle = '#241A0F'
    ctx.font = `bold ${26 * S}px Georgia, serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('DÉPART', sx, topY - 22 * S)
    // painted start line
    ctx.fillStyle = 'rgba(244,232,206,0.5)'
    ctx.fillRect(sx - 2 * S, H * TRACK.FAR_EDGE, 5 * S, botY - H * TRACK.FAR_EDGE)
  }

  drawFinish(ctx: CanvasRenderingContext2D, W: number, H: number, camX: number, time: number) {
    const S = H / 1080
    const sx = WORLD.FINISH_X - camX + W / 2
    if (sx < -400 || sx > W + 400) return
    const farY = H * TRACK.FAR_EDGE
    const nearY = H * TRACK.NEAR_EDGE

    // checkered strip painted on the dirt
    const sq = 12 * S
    for (let row = 0; farY + row * sq < nearY; row++) {
      for (let col = 0; col < 3; col++) {
        ctx.fillStyle = (row + col) % 2 === 0 ? 'rgba(244,232,206,0.85)' : 'rgba(24,16,10,0.8)'
        const skew = -(row * sq) * 0.28
        ctx.fillRect(sx + col * sq + skew, farY + row * sq, sq, Math.min(sq, nearY - (farY + row * sq)))
      }
    }

    // poles
    ctx.fillStyle = '#E8E0CC'
    ctx.fillRect(sx - 6 * S, H * (TRACK.HORIZON + 0.01), 9 * S, farY - H * (TRACK.HORIZON + 0.01) + 8 * S)
    ctx.fillRect(sx + 30 * S, nearY - 8 * S, 10 * S, 8 * S) // near pole stub below banner

    // banner
    const bannerY = H * (TRACK.HORIZON - 0.015)
    const wave = Math.sin(time * 2.2) * 3 * S
    ctx.fillStyle = '#C63C2E'
    ctx.beginPath()
    ctx.roundRect(sx - 118 * S, bannerY - 40 * S + wave, 236 * S, 44 * S, 8 * S)
    ctx.fill()
    ctx.strokeStyle = '#D9A943'
    ctx.lineWidth = 3 * S
    ctx.stroke()
    ctx.fillStyle = '#F4E8CE'
    ctx.font = `bold ${27 * S}px Georgia, serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('ARRIVÉE', sx, bannerY - 18 * S + wave)
  }
}
