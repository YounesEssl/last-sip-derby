// Converts 10 Hz server snapshots into smooth 60 fps positions.
// Renders slightly in the past so normal internet jitter stays inside the
// snapshot buffer instead of turning late/clustered packets into slowdowns
// and catch-up jumps.

interface Snapshot {
  t: number
  pos: number
}

const RENDER_DELAY_MS = 280
const BUFFER_MAX = 30
const MAX_EXTRAPOLATION_MS = 220
const STALL_MS = 700
const MAX_SPEED_UNITS_PER_SECOND = 4

export class HorseTracker {
  private buffer: Snapshot[] = []
  velocity = 0 // position units per second (for lean/cadence)

  push(pos: number, t: number) {
    const last = this.buffer[this.buffer.length - 1]
    if (last && t - last.t < 10) return
    this.buffer.push({ t, pos })
    if (this.buffer.length > BUFFER_MAX) this.buffer.shift()
    if (last) {
      const dt = (t - last.t) / 1000
      if (dt > 0) {
        const v = (pos - last.pos) / dt
        this.velocity = this.velocity * 0.6 + v * 0.4
      }
    }
  }

  sample(now: number, hold = false): number {
    const n = this.buffer.length
    if (n === 0) return 0
    const newest = this.buffer[n - 1]
    const rt = now - RENDER_DELAY_MS

    if (hold || now - newest.t > STALL_MS) {
      return newest.pos
    }
    if (rt >= newest.t) {
      // A packet can still miss the jitter buffer on a Wi-Fi spike. Continue
      // briefly along the latest server-timed velocity rather than freezing,
      // then hold if the connection is genuinely gone.
      const horizon = Math.min(MAX_EXTRAPOLATION_MS, rt - newest.t)
      const velocity = Math.max(-MAX_SPEED_UNITS_PER_SECOND, Math.min(MAX_SPEED_UNITS_PER_SECOND, this.velocity))
      return Math.max(0, Math.min(101.5, newest.pos + velocity * (horizon / 1000)))
    }
    for (let i = n - 1; i > 0; i--) {
      const a = this.buffer[i - 1]
      const b = this.buffer[i]
      if (rt >= a.t && rt <= b.t) {
        const k = (rt - a.t) / Math.max(1, b.t - a.t)
        return a.pos + (b.pos - a.pos) * k
      }
    }
    return this.buffer[0].pos
  }

  isStalled(now: number): boolean {
    const newest = this.buffer[this.buffer.length - 1]
    return !newest || now - newest.t > STALL_MS
  }

  reset() {
    this.buffer = []
    this.velocity = 0
  }
}
