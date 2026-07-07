// The race renderer. Consumes 10 Hz GameState snapshots and renders a
// cinematic 60 fps broadcast: interpolated horses, camera following the
// head of the race, parallax scenery, dust, event spotlight, finish slow-mo.

import type { Horse } from '@last-sip-derby/shared'
import { HorseTracker } from './interpolator'
import { drawHorse, hoofContact, type Coat } from './horse'
import { Scenery } from './scenery'
import { Track } from './track'
import { DustPool, ConfettiPool } from './particles'
import { COATS, WORLD, laneGroundY, laneScale } from './palette'

interface HorseMeta {
  id: string
  name: string
  silk: string
  lane: number
  coat: Coat
  tracker: HorseTracker
  phase: number
  speedNorm: number
  effSpeed: number
  eliminated: boolean
  fallStart: number | null
  extraPos: number // visual overrun after the finish (victory lap)
  visX: number // last computed world x (for camera/spotlight)
}

interface Celebration {
  start: number
  winnerId: string | null
  cannonsFired: number
}

const LOOK_AHEAD = 190

export class RaceEngine {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private raf = 0
  private running = false
  private lastT = 0
  private simTime = 0
  private timeScale = 1

  private horses = new Map<string, HorseMeta>()
  private order: string[] = [] // stable lane order for drawing
  private raceProgress = 0
  private paused = false
  private spotlightId: string | null = null
  private celebration: Celebration | null = null

  private camX = WORLD.START_X + 300
  private zoom = 1

  // camera direction: punch zooms on the horse that takes the lead
  private lastLeaderId: string | null = null
  private punch: { until: number; horseId: string } | null = null
  private lastPunchAt = 0

  private scenery: Scenery
  private track: Track
  private dust = new DustPool()
  private confetti = new ConfettiPool()
  private resizeObs: ResizeObserver | null = null

  constructor(canvas: HTMLCanvasElement, seed: number) {
    this.canvas = canvas
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('no 2d context')
    this.ctx = ctx
    this.scenery = new Scenery(seed)
    this.track = new Track(seed + 7)
    this.fitCanvas()
    this.resizeObs = new ResizeObserver(() => this.fitCanvas())
    this.resizeObs.observe(canvas.parentElement ?? canvas)
  }

  private fitCanvas() {
    const parent = this.canvas.parentElement
    if (!parent) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const w = parent.clientWidth
    const h = parent.clientHeight
    if (w === 0 || h === 0) return
    this.canvas.width = Math.round(w * dpr)
    this.canvas.height = Math.round(h * dpr)
    this.canvas.style.width = `${w}px`
    this.canvas.style.height = `${h}px`
  }

  /** Feed a fresh server snapshot. */
  ingest(horses: Horse[], raceProgress: number, paused: boolean) {
    const now = performance.now()
    this.raceProgress = raceProgress
    this.paused = paused
    for (const h of horses) {
      let m = this.horses.get(h.id)
      if (!m) {
        m = {
          id: h.id,
          name: h.name,
          silk: h.color,
          lane: h.lane,
          coat: COATS[h.lane % COATS.length],
          tracker: new HorseTracker(),
          phase: Math.random(),
          speedNorm: 0,
          effSpeed: 0,
          eliminated: false,
          fallStart: null,
          extraPos: 0,
          visX: WORLD.START_X,
        }
        this.horses.set(h.id, m)
        this.order = [...this.horses.values()].sort((a, b) => a.lane - b.lane).map((x) => x.id)
      }
      m.tracker.push(h.position, now)
      m.effSpeed = h.effectiveSpeed
      if (h.isEliminated && !m.eliminated) {
        m.eliminated = true
        m.fallStart = now
      }
    }
  }

  setSpotlight(horseId: string | null) {
    this.spotlightId = horseId
  }

  celebrate(winnerId: string | null) {
    if (this.celebration) return
    this.celebration = { start: performance.now(), winnerId, cannonsFired: 0 }
    this.timeScale = 0.3
    this.confetti.startRain(5.5)
  }

