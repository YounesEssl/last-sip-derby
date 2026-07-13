import type { GamePhase } from '@last-sip-derby/shared'

export interface RaceAudioState {
  phase: GamePhase
  raceNumber: number
  raceProgress: number
  racePaused: boolean
  activeEventId: string | null
  leaderId: string | null
  eliminatedCount: number
  jockeyFallCount: number
  reversedCount: number
  lightningId: string | null
  lightningPhase: 'BLACKOUT' | 'STRIKE' | 'CLEARING' | null
}

export interface RaceTrackInfo {
  id: string
  title: string
  creator: string
}

interface RaceTrack extends RaceTrackInfo {
  file: string
  startAt: number
}

const TRACKS: RaceTrack[] = [
  {
    id: 'pmu-rave',
    title: 'PMU RAVE',
    creator: 'spinopel',
    file: '/audio/music/pmu-rave.mp3',
    startAt: 2.5,
  },
  {
    id: 'festival-turbo',
    title: 'FESTIVAL TURBO',
    creator: 'MFCC',
    file: '/audio/music/festival-turbo.mp3',
    startAt: 4,
  },
  {
    id: 'electro-swing',
    title: 'SWING DU TURF',
    creator: 'Music-for-Videos',
    file: '/audio/music/electro-swing.mp3',
    startAt: 1,
  },
  {
    id: 'fanfare-latino',
    title: 'FANFARE TURBO',
    creator: 'Sonican',
    file: '/audio/music/fanfare-latino.mp3',
    startAt: 2,
  },
]

const SAMPLE_FILES = {
  airhorn: '/audio/sfx/airhorn.mp3',
  chant: '/audio/sfx/crowd-chant.mp3',
  finish: '/audio/sfx/crowd-finish.mp3',
} as const

type SampleName = keyof typeof SAMPLE_FILES

const ROOTS = [65.41, 73.42, 87.31, 98]
const LOUNGE_MELODY = [12, 16, 19, 16, 14, 17, 21, 19]
const BAG_KEY = 'aperodrome:audio-track-bag-v1'
const LAST_KEY = 'aperodrome:audio-last-track-v1'

export class RaceAudioDirector {
  private ctx = new AudioContext()
  private master = this.ctx.createGain()
  private synthMusic = this.ctx.createGain()
  private fx = this.ctx.createGain()
  private trackGain = this.ctx.createGain()
  private trackFilter = this.ctx.createBiquadFilter()
  private compressor = this.ctx.createDynamicsCompressor()
  private noiseBuffer: AudioBuffer
  private samples = new Map<SampleName, AudioBuffer>()
  private trackBuffers = new Map<string, AudioBuffer>()
  private musicSource: AudioBufferSourceNode | null = null
  private timer: number | null = null
  private nextStep = 0
  private step = 0
  private current: RaceAudioState | null = null
  private currentTrack: RaceTrack | null = null
  private currentRaceNumber: number | null = null
  private finalStage = 0
  private lastLeaderHitAt = -Infinity
  private leadChangeCount = 0
  private stopped = false

