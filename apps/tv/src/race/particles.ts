// Dust kicked up by hooves + confetti for the finish celebration.

interface Dust {
  x: number
  y: number
  vx: number
  vy: number
  r: number
  life: number
  maxLife: number
}

export class DustPool {
  private pool: Dust[] = []

  spawn(x: number, y: number, scale: number, intensity: number) {
    const n = Math.round(1 + intensity * 2)
    for (let i = 0; i < n; i++) {
      if (this.pool.length > 260) this.pool.shift()
      this.pool.push({
        x: x + (Math.random() - 0.5) * 10 * scale,
        y: y + (Math.random() - 0.5) * 4 * scale,
        vx: (-60 - Math.random() * 90) * scale * intensity,
        vy: (-25 - Math.random() * 45) * scale,
        r: (4 + Math.random() * 7) * scale,
        life: 0,
        maxLife: 0.45 + Math.random() * 0.5,
      })
    }
  }

  burst(x: number, y: number, scale: number) {
    for (let i = 0; i < 16; i++) {
      this.pool.push({
        x: x + (Math.random() - 0.5) * 40 * scale,
        y: y - Math.random() * 10 * scale,
        vx: (Math.random() - 0.5) * 260 * scale,
        vy: (-40 - Math.random() * 80) * scale,
        r: (7 + Math.random() * 12) * scale,
        life: 0,
        maxLife: 0.7 + Math.random() * 0.5,
      })
    }
  }

  update(dt: number) {
    for (let i = this.pool.length - 1; i >= 0; i--) {
      const d = this.pool[i]
      d.life += dt
      if (d.life > d.maxLife) {
        this.pool.splice(i, 1)
        continue
      }
      d.x += d.vx * dt
      d.y += d.vy * dt
      d.vx *= 1 - 2.4 * dt
      d.vy *= 1 - 2.4 * dt
      d.r += 26 * dt
    }
  }

  /** Draw in world space: caller passes the camera offset. */
  draw(ctx: CanvasRenderingContext2D, camX: number, W: number) {
    for (const d of this.pool) {
      const t = d.life / d.maxLife
      const alpha = 0.3 * (1 - t)
      ctx.fillStyle = `rgba(196,152,110,${alpha.toFixed(3)})`
      ctx.beginPath()
      ctx.arc(d.x - camX + W / 2, d.y, d.r, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

interface ConfettiPiece {
  x: number
  y: number
  vx: number
  vy: number
  w: number
  h: number
  rot: number
  vr: number
  wobble: number
  color: string
  life: number
}

const CONFETTI_COLORS = ['#D9A943', '#C63C2E', '#F4E8CE', '#1E5C43', '#9B5DE5', '#457B9D']

/** Screen-space confetti (drawn above everything). */
export class ConfettiPool {
  private pool: ConfettiPiece[] = []
  private rainUntil = 0
  private now = 0

  cannon(x: number, y: number, dir: number, H: number) {
    for (let i = 0; i < 70; i++) {
      const a = -Math.PI / 2 + dir * (0.2 + Math.random() * 0.5)
      const v = (0.45 + Math.random() * 0.6) * H
      this.pool.push(this.piece(x, y, Math.cos(a) * v, Math.sin(a) * v))
    }
  }

  startRain(seconds: number) {
    this.rainUntil = this.now + seconds
  }

  private piece(x: number, y: number, vx: number, vy: number): ConfettiPiece {
    return {
      x,
      y,
      vx,
      vy,
      w: 5 + Math.random() * 7,
      h: 8 + Math.random() * 8,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 12,
      wobble: Math.random() * Math.PI * 2,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      life: 0,
    }
  }

  update(dt: number, W: number, H: number) {
    this.now += dt
    if (this.now < this.rainUntil && this.pool.length < 500) {
      for (let i = 0; i < 4; i++) {
        this.pool.push(this.piece(Math.random() * W, -20, (Math.random() - 0.5) * 60, 40 + Math.random() * 120))
      }
    }
    const g = H * 0.55
    for (let i = this.pool.length - 1; i >= 0; i--) {
      const p = this.pool[i]
      p.life += dt
      p.vy += g * dt
      p.vy = Math.min(p.vy, H * 0.32)
      p.wobble += dt * 6
      p.x += p.vx * dt + Math.sin(p.wobble) * 40 * dt
      p.y += p.vy * dt
      p.rot += p.vr * dt
      p.vx *= 1 - 0.8 * dt
      if (p.y > H + 30 || p.life > 9) this.pool.splice(i, 1)
    }
  }

  draw(ctx: CanvasRenderingContext2D, S: number) {
    for (const p of this.pool) {
      ctx.save()
      ctx.translate(p.x, p.y)
      ctx.rotate(p.rot)
      ctx.scale(1, Math.abs(Math.sin(p.wobble * 0.8)) * 0.8 + 0.2) // flutter
      ctx.fillStyle = p.color
      ctx.fillRect((-p.w / 2) * S, (-p.h / 2) * S, p.w * S, p.h * S)
      ctx.restore()
    }
  }

  get count() {
    return this.pool.length
  }
}
