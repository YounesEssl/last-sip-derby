'use client'

import { useRef, useCallback, useEffect } from 'react'

// ── Preloaded audio files ──
const SOUNDS = {
  bell: '/sounds/bell.mp3',
  shutter: '/sounds/camera-shutter.mp3',
  cheer: '/sounds/crow-cheer.mp3',
  gallop: '/sounds/gallop-loop.mp3',
} as const

export function useSoundEngine() {
  const GALLOP_COUNT = 5

  const ctxRef = useRef<AudioContext | null>(null)
  const audiosRef = useRef<Map<string, HTMLAudioElement>>(new Map())
  const gallopTracksRef = useRef<Array<{
    audio: HTMLAudioElement
    gain: GainNode | null
    source: MediaElementAudioSourceNode | null
  }>>([])
  const initRef = useRef(false)

  // Lazy-init AudioContext (needs user gesture)
  const getCtx = useCallback(() => {
    if (!ctxRef.current) {
      ctxRef.current = new AudioContext()
    }
    if (ctxRef.current.state === 'suspended') {
      ctxRef.current.resume()
    }
    return ctxRef.current
  }, [])

  // Preload all audio files
  useEffect(() => {
    if (initRef.current) return
    initRef.current = true

    for (const [key, src] of Object.entries(SOUNDS)) {
      if (key === 'gallop') continue // handled separately
      const audio = new Audio(src)
      audio.preload = 'auto'
      audiosRef.current.set(key, audio)
    }

    // Create N independent gallop tracks with slight pitch offsets
    gallopTracksRef.current = Array.from({ length: GALLOP_COUNT }, () => {
      const audio = new Audio(SOUNDS.gallop)
      audio.preload = 'auto'
      audio.loop = true
      return { audio, gain: null, source: null }
    })
  }, [])

  // ── File-based sounds ──

  const playFile = useCallback((key: string, volume = 1.0) => {
    const audio = audiosRef.current.get(key)
    if (!audio) return
    audio.volume = volume
    audio.currentTime = 0
    audio.play().catch(() => {})
  }, [])

  const playBell = useCallback(() => playFile('bell', 0.7), [playFile])
  const playShutter = useCallback(() => playFile('shutter', 0.8), [playFile])
  const playCheer = useCallback(() => playFile('cheer', 0.8), [playFile])

  // ── Gallop loop: one track per horse, each driven by its own speed ──

  const startGallop = useCallback(() => {
    const ctx = getCtx()

    gallopTracksRef.current.forEach((track, i) => {
      // Wire up gain node on first use
      if (!track.source) {
        const source = ctx.createMediaElementSource(track.audio)
        const gain = ctx.createGain()
        gain.gain.value = 0.15 // lower per-track since they stack
        source.connect(gain)
        gain.connect(ctx.destination)
        track.source = source
        track.gain = gain
      }

      // Stagger start times so the tracks don't phase-align
      track.audio.currentTime = (i * 0.6) % (track.audio.duration || 3)
      track.audio.playbackRate = 0.7
      track.audio.play().catch(() => {})
    })
  }, [getCtx])

  const updateGallopSpeeds = useCallback((horseSpeeds: number[]) => {
    gallopTracksRef.current.forEach((track, i) => {
      if (track.audio.paused) return
      const speed = horseSpeeds[i] ?? 3
      // speed 1–10 → playbackRate 0.6–1.8
      const rate = 0.6 + (speed - 1) * (1.2 / 9)
      track.audio.playbackRate = Math.max(0.5, Math.min(2.0, rate))

      // Volume scales with speed (quiet when slow, loud when sprinting)
      if (track.gain) {
        track.gain.gain.value = 0.08 + (speed / 10) * 0.20
      }
    })
  }, [])

  const stopGallop = useCallback(() => {
    gallopTracksRef.current.forEach((track) => {
      track.audio.pause()
      track.audio.currentTime = 0
    })
  }, [])

  // ── Synthesized sounds (Web Audio API) ──

  const playCountdownBeep = useCallback((step: number) => {
    const ctx = getCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.connect(gain)
    gain.connect(ctx.destination)

    // 3→low, 2→mid, 1→high
    const freqs: Record<number, number> = { 3: 330, 2: 440, 1: 660 }
    osc.frequency.value = freqs[step] ?? 440
    osc.type = 'square'

    const now = ctx.currentTime
    gain.gain.setValueAtTime(0.3, now)
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2)

    osc.start(now)
    osc.stop(now + 0.2)
  }, [getCtx])

  const playStartGun = useCallback(() => {
    const ctx = getCtx()

    // White noise burst (gunshot)
    const bufferSize = ctx.sampleRate * 0.15
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 3)
    }

    const source = ctx.createBufferSource()
    source.buffer = buffer
    const gain = ctx.createGain()
    gain.gain.value = 0.5
    source.connect(gain)
    gain.connect(ctx.destination)
    source.start()

    // + High tone accent
    const osc = ctx.createOscillator()
    const oscGain = ctx.createGain()
    osc.connect(oscGain)
    oscGain.connect(ctx.destination)
    osc.frequency.value = 880
    osc.type = 'square'
    const now = ctx.currentTime
    oscGain.gain.setValueAtTime(0.25, now)
    oscGain.gain.exponentialRampToValueAtTime(0.01, now + 0.3)
    osc.start(now)
    osc.stop(now + 0.3)
  }, [getCtx])

  const playEventAlert = useCallback(() => {
    const ctx = getCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'sawtooth'
    const now = ctx.currentTime

    // Two-tone alarm
    osc.frequency.setValueAtTime(440, now)
    osc.frequency.setValueAtTime(660, now + 0.12)
    osc.frequency.setValueAtTime(440, now + 0.24)
    osc.frequency.setValueAtTime(660, now + 0.36)

    gain.gain.setValueAtTime(0.2, now)
    gain.gain.setValueAtTime(0.2, now + 0.4)
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5)

    osc.start(now)
    osc.stop(now + 0.5)
  }, [getCtx])

  const playTimerTick = useCallback(() => {
    const ctx = getCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 1000
    osc.type = 'sine'
    const now = ctx.currentTime
    gain.gain.setValueAtTime(0.1, now)
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05)
    osc.start(now)
    osc.stop(now + 0.05)
  }, [getCtx])

  const playSprintWhoosh = useCallback(() => {
    const ctx = getCtx()
    const bufferSize = ctx.sampleRate * 2
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.min(1, i / (bufferSize * 0.3))
    }

    const source = ctx.createBufferSource()
    source.buffer = buffer

    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.Q.value = 2

    const gain = ctx.createGain()
    gain.gain.value = 0.15

    source.connect(filter)
    filter.connect(gain)
    gain.connect(ctx.destination)

    const now = ctx.currentTime
    // Sweep filter frequency up for rising whoosh
    filter.frequency.setValueAtTime(200, now)
    filter.frequency.exponentialRampToValueAtTime(2000, now + 1.5)
    gain.gain.setValueAtTime(0.15, now)
    gain.gain.linearRampToValueAtTime(0.3, now + 1.0)
    gain.gain.linearRampToValueAtTime(0.0, now + 2.0)

    source.start(now)
    source.stop(now + 2.0)
  }, [getCtx])

  // Cleanup
  useEffect(() => {
    return () => {
      gallopTracksRef.current.forEach((t) => t.audio.pause())
      ctxRef.current?.close()
    }
  }, [])

  return {
    playBell,
    playShutter,
    playCheer,
    startGallop,
    updateGallopSpeeds,
    stopGallop,
    playCountdownBeep,
    playStartGun,
    playEventAlert,
    playTimerTick,
    playSprintWhoosh,
  }
}