  constructor(private readonly onTrackChange?: (track: RaceTrackInfo | null) => void) {
    this.master.gain.value = 0.82
    this.synthMusic.gain.value = 0.3
    this.fx.gain.value = 0.72
    this.trackGain.gain.value = 0.0001
    this.trackFilter.type = 'lowpass'
    this.trackFilter.frequency.value = 18000

    this.compressor.threshold.value = -16
    this.compressor.knee.value = 14
    this.compressor.ratio.value = 5
    this.compressor.attack.value = 0.006
    this.compressor.release.value = 0.2

    this.synthMusic.connect(this.master)
    this.fx.connect(this.master)
    this.trackFilter.connect(this.trackGain).connect(this.master)
    this.master.connect(this.compressor).connect(this.ctx.destination)

    this.noiseBuffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 2, this.ctx.sampleRate)
    const samples = this.noiseBuffer.getChannelData(0)
    for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1
  }

  async start(state: RaceAudioState) {
    this.stopped = false
    void this.loadSamples()
    this.current = state
    this.nextStep = this.ctx.currentTime + 0.05
    this.step = 0
    this.timer = window.setInterval(() => this.schedule(), 35)
    this.enterPhase(state.phase, state.raceNumber)
    this.updateMix(state)
    await this.ctx.resume()
  }

  async unlock() {
    if (this.ctx.state !== 'closed') await this.ctx.resume()
  }

  stop() {
    this.stopped = true
    if (this.timer !== null) window.clearInterval(this.timer)
    this.timer = null
    this.stopTrack(0.02)
    void this.ctx.close()
  }

  update(next: RaceAudioState) {
    const prev = this.current
    this.current = next
    if (!prev) return

    if (prev.phase !== next.phase) {
      this.step = 0
      this.nextStep = this.ctx.currentTime + 0.05
      this.enterPhase(next.phase, next.raceNumber)
    } else if (next.phase === 'RACING' && this.currentRaceNumber !== next.raceNumber) {
      this.startRaceTrack(next.raceNumber)
    }

    if (next.phase === 'RACING') {
      this.handleRaceReactions(prev, next)
    }
    this.updateMix(next)
  }

  private async loadSamples() {
    await Promise.all(
      (Object.entries(SAMPLE_FILES) as Array<[SampleName, string]>).map(async ([name, file]) => {
        try {
          const response = await fetch(file)
          if (!response.ok) return
          const buffer = await response.arrayBuffer()
          if (this.stopped) return
          this.samples.set(name, await this.ctx.decodeAudioData(buffer))
        } catch {
          // The synthesised fallbacks still keep the experience alive offline.
        }
      }),
    )
  }

  private enterPhase(phase: GamePhase, raceNumber: number) {
    const at = this.ctx.currentTime + 0.03
    if (phase === 'RACING') {
      this.finalStage = 0
      this.leadChangeCount = 0
      this.lastLeaderHitAt = -Infinity
      this.startRaceTrack(raceNumber)
      this.startBell(at)
      this.riser(at + 0.08, 0.7, 0.09)
      this.kick(at + 0.66, 0.3)
      return
    }

    if (phase === 'RESULTS') {
      this.stopTrack(1.15)
      this.onTrackChange?.(null)
      this.playSample('finish', 0.82)
      this.victoryFanfare(at + 0.08)
      return
    }

    this.stopTrack(0.8)
    this.onTrackChange?.(null)
    this.brass(261.63, at, 0.07)
    this.brass(392, at + 0.11, 0.06)
  }

  private handleRaceReactions(prev: RaceAudioState, next: RaceAudioState) {
    const now = this.ctx.currentTime

    if (next.racePaused && !prev.racePaused) {
      this.incidentSting(now + 0.02)
    } else if (!next.racePaused && prev.racePaused) {
      this.riser(now + 0.02, 0.38, 0.065)
      this.kick(now + 0.38, 0.22)
    }

    if (
      prev.leaderId &&
      next.leaderId &&
      prev.leaderId !== next.leaderId &&
      next.raceProgress > 10 &&
      next.raceProgress < 94 &&
      now - this.lastLeaderHitAt > 2.8
    ) {
      this.lastLeaderHitAt = now
      this.leadChangeCount++
      if (this.leadChangeCount % 3 === 0) this.playSample('airhorn', 0.3)
      else this.leaderSting(now + 0.015)
    }

    if (next.eliminatedCount > prev.eliminatedCount) this.fallSting(now + 0.02)
    if (next.jockeyFallCount > prev.jockeyFallCount) this.riderFallSting(now + 0.02)
    if (next.reversedCount > prev.reversedCount) this.incidentSting(now + 0.02)
    if (next.lightningId && next.lightningId !== prev.lightningId) this.stormRumble(now + 0.02)
    if (next.lightningPhase === 'STRIKE' && prev.lightningPhase !== 'STRIKE') this.thunder(now + 0.01)

    if (this.finalStage < 1 && next.raceProgress >= 72) {
      this.finalStage = 1
      this.playSample('chant', 0.34)
      this.riser(now + 0.05, 0.55, 0.065)
    }
    if (this.finalStage < 2 && next.raceProgress >= 88) {
      this.finalStage = 2
      this.playSample('airhorn', 0.42)
      this.riser(now + 0.1, 0.85, 0.1)
    }
    if (this.finalStage < 3 && next.raceProgress >= 96) {
      this.finalStage = 3
      this.finalSprintFanfare(now + 0.02)
    }
  }

  private updateMix(state: RaceAudioState) {
    const now = this.ctx.currentTime
    const isRace = state.phase === 'RACING'
    const paused = isRace && state.racePaused
    const progress = Math.max(0, Math.min(100, state.raceProgress))
    const storm = !!state.lightningPhase
    const target = !isRace ? 0.0001 : storm ? 0.035 : paused ? 0.18 : progress >= 90 ? 0.8 : 0.64 + progress * 0.0012
    const cutoff = storm ? 320 : paused ? 850 : progress >= 88 ? 19000 : 14500

    this.trackGain.gain.cancelScheduledValues(now)
    this.trackGain.gain.setTargetAtTime(target, now, paused ? 0.08 : 0.22)
    this.trackFilter.frequency.cancelScheduledValues(now)
    this.trackFilter.frequency.setTargetAtTime(cutoff, now, paused ? 0.06 : 0.18)
    this.synthMusic.gain.setTargetAtTime(isRace ? (progress >= 88 ? 0.2 : 0.08) : 0.25, now, 0.16)

    if (this.musicSource && isRace) {
      const rate = paused ? 0.985 : progress >= 88 ? 1.035 : progress >= 72 ? 1.018 : 1
      this.musicSource.playbackRate.setTargetAtTime(rate, now, 0.2)
    }
  }

  private startRaceTrack(raceNumber: number) {
    if (this.currentRaceNumber === raceNumber && this.currentTrack) return
    this.stopTrack(0.05)
    const track = this.pickTrack(raceNumber)
    this.currentTrack = track
    this.currentRaceNumber = raceNumber
    this.onTrackChange?.(track)

    const now = this.ctx.currentTime
    this.trackGain.gain.cancelScheduledValues(now)
    this.trackGain.gain.setValueAtTime(0.0001, now)
    this.trackGain.gain.exponentialRampToValueAtTime(0.66, now + 1.05)
    void this.loadTrack(track)
      .then((buffer) => {
        if (this.stopped || this.currentTrack?.id !== track.id || this.current?.phase !== 'RACING') return
        const source = this.ctx.createBufferSource()
        source.buffer = buffer
        source.loop = true
        source.connect(this.trackFilter)
        source.start(0, Math.min(track.startAt, Math.max(0, buffer.duration - 1)))
        this.musicSource = source
      })
      .catch(() => {
        if (this.currentTrack?.id === track.id) this.onTrackChange?.({ id: 'arcade', title: 'MODE ARCADE', creator: 'L’Apérodrome' })
      })
  }

  private stopTrack(fadeSeconds: number) {
    const source = this.musicSource
    if (source) {
      this.fadeTrack(0.0001, fadeSeconds)
      try {
        source.stop(this.ctx.currentTime + Math.max(0.02, fadeSeconds) + 0.02)
      } catch {
        source.stop()
      }
      source.addEventListener('ended', () => source.disconnect(), { once: true })
    }
    this.musicSource = null
    this.currentTrack = null
  }

  private async loadTrack(track: RaceTrack): Promise<AudioBuffer> {
    const cached = this.trackBuffers.get(track.id)
    if (cached) return cached
    const response = await fetch(track.file)
    if (!response.ok) throw new Error(`Unable to load ${track.file}`)
    const decoded = await this.ctx.decodeAudioData(await response.arrayBuffer())
    this.trackBuffers.set(track.id, decoded)
    return decoded
  }

  private fadeTrack(value: number, duration: number) {
    const now = this.ctx.currentTime
    const gain = this.trackGain.gain
    gain.cancelScheduledValues(now)
    gain.setValueAtTime(Math.max(0.0001, gain.value), now)
    gain.exponentialRampToValueAtTime(Math.max(0.0001, value), now + Math.max(0.02, duration))
  }

  private pickTrack(raceNumber: number): RaceTrack {
    const assignmentKey = `aperodrome:audio-race-${raceNumber}`
    const storedAssignment = sessionStorage.getItem(assignmentKey)
    const assigned = TRACKS.find((track) => track.id === storedAssignment)
    if (assigned) return assigned

    let bag: string[] = []
    try {
      const parsed = JSON.parse(sessionStorage.getItem(BAG_KEY) ?? '[]')
      if (Array.isArray(parsed)) bag = parsed.filter((id): id is string => TRACKS.some((track) => track.id === id))
    } catch {
      bag = []
    }
    if (bag.length === 0) {
      bag = TRACKS.map((track) => track.id)
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[bag[i], bag[j]] = [bag[j], bag[i]]
      }
      const last = sessionStorage.getItem(LAST_KEY)
      if (bag.length > 1 && bag[0] === last) [bag[0], bag[1]] = [bag[1], bag[0]]
    }
    const id = bag.shift() ?? TRACKS[0].id
    sessionStorage.setItem(BAG_KEY, JSON.stringify(bag))
    sessionStorage.setItem(LAST_KEY, id)
    sessionStorage.setItem(assignmentKey, id)
    return TRACKS.find((track) => track.id === id) ?? TRACKS[0]
  }

  private playSample(name: SampleName, level: number, rate = 1) {
    const buffer = this.samples.get(name)
    if (!buffer) {
      if (name === 'airhorn') this.leaderSting(this.ctx.currentTime)
      if (name === 'finish') this.crowdHey(this.ctx.currentTime, 0.12)
      return
    }
    const source = this.ctx.createBufferSource()
    const gain = this.ctx.createGain()
    source.buffer = buffer
    source.playbackRate.value = rate
    gain.gain.value = level
    source.connect(gain).connect(this.fx)
    source.start()
  }

  private schedule() {
    if (!this.current) return
    const tempo = this.current.phase === 'RACING' ? 156 : this.current.phase === 'BETTING' ? 124 : 108
    const sixteenth = 60 / tempo / 4
    while (this.nextStep < this.ctx.currentTime + 0.18) {
      this.sequence(this.step, this.nextStep, this.current)
      this.nextStep += sixteenth
      this.step++
    }
  }

  private sequence(step: number, at: number, state: RaceAudioState) {
    const slot = step % 16
    const bar = Math.floor(step / 16)
    const root = ROOTS[bar % ROOTS.length]

    if (state.phase === 'RACING') {
      if (state.racePaused) return
      if (state.raceProgress >= 88) {
        if (slot % 2 === 0) this.hat(at, slot === 14 ? 0.05 : 0.025, slot === 14 ? 0.14 : 0.04)
        if ([0, 4, 8, 12].includes(slot)) this.kick(at, slot === 0 ? 0.11 : 0.07)
      } else if (state.raceProgress >= 72 && slot % 4 === 2) {
        this.hat(at, 0.018, 0.045)
      }
      return
    }

    if (slot === 0 || slot === 8) this.kick(at, 0.055)
    if (slot === 4 || slot === 12) this.clap(at, 0.03)
    if (slot % 4 === 2) this.hat(at, 0.012, 0.05)
    if (slot % 4 === 0) this.bass(root, at, 0.035)
    if (slot === 6 || slot === 14) {
      const note = root * 4 * Math.pow(2, LOUNGE_MELODY[(bar + slot) % LOUNGE_MELODY.length] / 12)
      this.lead(note, at, 0.024)
    }
  }

  private oscillator(
    frequency: number,
    at: number,
    duration: number,
    gainValue: number,
    type: OscillatorType,
    destination = this.synthMusic,
    filterFrequency = 3000,
  ) {
    const oscillator = this.ctx.createOscillator()
    const filter = this.ctx.createBiquadFilter()
    const gain = this.ctx.createGain()
    oscillator.type = type
    oscillator.frequency.setValueAtTime(frequency, at)
    filter.type = 'lowpass'
    filter.frequency.value = filterFrequency
    gain.gain.setValueAtTime(0.0001, at)
    gain.gain.exponentialRampToValueAtTime(gainValue, at + 0.008)
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration)
    oscillator.connect(filter).connect(gain).connect(destination)
    oscillator.start(at)
    oscillator.stop(at + duration + 0.03)
  }

  private bass(frequency: number, at: number, level: number) {
    this.oscillator(frequency, at, 0.17, level, 'sawtooth', this.synthMusic, 460)
    this.oscillator(frequency / 2, at, 0.2, level * 0.65, 'sine', this.synthMusic, 300)
  }

  private brass(frequency: number, at: number, level: number) {
    ;[1, 1.005, 0.995].forEach((detune, i) =>
      this.oscillator(frequency * detune, at + i * 0.003, 0.2, level / 3, 'sawtooth', this.fx, 1900),
    )
  }

  private lead(frequency: number, at: number, level: number) {
    this.oscillator(frequency, at, 0.09, level, 'square', this.synthMusic, 2300)
    this.oscillator(frequency * 2, at, 0.06, level * 0.22, 'sine', this.synthMusic, 3400)
  }

  private kick(at: number, level: number) {
    const oscillator = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(155, at)
    oscillator.frequency.exponentialRampToValueAtTime(42, at + 0.12)
    gain.gain.setValueAtTime(level, at)
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.17)
    oscillator.connect(gain).connect(this.fx)
    oscillator.start(at)
    oscillator.stop(at + 0.18)
  }

  private noise(at: number, duration: number, level: number, highpass: number, destination = this.fx) {
    const source = this.ctx.createBufferSource()
    const filter = this.ctx.createBiquadFilter()
    const gain = this.ctx.createGain()
    source.buffer = this.noiseBuffer
    filter.type = 'highpass'
    filter.frequency.value = highpass
    gain.gain.setValueAtTime(level, at)
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration)
    source.connect(filter).connect(gain).connect(destination)
    source.start(at)
    source.stop(at + duration)
  }

  private clap(at: number, level: number) {
    this.noise(at, 0.09, level, 900)
    this.noise(at + 0.018, 0.07, level * 0.55, 1400)
  }

  private hat(at: number, level: number, duration: number) {
    this.noise(at, duration, level, 5600, this.synthMusic)
  }

  private crowdHey(at: number, level: number) {
    this.noise(at, 0.22, level * 0.7, 280)
    this.oscillator(185, at, 0.18, level, 'sawtooth', this.fx, 750)
    this.oscillator(220, at + 0.015, 0.16, level * 0.7, 'square', this.fx, 900)
  }

  private riser(at: number, duration: number, level: number) {
    const oscillator = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    const filter = this.ctx.createBiquadFilter()
    oscillator.type = 'sawtooth'
    oscillator.frequency.setValueAtTime(110, at)
    oscillator.frequency.exponentialRampToValueAtTime(880, at + duration)
    filter.type = 'bandpass'
    filter.frequency.setValueAtTime(400, at)
    filter.frequency.exponentialRampToValueAtTime(2800, at + duration)
    gain.gain.setValueAtTime(0.0001, at)
    gain.gain.exponentialRampToValueAtTime(level, at + duration * 0.75)
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration)
    oscillator.connect(filter).connect(gain).connect(this.fx)
    oscillator.start(at)
    oscillator.stop(at + duration + 0.02)
  }

  private startBell(at: number) {
    ;[1046.5, 1318.5, 1568].forEach((frequency, index) => {
      this.oscillator(frequency, at + index * 0.11, 0.42, 0.07 - index * 0.012, 'sine', this.fx, 5000)
    })
  }

  private leaderSting(at: number) {
    this.brass(392, at, 0.12)
    this.brass(523.25, at + 0.08, 0.11)
    this.brass(783.99, at + 0.16, 0.1)
  }

  private incidentSting(at: number) {
    this.oscillator(220, at, 0.34, 0.09, 'sawtooth', this.fx, 1200)
    this.oscillator(185, at + 0.18, 0.42, 0.1, 'sawtooth', this.fx, 950)
    this.noise(at, 0.35, 0.05, 500)
  }

  private fallSting(at: number) {
    ;[392, 311.13, 233.08, 174.61].forEach((frequency, i) =>
      this.oscillator(frequency, at + i * 0.07, 0.14, 0.075 - i * 0.008, 'square', this.fx, 1300),
    )
    this.kick(at + 0.22, 0.16)
  }

  private riderFallSting(at: number) {
    this.noise(at, 0.42, 0.09, 700)
    this.oscillator(520, at, 0.28, 0.07, 'sawtooth', this.fx, 1600)
    this.oscillator(180, at + 0.2, 0.22, 0.09, 'square', this.fx, 700)
  }

  private stormRumble(at: number) {
    this.oscillator(48, at, 3.35, 0.18, 'sine', this.fx, 180)
    this.oscillator(61, at + 0.25, 3.0, 0.1, 'sawtooth', this.fx, 140)
    this.noise(at, 3.3, 0.08, 35)
  }

  private thunder(at: number) {
    this.noise(at, 1.8, 0.5, 35)
    this.kick(at, 0.42)
    this.oscillator(42, at, 1.5, 0.34, 'sine', this.fx, 150)
    this.oscillator(78, at + 0.06, 0.7, 0.18, 'sawtooth', this.fx, 260)
  }

  private victoryFanfare(at: number) {
    ;[523.25, 659.25, 783.99, 1046.5].forEach((note, i) => this.brass(note, at + i * 0.14, 0.19))
    for (let i = 0; i < 8; i++) this.clap(at + 0.55 + i * 0.1, 0.06 - i * 0.004)
  }

  private finalSprintFanfare(at: number) {
    ;[392, 523.25, 659.25, 783.99].forEach((note, i) => this.brass(note, at + i * 0.085, 0.12))
    for (let i = 0; i < 4; i++) this.kick(at + 0.36 + i * 0.12, 0.16 + i * 0.02)
  }
}