  start() {
    if (this.running) return
    this.running = true
    this.lastT = performance.now()
    const loop = (t: number) => {
      if (!this.running) return
      this.frame(t)
      this.raf = requestAnimationFrame(loop)
    }
    this.raf = requestAnimationFrame(loop)
  }

  destroy() {
    this.running = false
    cancelAnimationFrame(this.raf)
    this.resizeObs?.disconnect()
  }

  // ────────────────────────────────────────────────────────────────────────

  private frame(t: number) {
    const rawDt = Math.max(0, Math.min(0.05, (t - this.lastT) / 1000))
    this.lastT = t

    // Slow-mo recovery after the finish flash
    if (this.celebration) {
      const el = (t - this.celebration.start) / 1000
      if (el > 1.4) this.timeScale = Math.min(1, 0.3 + (el - 1.4) / 1.2)
    }
    const dt = rawDt * this.timeScale
    this.simTime += dt

    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const W = this.canvas.width / dpr
    const H = this.canvas.height / dpr
    if (W === 0 || H === 0) return
    const S = H / 1080
    const ctx = this.ctx
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    // ── Simulation: sample positions, advance gaits, spawn dust ──
    let leaderX = -Infinity
    let leader2X = -Infinity
    let lastX = Infinity
    let leaderId: string | null = null
    let meanX = 0
    let alive = 0
    for (const id of this.order) {
      const m = this.horses.get(id)!
      const stalled = m.tracker.isStalled(t)
      let pos = m.tracker.sample(t)

      // Victory overrun: the winner keeps galloping past the post
      if (this.celebration && stalled) {
        const el = (t - this.celebration.start) / 1000
        if (m.id === this.celebration.winnerId && el < 3.2) {
          m.extraPos += Math.max(0, 1.3 * (1 - el / 3.2)) * dt
        }
      }
      pos += m.extraPos
      m.visX = WORLD.START_X + pos * WORLD.PX_PER_UNIT

      // Gait
      const vel = stalled && !this.celebration ? 0 : m.tracker.velocity
      const targetNorm = m.eliminated
        ? 0
        : this.celebration && m.id === this.celebration.winnerId
          ? Math.max(0.2, Math.min(1, 1.2 * (1 - (t - this.celebration.start) / 3200)))
          : Math.min(1.1, Math.max(0, vel / 1.5))
      m.speedNorm += (targetNorm - m.speedNorm) * Math.min(1, dt * 5)
      if (m.speedNorm > 0.03 && !m.eliminated) {
        const freq = 1.4 + Math.min(1, m.effSpeed / 5) * 1.6
        m.phase = (m.phase + dt * freq * (0.35 + 0.65 * m.speedNorm)) % 1
      }

      if (!m.eliminated) {
        if (pos > leaderX) {
          leader2X = leaderX
          leaderX = pos
          leaderId = m.id
        } else if (pos > leader2X) {
          leader2X = pos
        }
        if (pos < lastX) lastX = pos
        meanX += pos
        alive++
      }

      // Dust from hooves — generous, it sells the speed
      const contact = hoofContact(m.phase) * m.speedNorm
      if (contact > 0.35 && Math.random() < contact * 1.1) {
        const k = laneScale(m.lane) * S
        this.dust.spawn(m.visX - 44 * k, laneGroundY(m.lane, H) - 2, k, Math.min(1.2, m.speedNorm * 1.25))
      }
      // Fall impact burst
      if (m.fallStart && t - m.fallStart < 60) {
        this.dust.burst(m.visX, laneGroundY(m.lane, H) - 4, laneScale(m.lane) * S)
      }
    }
    if (alive > 0) meanX /= alive

    // ── Camera direction ──
    // Shot list, like a TV director would call it:
    //   1. 0–3s      wide shot (zoom 1) — gates, grandstand, the whole place
    //   2. 3–6s      push in on the race — horses fill the frame (≈1.16)
    //   3. cruise    gentle breathing, leader never leaves the frame
    //   4. moments   punch-zoom (~1.32) on a horse that takes the lead
    //   5. last 15%  finish framing; tight duel → hard push
    //   6. event / photo finish override everything
    let focusPos = 0
    let fitZoom = Infinity // zoom level at which the whole field fits
    if (leaderX !== -Infinity) {
      // Seeing all five fight is the show: frame the whole field whenever it
      // fits, zooming out as far as 1.02 to keep it framed. Only when even
      // that can't hold them does the camera abandon the tail.
      const spreadPx = (leaderX - lastX) * WORLD.PX_PER_UNIT
      fitZoom = (W * 0.78) / Math.max(1, spreadPx)
      if (alive > 1 && fitZoom >= 1.02) {
        focusPos = (leaderX + lastX) / 2
      } else {
        const second = leader2X === -Infinity ? leaderX : leader2X
        const chase = Math.max(second, leaderX - 5)
        focusPos = (leaderX + chase) / 2
      }
    }

    // lead-change detection → punch zoom (not in the first shots, not near
    // the finish where the duel framing takes over, one at a time)
    if (
      leaderId &&
      this.lastLeaderId &&
      leaderId !== this.lastLeaderId &&
      this.simTime > 7 &&
      leaderX > 12 &&
      leaderX < 82 &&
      t - this.lastPunchAt > 7000 &&
      !this.celebration &&
      !this.spotlightId
    ) {
      this.punch = { until: t + 2400, horseId: leaderId }
      this.lastPunchAt = t
    }
    if (leaderId) this.lastLeaderId = leaderId
    if (this.punch && t > this.punch.until) this.punch = null

    const openingWide = Math.min(1, Math.max(0, (this.simTime - 3) / 3)) // 0 until 3s, 1 at 6s
    let targetZoom = 1 + 0.19 * openingWide + Math.sin(this.simTime * 0.4) * 0.015 * openingWide
    // never zoom past the point where the field stops fitting on screen
    if (fitZoom >= 1.02) targetZoom = Math.min(targetZoom, fitZoom)
    let camRate = 3.2
    let zoomRate = 2.2

    const gap = leaderX - (leader2X === -Infinity ? leaderX : leader2X)
    const punchHorse = this.punch ? this.horses.get(this.punch.horseId) : null
    if (punchHorse && !punchHorse.eliminated) {
      targetZoom = 1.36
      zoomRate = 4.5
      camRate = 4.5
    }
    if (leaderX > 86) {
      focusPos = leaderX
      targetZoom = gap < 2.5 ? 1.3 : 1.2
      zoomRate = 3
    }

    let camTarget = WORLD.START_X + focusPos * WORLD.PX_PER_UNIT + LOOK_AHEAD
    if (punchHorse && !punchHorse.eliminated && leaderX <= 86) {
      camTarget = punchHorse.visX + LOOK_AHEAD * 0.6
    }
    // Hold the finish line at ~72% of the screen when the head arrives
    const finishHold = WORLD.FINISH_X - W * 0.22
    if (camTarget > finishHold && !this.celebration) camTarget = finishHold

    const spot = this.spotlightId ? this.horses.get(this.spotlightId) : null
    if (spot) {
      camTarget = spot.visX + 40
      targetZoom = 1.32
    }
    if (this.celebration) {
      const w = this.celebration.winnerId ? this.horses.get(this.celebration.winnerId) : null
      if (w) camTarget = w.visX + 60
      targetZoom = 1.22
    }

    this.camX += (camTarget - this.camX) * Math.min(1, rawDt * camRate)
    this.zoom += (targetZoom - this.zoom) * Math.min(1, rawDt * zoomRate)

    // Crowd excitement
    let excitement = Math.min(1, (this.raceProgress / 100) * 0.55 + (leaderX > 82 ? 0.45 : 0))
    if (this.celebration) excitement = 1
    if (spot) excitement = 0.15

    // ── Render ──
    ctx.clearRect(0, 0, W, H)
    ctx.save()
    // zoom around a point low in the frame (track area)
    ctx.translate(W / 2, H * 0.76)
    ctx.scale(this.zoom, this.zoom)
    ctx.translate(-W / 2, -H * 0.76)

    const cam = this.camX
    this.scenery.drawSky(ctx, W, H, cam, this.simTime)
    this.scenery.drawHills(ctx, W, H, cam)
    this.scenery.drawTreeLine(ctx, W, H, cam)
    this.scenery.drawGrass(ctx, W, H, cam)
    this.scenery.drawGrandstand(ctx, W, H, cam, this.simTime, excitement)
    this.scenery.drawFarRail(ctx, W, H, cam)
    this.track.drawSurface(ctx, W, H, cam)
    this.track.drawMarkers(ctx, W, H, cam)
    this.track.drawStartGate(ctx, W, H, cam)
    this.track.drawFinish(ctx, W, H, cam, this.simTime)

    // Horses, far lane first
    for (const id of this.order) {
      const m = this.horses.get(id)!
      const sx = m.visX - cam + W / 2
      if (sx < -260 || sx > W + 260) continue
      const groundY = laneGroundY(m.lane, H)
      const k = laneScale(m.lane) * S * 0.92
      const fall = m.fallStart ? Math.min(1, (t - m.fallStart) / 700) : 0

      // Speed streaks trailing the horse
      if (m.speedNorm > 0.5 && fall === 0) {
        ctx.strokeStyle = `rgba(244,232,206,${(0.16 * m.speedNorm).toFixed(3)})`
        ctx.lineCap = 'round'
        for (let i = 0; i < 4; i++) {
          const yOff = (28 + i * 24 + Math.sin(this.simTime * 13 + i * 2.4) * 9) * k
          const len = (70 + i * 26) * k * m.speedNorm
          const xOff = (50 + i * 14) * k
          ctx.lineWidth = (3.2 - i * 0.55) * k
          ctx.beginPath()
          ctx.moveTo(sx - xOff, groundY - yOff)
          ctx.lineTo(sx - xOff - len, groundY - yOff)
          ctx.stroke()
        }
      }

      ctx.save()
      ctx.translate(sx, groundY)
      ctx.scale(k, k)
      drawHorse(ctx, {
        coat: m.coat,
        silk: m.silk,
        number: m.lane + 1,
        phase: m.phase,
        speedNorm: m.speedNorm,
        time: this.simTime + m.lane * 1.7,
        fall,
        dizzy: m.eliminated,
      })
      ctx.restore()
    }

    this.dust.update(dt)
    this.dust.draw(ctx, cam, W)
    this.scenery.drawNearRail(ctx, W, H, cam)
    ctx.restore() // end zoom

    // Event spotlight (screen space, after zoom restore)
    if (spot) {
      const sx = (spot.visX - cam) * this.zoom + W / 2
      const sy = laneGroundY(spot.lane, H) * this.zoom + H * 0.76 * (1 - this.zoom) - 60 * S
      const g = ctx.createRadialGradient(sx, sy, 130 * S * this.zoom, sx, sy, 420 * S * this.zoom)
      g.addColorStop(0, 'rgba(10,6,2,0)')
      g.addColorStop(1, 'rgba(10,6,2,0.66)')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, W, H)
    }

    // Confetti cannons + rain
    if (this.celebration) {
      const el = (t - this.celebration.start) / 1000
      if (el > 0.25 && this.celebration.cannonsFired === 0) {
        this.confetti.cannon(W * 0.04, H * 0.98, 1, H)
        this.confetti.cannon(W * 0.96, H * 0.98, -1, H)
        this.celebration.cannonsFired = 1
      }
      if (el > 0.9 && this.celebration.cannonsFired === 1) {
        this.confetti.cannon(W * 0.3, H * 1.02, 1, H)
        this.confetti.cannon(W * 0.7, H * 1.02, -1, H)
        this.celebration.cannonsFired = 2
      }
    }
    this.confetti.update(rawDt, W, H)
    this.confetti.draw(ctx, S)
  }
}
