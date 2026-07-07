// Converts 10 Hz server snapshots into smooth 60 fps positions.
// Renders slightly in the past (RENDER_DELAY) so we can interpolate between
// two known snapshots instead of guessing ahead.

interface Snapshot {
  t: number
  pos: number
}

const RENDER_DELAY_MS = 180
const BUFFER_MAX = 30
const STALL_MS = 350 // no fresh snapshot for this long → hold position (pause)

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

  sample(now: number): number {
    const n = this.buffer.length
    if (n === 0) return 0
    const newest = this.buffer[n - 1]
    const rt = now - RENDER_DELAY_MS

    if (now - newest.t > STALL_MS || rt >= newest.t) {
      // Paused or slightly ahead of data: clamp to the newest known position.
      return newest.pos
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
